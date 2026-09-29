import React, { useEffect, useState, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert,
    TextInput, ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

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

export default function UptimeDetailsScreen({ route, navigation }: any) {
    const { state_id, state_name } = route.params || { state_id: '21', state_name: 'Uptime Details' };

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);

    useEffect(() => {
        fetchUptime();
    }, [state_id]);

    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const fetchUptime = async () => {
        if (!refreshing) setLoading(true);
        try {
            const params = {
                state_id: state_id,
                start_date: formatDate(startDate),
                end_date: formatDate(endDate)
            };
            const res = await api.getUptimeDetails(params);

            if (res) {
                setData(res);
            } else {
                setData({ total_sites: 0, sites_data: {} });
            }
        } catch (e: any) {
            console.error("Fetch Error:", e);
            Alert.alert("Data Error", "Uptime data fetch karne mein samasya aayi.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleExport = async () => {
        if (!data?.sites_data) {
            Alert.alert("No Data", "Export ke liye koi data nahi hai.");
            return;
        }
        setExporting(true);
        try {
            const exportData = Object.entries(data.sites_data).map(([id, details]: [string, any]) => ({
                id,
                ...details,
                // Flatten downtime periods for visibility if needed, or just export basic site info
                downtime_count: details.downtime_periods?.length || 0
            }));
            
            const csvString = convertToCSV(exportData);
            const fileName = `Uptime_Details_${state_name.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Export Uptime Details',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Export fail ho gaya.");
            }
        } finally {
            setExporting(false);
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date, isStart: boolean = true) => {
        if (isStart) {
            setShowStartPicker(false);
            if (selectedDate) setStartDate(selectedDate);
        } else {
            setShowEndPicker(false);
            if (selectedDate) setEndDate(selectedDate);
        }
    };

    const filteredSites = useMemo(() => {
        if (!data?.sites_data) return [];
        let sites = Object.entries(data.sites_data).map(([id, details]: [string, any]) => ({ id, ...details }));

        if (filter === 'met') sites = sites.filter(s => s.sla_met);
        if (filter === 'not-met') sites = sites.filter(s => !s.sla_met);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            sites = sites.filter(s =>
                s.id.toLowerCase().includes(q) ||
                s.imei.toLowerCase().includes(q)
            );
        }

        return sites;
    }, [data, filter, searchQuery]);

    const toggleExpand = (id: string) => {
        setExpandedSiteId(expandedSiteId === id ? null : id);
    };

    const renderSiteCard = ({ item, index }: { item: any, index: number }) => {
        const isExpanded = expandedSiteId === item.id;
        
        return (
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => toggleExpand(item.id)}
                style={[styles.compactCard, { borderLeftColor: item.sla_met ? '#2E7D32' : '#C62828' }]}
            >
                <Animatable.View animation="fadeInUp" delay={index * 10}>
                    <View style={styles.cardHeader}>
                        <View style={styles.siteInfo}>
                            <Text style={styles.siteIdText}>Global ID: {item.id}</Text>
                            <Text style={styles.imeiText}>{item.imei}</Text>
                        </View>
                        <View style={styles.uptimeCol}>
                            <Text style={[styles.cardUpVal, { color: item.sla_met ? '#2E7D32' : '#C62828' }]}>
                                {item.uptime_percent}%
                            </Text>
                            <Text style={[styles.metBadgeText, { color: item.sla_met ? '#2E7D32' : '#C62828' }]}>
                                {item.sla_met ? 'SLA MET' : 'NOT MET'}
                            </Text>
                        </View>
                        <AppIcon name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
                    </View>

                    {isExpanded && (
                        <View style={styles.expandedContent}>
                            <View style={styles.divider} />
                            
                            <View style={styles.portalMetricsRow}>
                                <View style={styles.portalMetricItem}>
                                    <Text style={styles.portalMetricLabel}>SLA Target (%)</Text>
                                    <Text style={styles.portalMetricValue}>{item.sla_target}%</Text>
                                </View>
                                <View style={styles.portalMetricItem}>
                                    <Text style={styles.portalMetricLabel}>Actual Uptime (%)</Text>
                                    <Text style={[styles.portalMetricValue, { color: item.sla_met ? '#2E7D32' : '#C62828' }]}>
                                        {item.uptime_percent}%
                                    </Text>
                                </View>
                            </View>

                            {item.downtime_periods && item.downtime_periods.length > 0 ? (
                                <View style={styles.downtimeSection}>
                                    <View style={styles.downtimeHeader}>
                                        <AppIcon name="clock" size={14} color="#64748b" />
                                        <Text style={styles.downtimeTitle}>Downtime History ({item.downtime_periods.length})</Text>
                                    </View>
                                    {item.downtime_periods.map((p: any, i: number) => (
                                        <View key={i} style={styles.downtimeItem}>
                                            <View style={styles.downtimeMain}>
                                                <Text style={styles.downtimeCause}>{p.cause_name || 'System Alert'}</Text>
                                                <Text style={styles.durationText}>{p.minutes}m</Text>
                                            </View>
                                            <Text style={styles.timeText}>{p.start} → {p.end}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.noDowntime}>
                                    <Text style={styles.noDowntimeText}>No downtime recorded</Text>
                                </View>
                            )}
                        </View>
                    )}
                </Animatable.View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title={state_name}
                subtitle={`Overall: ${data?.avg_uptime || 0}%`}
                leftAction="back"
                onLeftPress={() => navigation.goBack()}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    { icon: 'refresh-cw', onPress: fetchUptime }
                ]}
            />

            <View style={[styles.dateSelectorRow, { backgroundColor: '#1e3c72', marginHorizontal: moderateScale(12), marginTop: verticalScale(12) }]}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.dateBtnText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                <AppIcon name="arrow-right" size={12} color="rgba(255,255,255,0.4)" />
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.dateBtnText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={fetchUptime}>
                    <Text style={styles.applyBtnText}>SEARCH</Text>
                </TouchableOpacity>
            </View>

            {showStartPicker && (
                <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => handleDateChange(e, d, true)} maximumDate={endDate} />
            )}
            {showEndPicker && (
                <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => handleDateChange(e, d, false)} minimumDate={startDate} maximumDate={new Date()} />
            )}

            <View style={styles.summaryOverview}>
                <View style={styles.overviewItem}>
                    <Text style={styles.overviewVal}>{data?.total_sites || 0}</Text>
                    <Text style={styles.overviewLab}>Sites</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={[styles.overviewItem]}>
                    <Text style={[styles.overviewVal, { color: '#2e7d32' }]}>{data?.sites_met || 0}</Text>
                    <Text style={styles.overviewLab}>SLA Met</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                    <Text style={[styles.overviewVal, { color: '#c62828' }]}>{data?.sites_not_met || 0}</Text>
                    <Text style={styles.overviewLab}>Not Met</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by ID or IMEI..."
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

            <View style={styles.tabSection}>
                <View style={styles.tabContainer}>
                    {['all', 'met', 'not-met'].map((f) => (
                        <TouchableOpacity 
                            key={f} 
                            onPress={() => setFilter(f)} 
                            style={[styles.compactTab, filter === f && styles.compactTabActive]}
                        >
                            <Text style={[styles.compactTabText, filter === f && styles.compactTabTextActive]}>
                                {f === 'all' ? 'All' : f === 'met' ? 'SLA Met' : 'Not Met'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#1e3c72" />
                </View>
            ) : (
                <FlatList
                    data={filteredSites}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSiteCard}
                    contentContainerStyle={styles.scrollList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUptime(); }} colors={['#1e3c72']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <AppIcon name="search" size={35} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No data available</Text>
                        </View>
                    }
                />
            )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    refreshBtn: { padding: moderateScale(4) },
    dateSelectorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e3c72', borderRadius: 10, padding: moderateScale(4), elevation: 2 },
    dateBtn: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(6) },
    dateBtnText: { color: '#fff', fontSize: responsiveFontSize(12), fontWeight: 'bold' },
    applyBtn: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(6), marginLeft: moderateScale(6) },
    applyBtnText: { color: '#1e3c72', fontSize: responsiveFontSize(10), fontWeight: 'bold' },

    summaryOverview: { flexDirection: 'row', backgroundColor: '#fff', margin: moderateScale(12), borderRadius: 12, padding: moderateScale(10), elevation: 2, alignItems: 'center', justifyContent: 'space-around' },
    overviewItem: { alignItems: 'center', flex: 1 },
    overviewVal: { fontSize: responsiveFontSize(18), fontWeight: 'bold', color: '#1e3c72' },
    overviewLab: { fontSize: responsiveFontSize(8), color: '#64748b', textTransform: 'uppercase', marginTop: verticalScale(2) },
    overviewDivider: { width: 1, height: verticalScale(25), backgroundColor: '#e2e8f0' },

    tabSection: { paddingHorizontal: moderateScale(12), marginBottom: verticalScale(8) },
    tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: moderateScale(2) },
    compactTab: { flex: 1, paddingVertical: verticalScale(5), alignItems: 'center', borderRadius: 6 },
    compactTabActive: { backgroundColor: '#fff', elevation: 1 },
    compactTabText: { fontSize: responsiveFontSize(10), fontWeight: 'bold', color: '#64748b' },
    compactTabTextActive: { color: '#1e3c72' },

    scrollList: { paddingHorizontal: moderateScale(12), paddingBottom: verticalScale(20) },
    compactCard: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), marginBottom: verticalScale(10), elevation: 1, borderLeftWidth: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    siteInfo: { flex: 1 },
    siteIdText: { fontSize: responsiveFontSize(15), fontWeight: 'bold', color: '#334155' },
    imeiText: { fontSize: responsiveFontSize(10), color: '#94a3b8' },
    uptimeCol: { alignItems: 'flex-end', paddingRight: moderateScale(10) },
    cardUpVal: { fontSize: responsiveFontSize(18), fontWeight: 'bold' },
    metBadgeText: { fontSize: responsiveFontSize(8), fontWeight: 'bold', marginTop: verticalScale(2) },

    expandedContent: { marginTop: verticalScale(12) },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    portalMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12), paddingHorizontal: moderateScale(5) },
    portalMetricItem: { flex: 1 },
    portalMetricLabel: { fontSize: responsiveFontSize(10), color: '#64748b', marginBottom: verticalScale(2) },
    portalMetricValue: { fontSize: responsiveFontSize(15), fontWeight: 'bold', color: '#334155' },

    downtimeSection: { backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    downtimeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(8), gap: 5 },
    downtimeTitle: { fontSize: responsiveFontSize(10), fontWeight: 'bold', color: '#475569' },
    downtimeItem: { backgroundColor: '#fff', borderRadius: 8, padding: moderateScale(8), marginBottom: verticalScale(6), elevation: 0.5 },
    downtimeMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(2) },
    downtimeCause: { fontSize: responsiveFontSize(10), fontWeight: 'bold', color: '#1e293b' },
    durationText: { fontSize: responsiveFontSize(10), color: '#ef4444', fontWeight: 'bold' },
    timeText: { fontSize: responsiveFontSize(9), color: '#64748b' },

    noDowntime: { padding: moderateScale(8), alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 6 },
    noDowntimeText: { fontSize: responsiveFontSize(10), color: '#15803d', fontWeight: 'bold' },

    loader: { marginTop: verticalScale(20), alignItems: 'center' },
    empty: { alignItems: 'center', marginTop: verticalScale(40), opacity: 0.5 },
    emptyText: { marginTop: verticalScale(6), fontSize: responsiveFontSize(12), color: '#64748b', fontWeight: 'bold' },

    searchContainer: {
        backgroundColor: '#fff',
        marginHorizontal: moderateScale(12),
        marginBottom: verticalScale(10),
        paddingHorizontal: moderateScale(12),
        borderRadius: 10,
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
});




