import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, ScrollView, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

// ✅ Import shared utilities
import {
    getSeverity, getAlarmName, getAlarmStatus, getAlarmKey,
    shouldFilterOut, normaliseAndMerge, smpsAlarmFieldMapping,
    calcAlarmKpi
} from '../../utils/alarmUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveAlarms'>;

// ─────────────────────────────────────────────
// CSV helper
// ─────────────────────────────────────────────
const convertToCSV = (objArray: any[]) => {
    if (!objArray || objArray.length === 0) return '';
    const allHeadersSet = new Set<string>();
    objArray.forEach(obj => Object.keys(obj).forEach(key => allHeadersSet.add(key)));
    const headers = Array.from(allHeadersSet);
    const csvRows = [headers.join(',')];
    for (const row of objArray) {
        const values = headers.map(header => {
            const val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
            return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

// ─────────────────────────────────────────────
// SMPS alarm field → human-readable name
// (mirrors backend alarm_field_mapping)
// ─────────────────────────────────────────────
// Helper functions removed — now using imports from ../../utils/alarmUtils

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function LiveAlarmsScreen({ route, navigation }: Props) {
    const { severity: initialSeverity } = (route.params as any) || {};

  const { globalFilters, setGlobalFilters, hasActiveFilters: gHasFilters, activeFilterCount: gFilterCount } = useGlobalFilter();

  const [alarms, setAlarms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity || 'all');
    const [activeFilters, setActiveFilters] = useState<Record<string, any>>(globalFilters)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Fetch ────────────────────────────────
    const fetchAllAlarms = useCallback(
        async (showLoading = false) => {
            if (showLoading && !refreshing) setLoading(true);
            try {
                const res = await api.getLiveAlarmsSnmp(activeFilters);
                const data = res?.data || res || [];
                setAlarms(data);
            } catch (e) {
                console.error('Alarm Fetch Error:', e);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [activeFilters, refreshing]
    );

    // ─── Effects ──────────────────────────────
    useEffect(() => {
        fetchAllAlarms(true);
        intervalRef.current = setInterval(() => fetchAllAlarms(false), 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [activeFilters]);

    useEffect(() => {
        if ((route.params as any)?.severity) {
            setSeverityFilter((route.params as any).severity);
        }
    }, [(route.params as any)?.severity]);

    // ─── Client-side filter ───────────────────
    const filteredAlarms = useMemo(() => {
        return alarms.filter(alarm => {
            const severity = getSeverity(alarm);
            const status = getAlarmStatus(alarm);

            // Severity / status filter
            if (severityFilter !== 'all') {
                if (severityFilter === 'Open' && status !== 'Open') return false;
                if (severityFilter === 'Closed' && status !== 'Closed') return false;
                if (!['Open', 'Closed'].includes(severityFilter) && severity !== severityFilter) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (alarm.alarm_name || alarm.alarm_desc || '').toLowerCase();
                const site = (alarm.site_name || '').toLowerCase();
                const id = (alarm.global_id || alarm.globel_id || alarm.site_id || alarm.imei || '').toLowerCase();
                if (!name.includes(q) && !site.includes(q) && !id.includes(q)) return false;
            }

            return true;
        });
    }, [alarms, severityFilter, searchQuery]);

    // ─── KPI counts ───────────────────────────
    const kpiCounts = useMemo(() => calcAlarmKpi(alarms), [alarms]);

    // ─── Export ───────────────────────────────
    const handleExport = async () => {
        setExporting(true);
        try {
            const exportRows = filteredAlarms.map(alarm => ({
                'Global ID': alarm.global_id || alarm.globel_id || 'N/A',
                'Site Name': alarm.site_name || 'N/A',
                'Alarm': getAlarmName(alarm),
                'Severity': getSeverity(alarm),
                'Status': getAlarmStatus(alarm),
                'Site Status': alarm.site_running_status || 'N/A',
                'Active Time': alarm.active_time_formatted || 'N/A',
                'Start Time': alarm.start_time || alarm.create_dt || 'N/A',
                'End Time': alarm.end_time || 'N/A',
                'Alarm Type': alarm._alarmSource === 'tpms' ? 'RMS' : (alarm.source_table || 'SMPS'),
                'Device Make': alarm.device_make || 'N/A',
                'Start Volt': alarm.start_volt != null ? `${parseFloat(alarm.start_volt).toFixed(2)}V` : 'N/A',
                'End Volt': alarm.end_volt != null ? `${parseFloat(alarm.end_volt).toFixed(2)}V` : 'N/A',
            }));

            if (exportRows.length === 0) {
                Alert.alert('No Data', 'No alarms found with current filters.');
                return;
            }

            const csvString = convertToCSV(exportRows);
            const fileName = `Live_Alarms_${Date.now()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Export Live Alarms',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert('Export Error', 'Failed to generate export file.');
                console.error(error);
            }
        } finally {
            setExporting(false);
        }
    };

    // ─── Render card ──────────────────────────
    // ─── Render card ──────────────────────────
    const renderAlarmCard = ({ item }: { item: any }) => {
        const status    = getAlarmStatus(item);
        const alarmName = getAlarmName(item);
        const globalId  = item.global_id || item.globel_id || item.site_id || 'N/A';
        const siteStatus = item.site_running_status || 'N/A';
        const isOpen     = status === 'Open';

        const startVolt = item.start_volt != null ? `${parseFloat(item.start_volt).toFixed(2)}V` : 'N/A';
        const endVolt   = item.end_volt   != null ? `${parseFloat(item.end_volt).toFixed(2)}V`   : 'N/A';

        const formatDate = (ts: any) => {
            if (!ts || ts === '—' || ts === 'None' || ts === null) return '—';
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                });
            }
            return String(ts);
        };

        const siteStatusColors: Record<string, { bg: string; text: string }> = {
            SOEB:  { bg: '#dcfce7', text: '#16a34a' },
            SODG:  { bg: '#fef9c3', text: '#ca8a04' },
            SOBT:  { bg: '#fee2e2', text: '#dc2626' },
            SLREB: { bg: '#dbeafe', text: '#2563eb' },
        };
        const ssColor = siteStatusColors[siteStatus] || { bg: '#f1f5f9', text: '#64748b' };

        // border color: open=blue accent, closed=green
        const borderColor = isOpen ? '#1e3c72' : '#22c55e';

        return (
            <TouchableOpacity
                style={[styles.card, { borderLeftColor: borderColor }]}
                onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
                activeOpacity={0.85}
            >
                {/* ── Header: Site Name + Status badge ── */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: moderateScale(10) }}>
                        <Text style={styles.siteName} numberOfLines={1}>{item.site_name || 'Unnamed Site'}</Text>
                        <Text style={styles.siteId}>Global ID: {globalId}</Text>
                    </View>
                    <View style={[styles.badge, {
                        backgroundColor: isOpen ? '#eff6ff' : '#dcfce7',
                        borderWidth: 1,
                        borderColor: isOpen ? '#93c5fd' : '#86efac',
                    }]}>
                        <Text style={[styles.badgeText, { color: isOpen ? '#1d4ed8' : '#15803d' }]}>
                            {isOpen ? 'ACTIVE' : 'CLOSED'}
                        </Text>
                    </View>
                </View>

                {/* ── Alarm Name ── */}
                <Text style={styles.alarmDesc} numberOfLines={3}>{alarmName}</Text>

                {/* ── Meta grid ── */}
                <View style={styles.metadataContainer}>
                    {/* Row 1: Site Status | Start Volt | End Volt */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>SITE STATUS</Text>
                            <View style={[styles.siteStatusBadge, { backgroundColor: ssColor.bg }]}>
                                <Text style={[styles.siteStatusText, { color: ssColor.text }]}>{siteStatus}</Text>
                            </View>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>START VOLT</Text>
                            <Text style={[styles.metaValue, { color: '#1e3c72' }]}>{startVolt}</Text>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>END VOLT</Text>
                            <Text style={styles.metaValue}>{endVolt}</Text>
                        </View>
                    </View>

                    {/* Row 2: Start Time | End Time */}
                    <View style={[styles.metaRow, { borderBottomWidth: 0, paddingBottom: verticalScale(0) }]}>
                        <View style={[styles.metaCol, { flex: 2 }]}>
                            <Text style={styles.metaLabel}>START TIME</Text>
                            <Text style={styles.metaValue}>{formatDate(item.start_time_display || item.start_time || item.create_dt)}</Text>
                        </View>
                        <View style={[styles.metaCol, { flex: 2 }]}>
                            <Text style={styles.metaLabel}>END TIME</Text>
                            <Text style={styles.metaValue}>{formatDate(item.end_time_display || item.end_time)}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const KpiPill = ({
        label,
        count,
        filter,
        color,
    }: {
        label: string;
        count: number;
        filter: string;
        color: string;
    }) => (
        <TouchableOpacity
            style={[
                styles.kpiPill,
                severityFilter === filter && { borderColor: color, backgroundColor: color + '18' },
            ]}
            onPress={() => setSeverityFilter(filter)}
        >
            <Text style={[styles.kpiCount, { color }]}>{count}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
        </TouchableOpacity>
    );

    // ─── Render ───────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="Alarms Feed"
                    subtitle={`Live Monitoring (${filteredAlarms.length})`}
                    leftAction="back"
                    onLeftPress={() => navigation.goBack()}
                    rightActions={[
                        { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                        
                    ]}
                />

                
      



                {/* Filter bar */}
                <View style={styles.filterWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterBar}
                    >
                        {[
                            { key: 'all', label: 'All Alarms' },
                            { key: 'Open', label: 'Active' },
                            { key: 'Closed', label: 'Closed' },
                        ].map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filterBtn,
                                    severityFilter === f.key && styles.filterBtnActive,
                                ]}
                                onPress={() => setSeverityFilter(f.key)}
                            >
                                <Text
                                    style={[
                                        styles.filterBtnText,
                                        severityFilter === f.key && { color: '#fff' },
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Search bar */}
                <View style={styles.searchContainer}>
                    <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search site, ID or alarm…"
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <AppIcon name="x" size={18} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* List */}
                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#1e3c72" />
                        <Text style={styles.loadingText}>Fetching Alarms…</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredAlarms}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={renderAlarmCard}
                        contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    fetchAllAlarms(true);
                                }}
                            />
                        }
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyContainer}>
                                    <AppIcon name="bell-off" size={48} color="#cbd5e1" />
                                    <Text style={styles.emptyText}>No Alarms Found</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Try changing the filter or refreshing.
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#eef2f7' },

    // KPI strip
    kpiStrip: {
        flexDirection: 'row',
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        backgroundColor: '#fff',
        gap: 8,
        flexWrap: 'wrap',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    kpiPill: {
        alignItems: 'center',
        paddingHorizontal: moderateScale(14),
        paddingVertical: verticalScale(8),
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        minWidth: 60,
    },
    kpiCount: { fontSize: responsiveFontSize(20), flexShrink: 1, fontWeight: '800' },
    kpiLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: verticalScale(2) },

    // Filter
    filterWrapper: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    filterBar: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), gap: 8, flexGrow: 1 },
    filterBtn: {
        paddingHorizontal: moderateScale(16),
        paddingVertical: verticalScale(8),
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterBtnActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    filterBtnText: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#475569' },

    // Search
    searchContainer: {
        backgroundColor: '#fff',
        marginHorizontal: moderateScale(14),
        marginTop: verticalScale(10),
        paddingHorizontal: moderateScale(14),
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        height: verticalScale(48),
    },
    searchIcon: { marginRight: moderateScale(10) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', height: '100%', padding: moderateScale(0) },

    // Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: moderateScale(16),
        marginBottom: verticalScale(12),
        borderLeftWidth: 5,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(8) },
    siteName: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '600', color: '#64748b' },
    siteId: { fontSize: responsiveFontSize(16), flexShrink: 1, color: '#1e293b', marginTop: verticalScale(2), fontWeight: '800' },
    badge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(5), borderRadius: 8 },
    badgeText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', letterSpacing: 0.3 },

    alarmDesc: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '500', color: '#475569', lineHeight: 20, marginBottom: verticalScale(12) },

    // Meta grid
    metadataContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: moderateScale(12),
        gap: moderateScale(10),
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    metaRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: verticalScale(10),
    },
    metaCol: { flex: 1, gap: 4 },
    metaLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
    metaValue: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#334155', fontWeight: '700' },

    siteStatusBadge: {
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: verticalScale(2),
    },
    siteStatusText: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800' },

    // Utils
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(80) },
    loadingText: { marginTop: verticalScale(12), fontSize: responsiveFontSize(15), flexShrink: 1, color: '#64748b' },

    emptyContainer: { alignItems: 'center', marginTop: verticalScale(80) },
    emptyText: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '700', color: '#334155', marginTop: verticalScale(12) },
    emptySubtitle: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(4) },
});


