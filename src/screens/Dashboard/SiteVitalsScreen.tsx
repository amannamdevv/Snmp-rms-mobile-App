import React, { useEffect, useState } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, ScrollView, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteVitals'>;

// Helper to convert JSON array to CSV string
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

const VITAL_RANGES = [
    { label: 'All', value: 'all', icon: 'list' },
    { label: 'Critical', value: 'critical', icon: 'alert-circle' },
    { label: 'At Risk', value: 'low', icon: 'shield-off' },
    { label: 'Operational', value: 'normal', icon: 'check-circle' },
    { label: 'Normal', value: 'high', icon: 'trending-up' },
    { label: 'NA', value: 'na', icon: 'help-circle' },
    { label: 'NON-COMM', value: 'noncomm', icon: 'wifi-off' },
];

export default function SiteVitalsScreen({ route, navigation }: Props) {
    const { range } = route.params || {};
    const isSidebar = (route.params as any)?.source === 'sidebar';
    
    const displayRanges = isSidebar
        ? VITAL_RANGES.filter(r => ['critical', 'low', 'normal', 'noncomm'].includes(r.value))
        : VITAL_RANGES;

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(true);
    const [totalSites, setTotalSites] = useState(0);
    const [rangeLabel, setRangeLabel] = useState('All Sites');
    const [searchQuery, setSearchQuery] = useState('');

    const [activeFilters, setActiveFilters] = useState<any>(range ? { range } : {});
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    // Sync filters if range changes from navigation (Sidebar)
    useEffect(() => {
        if (route.params?.range) {
            setActiveFilters((prev: any) => ({ ...prev, range: route.params?.range }));
        }
    }, [route.params?.range]);

    useEffect(() => {
        fetchData(1, true);
    }, [activeFilters]);

    const fetchData = async (pageNum = 1, isRefresh = false) => {
        if (loading && !isRefresh) return;
        setLoading(true);
        try {
            // Choose API based on source param from Sidebar vs Dashboard tab selector
            const src = (route.params as any)?.source || '';
            const r   = (activeFilters.range || range || '');
            let res: any = null;

            if (src === 'sidebar') {
                // Sidebar: use dedicated high-detail APIs
                if      (r === 'low')     res = await api.getSitesAtRisk(activeFilters, pageNum);
                else if (r === 'critical') res = await api.getCriticalSites(activeFilters, pageNum);
                else if (r === 'normal')  res = await api.getOperationalSites(activeFilters, pageNum);
                else if (r === 'noncomm') res = await api.getSiteNonComm(activeFilters, pageNum);
                else                      res = await api.getSiteVitals(activeFilters, pageNum);
            } else {
                // Dashboard tab: simple /api/site-vitals-details/ for all ranges
                res = await api.getSiteVitals(activeFilters, pageNum);
            }

            if (res && res.sites) {
                if (isRefresh) setData(res.sites);
                else setData(prev => [...prev, ...res.sites]);

                setTotalSites(res.total_sites ?? res.total ?? 0);
                setRangeLabel(res.range_label ?? res.category ?? 'Sites');
                setHasNext(res.has_next ?? false);
                setPage(pageNum);
            }
        } catch (e) {
            console.error("Vitals API Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Fetch a comprehensive set for export to respect "Download All"
            const res = await api.getSiteVitals(activeFilters, 1, 10000);
            if (res && res.sites) {
                if (res.sites.length === 0) {
                    Alert.alert("No Data", "There is no data to export with the current filters.");
                    return;
                }
                const csvString = convertToCSV(res.sites);
                const fileName = `Site_Vitals_${new Date().getTime()}.csv`;
                const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

                await RNFS.writeFile(filePath, csvString, 'utf8');
                await Share.open({
                    title: 'Export Site Vitals',
                    url: `file://${filePath}`,
                    type: 'text/csv',
                    filename: fileName,
                    showAppsToView: true,
                });
            }
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Failed to generate or open export data.");
                console.error(error);
            }
        } finally {
            setExporting(false);
        }
    };

    const getVoltageStyle = (voltage: any) => {
        if (!voltage || voltage === '0.00' || isNaN(parseFloat(voltage))) return { color: '#9e9e9e', label: 'NA' };
        const v = parseFloat(voltage);
        if (v <= 47) return { color: '#f44336', label: `${v.toFixed(2)}V` }; // Critical
        if (v <= 49) return { color: '#ff9800', label: `${v.toFixed(2)}V` }; // Low
        if (v <= 54.5) return { color: '#2196f3', label: `${v.toFixed(2)}V` }; // Operational
        return { color: '#4caf50', label: `${v.toFixed(2)}V` }; // High
    };

        const renderCard = ({ item }: { item: any }) => {
        const src      = (route.params as any)?.source || '';
        const isSidebar = src === 'sidebar';

        // ── Common fields ──────────────────────────────────────────────────────
        const vStyle   = getVoltageStyle(item.battery_v || item.battery_voltage || item.battery_v_display);
        const siteId   = item.site_id || '-';
        const siteName = item.site_name || 'Unnamed Site';
        const imei     = item.imei || '-';
        const districtName = item.district_name || item.dist_name || '';
        const location = [item.state_name, districtName, item.cluster_name].filter(Boolean).join(' / ') || 'N/A';

        if (!isSidebar) {
            // ── DASHBOARD: simple card (matches /api/site-vitals-details/ fields) ─
            const lastComm = item.last_communication || item.last_update
                ? new Date(item.last_communication || item.last_update).toLocaleString()
                : 'N/A';

            return (
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
                    activeOpacity={0.85}
                >
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1, paddingRight: moderateScale(8) }}>
                            <Text style={styles.siteName} numberOfLines={1}>{siteName}</Text>
                            <View style={styles.idRow}>
                                <Text style={styles.globalIdBadge}>{siteId}</Text>
                                <Text style={styles.imeiText}> | IMEI: {imei}</Text>
                            </View>
                        </View>
                        <View style={[styles.voltageBox, { borderColor: vStyle.color + '40', backgroundColor: vStyle.color + '12' }]}>
                            <Text style={[styles.voltageText, { color: vStyle.color }]}>{vStyle.label}</Text>
                            <Text style={styles.miniLabel}>Battery V</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.fieldRow}>
                        <AppIcon name="map-pin" size={moderateScale(11)} color="#64748b" />
                        <Text style={styles.fieldLabel}> Location: </Text>
                        <Text style={styles.fieldValue} numberOfLines={1}>{location}</Text>
                    </View>

                    <View style={styles.fieldRow}>
                        <AppIcon name="clock" size={moderateScale(11)} color="#64748b" />
                        <Text style={styles.fieldLabel}> Last Comm: </Text>
                        <Text style={styles.fieldValue} numberOfLines={1}>{lastComm}</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        // ── SIDEBAR: detailed card (from /api/sites-at-risk/, /api/operational-sites/ etc.) ─
        const globalId = item.globel_id || item.global_id || siteId;

        const rawSoc     = item.soc_percent ?? item.soc ?? item.battery_soc ?? null;
        const socVal     = rawSoc != null ? parseFloat(String(rawSoc)) : -1;
        const socLabel   = socVal >= 0 ? `${socVal.toFixed(1)}%` : 'N/A';
        const socColor   = socVal < 0 ? '#94a3b8' : socVal < 30 ? '#f44336' : socVal < 50 ? '#ff9800' : '#4caf50';

        const rawCurrent    = item.battery_current ?? item.current ?? null;
        const currentLabel  = rawCurrent != null ? `${parseFloat(String(rawCurrent)).toFixed(2)} A` : 'N/A';

        const rawUpdate     = item.last_update || item.last_communication || item.updated_at || null;
        const updateLabel   = rawUpdate ? new Date(rawUpdate).toLocaleString() : 'N/A';

        // Temperature (for operational sites)
        const rawTemp    = item.temperature ?? item.temp ?? null;
        const tempLabel  = rawTemp != null ? `${rawTemp}°C` : 'N/A';
        const hasTemp    = rawTemp != null;

        const predFailure = item.predicted_failure || null;
        const predColor   = predFailure === 'Insufficient data' ? '#64748b' : '#ef4444';

        const hasAlarms   = Array.isArray(item.recent_alarms) && item.recent_alarms.length > 0;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
                activeOpacity={0.85}
            >
                {/* HEADER */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, paddingRight: moderateScale(8) }}>
                        <Text style={styles.siteName} numberOfLines={1}>{siteName}</Text>
                        <View style={styles.idRow}>
                            <Text style={styles.globalIdBadge}>{globalId}</Text>
                            <Text style={styles.imeiText}> | IMEI: {imei}</Text>
                        </View>
                    </View>
                    <View style={[styles.voltageBox, { borderColor: vStyle.color + '40', backgroundColor: vStyle.color + '12' }]}>
                        <Text style={[styles.voltageText, { color: vStyle.color }]}>{vStyle.label}</Text>
                        <Text style={styles.miniLabel}>Battery V</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Location */}
                <View style={styles.fieldRow}>
                    <AppIcon name="map-pin" size={moderateScale(12)} color="#64748b" />
                    <Text style={styles.fieldLabel}> Location: </Text>
                    <Text style={styles.fieldValue} numberOfLines={1}>{location}</Text>
                </View>

                {/* Global ID highlighted */}
                <View style={styles.globalIdRow}>
                    <AppIcon name="hash" size={moderateScale(12)} color="#1e3c72" />
                    <Text style={styles.fieldLabel}> Global ID: </Text>
                    <Text style={styles.globalIdValue}>{globalId}</Text>
                </View>

                {/* Battery Current + Last Update 2-col */}
                <View style={styles.twoColRow}>
                    <View style={styles.twoColItem}>
                        <Text style={styles.metaLabel}>⚡ Battery Current</Text>
                        <Text style={[styles.metaValue, { color: rawCurrent != null ? '#1e293b' : '#94a3b8' }]}>{currentLabel}</Text>
                    </View>
                    {hasTemp ? (
                        <View style={[styles.twoColItem, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' }]}>
                            <Text style={styles.metaLabel}>🌡 Temperature</Text>
                            <Text style={[styles.metaValue, { color: rawTemp > 50 ? '#ef4444' : '#1e293b' }]}>{tempLabel}</Text>
                        </View>
                    ) : (
                        <View style={[styles.twoColItem, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' }]}>
                            <Text style={styles.metaLabel}>🕐 Last Update</Text>
                            <Text style={[styles.metaValue, { color: rawUpdate ? '#1e293b' : '#94a3b8' }]} numberOfLines={1}>{updateLabel}</Text>
                        </View>
                    )}
                </View>

                {/* SOC with bar */}
                {socVal >= 0 && (
                    <View style={styles.socSection}>
                        <View style={styles.socHeader}>
                            <AppIcon name="battery" size={moderateScale(12)} color="#64748b" />
                            <Text style={styles.fieldLabel}> Battery SOC</Text>
                            <Text style={[styles.socPercent, { color: socColor }]}>{socLabel}</Text>
                        </View>
                        <View style={styles.socBarBg}>
                            <View style={[styles.socBarFill, { width: `${Math.min(socVal, 100)}%` as any, backgroundColor: socColor }]} />
                        </View>
                    </View>
                )}

                {/* Predicted Failure */}
                {predFailure && (
                    <View style={[styles.predRow, { backgroundColor: predColor + '12', borderColor: predColor + '30' }]}>
                        <AppIcon name="alert-triangle" size={moderateScale(12)} color={predColor} />
                        <Text style={[styles.predText, { color: predColor }]}> Predicted Failure: {predFailure}</Text>
                    </View>
                )}

                {/* Alarms */}
                <View style={[styles.fieldRow, { marginTop: verticalScale(4), paddingTop: verticalScale(5), borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                    <AppIcon name={hasAlarms ? 'bell' : 'bell-off'} size={moderateScale(12)} color={hasAlarms ? '#ef4444' : '#94a3b8'} />
                    <Text style={[styles.fieldValue, { color: hasAlarms ? '#ef4444' : '#94a3b8', fontWeight: '600' }]}>
                        {' '}{hasAlarms ? `${item.recent_alarms.length} Recent Alarm(s)` : 'No recent alarms'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

        const filteredSites = data.filter(item => 
        (item.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.site_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.imei || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="Site Vitals"
                subtitle={rangeLabel}
                leftAction="back"
                onLeftPress={() => navigation.goBack()}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    { icon: 'filter', onPress: () => setFilterModalVisible(true), badge: Object.keys(activeFilters).length > 0 },
                ]}
            />

            <FilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={(f: any) => { setActiveFilters(f); setFilterModalVisible(false); }}
                initialFilters={activeFilters}
            />

            {/* Range Filters */}
            <View style={styles.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: moderateScale(8) }}>
                    {displayRanges.map((r) => {
                        const isActive = (activeFilters.range || 'all') === r.value;
                        return (
                            <TouchableOpacity
                                key={r.value}
                                style={[styles.filterPill, isActive && styles.filterPillActive]}
                                onPress={() => setActiveFilters((prev: any) => ({ ...prev, range: r.value }))}
                                activeOpacity={0.7}
                            >
                                <AppIcon
                                    name={r.icon as any}
                                    size={14}
                                    color={isActive ? '#fff' : '#64748b'}
                                    style={{ marginRight: moderateScale(6) }}
                                />
                                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                                    {r.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by ID, Name or IMEI..."
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

            <View style={{ paddingHorizontal: moderateScale(16), paddingTop: verticalScale(10) }}>
                <Text style={{ fontSize: responsiveFontSize(11), fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    {totalSites} Sites showing in {rangeLabel}
                </Text>
            </View>

            <FlatList
                data={filteredSites}
                keyExtractor={(item, index) => (item.imei || index).toString()}
                renderItem={renderCard}
                contentContainerStyle={{ padding: moderateScale(16) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(1, true)} />}
                onEndReached={() => hasNext && fetchData(page + 1)}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator size="small" color="#1e3c72" style={{ margin: moderateScale(20) }} /> : null}
                ListEmptyComponent={
                    !loading && filteredSites.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <AppIcon name="search" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No Data Found</Text>
                            <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
                        </View>
                    ) : null
                }
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    backBtn: { paddingRight: moderateScale(15) },
    headerSub: { color: '#A9D6E5', fontSize: responsiveFontSize(12) },
    iconBtn: { padding: moderateScale(8), position: 'relative' },
    activeFilterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

    filterBar: { backgroundColor: '#fff', paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8), borderRadius: 20, backgroundColor: '#f1f5f9', marginHorizontal: moderateScale(5), borderWidth: 1, borderColor: '#e2e8f0' },
    filterPillActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    filterText: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#64748b' },
    filterTextActive: { color: '#fff' },

    searchContainer: {
        backgroundColor: '#fff',
        marginHorizontal: moderateScale(16),
        marginTop: verticalScale(12),
        paddingHorizontal: moderateScale(12),
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        height: verticalScale(48),
    },
    searchIcon: { marginRight: moderateScale(8) },
    searchInput: {
        flex: 1,
        fontSize: responsiveFontSize(14),
        color: '#1e293b',
        height: '100%',
        padding: moderateScale(0),
    },
    emptyContainer: { alignItems: 'center', marginTop: verticalScale(50) },
    emptyText: { fontSize: responsiveFontSize(18), fontWeight: '700', color: '#334155', marginTop: verticalScale(12) },
    emptySubtitle: { fontSize: responsiveFontSize(14), color: '#94a3b8', marginTop: verticalScale(4) },

    card: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(14),
        padding: moderateScale(14),
        marginBottom: verticalScale(10),
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

    siteName: { fontSize: responsiveFontSize(17), fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(4) },
    idRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    globalIdBadge: { fontSize: responsiveFontSize(15), fontWeight: '900', color: '#1e3c72' },
    imeiText: { fontSize: responsiveFontSize(13), color: '#64748b', fontWeight: '500' },

    voltageBox: {
        padding: moderateScale(12), borderRadius: moderateScale(10),
        alignItems: 'center', minWidth: moderateScale(78),
        borderWidth: 1,
    },
    voltageText: { fontSize: responsiveFontSize(20), fontWeight: '900' },
    miniLabel: { fontSize: responsiveFontSize(11), color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginTop: verticalScale(2) },

    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: verticalScale(10) },

    fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(5) },
    fieldLabel: { fontSize: responsiveFontSize(13), color: '#64748b', fontWeight: '600' },
    fieldValue: { fontSize: responsiveFontSize(13), color: '#334155', fontWeight: '500', flex: 1 },

    globalIdRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#eff6ff', borderRadius: moderateScale(8),
        paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(5),
        marginBottom: verticalScale(8),
    },
    globalIdValue: { fontSize: responsiveFontSize(16), fontWeight: '900', color: '#1e3c72', letterSpacing: 0.5 },

    twoColRow: {
        flexDirection: 'row', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: moderateScale(8), overflow: 'hidden', marginBottom: verticalScale(8),
    },
    twoColItem: { flex: 1, padding: moderateScale(10), gap: verticalScale(2) },
    metaLabel: { fontSize: responsiveFontSize(11), color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
    metaValue: { fontSize: responsiveFontSize(14), fontWeight: '700' },

    socSection: { marginBottom: verticalScale(8) },
    socHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(4) },
    socPercent: { fontSize: responsiveFontSize(15), fontWeight: '900', marginLeft: 'auto' },
    socBarBg: { height: verticalScale(10), backgroundColor: '#e2e8f0', borderRadius: moderateScale(5), overflow: 'hidden' },
    socBarFill: { height: '100%', borderRadius: moderateScale(5) },

    predRow: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: moderateScale(8), borderWidth: 1,
        paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(5),
        marginBottom: verticalScale(6),
    },
    predText: { fontSize: responsiveFontSize(13), fontWeight: '600' },

    // Legacy
    subText: { fontSize: responsiveFontSize(11), color: '#666' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoCol: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(5), flex: 1 },
    infoValue: { fontSize: responsiveFontSize(11), color: '#444', fontWeight: '500' },
});



