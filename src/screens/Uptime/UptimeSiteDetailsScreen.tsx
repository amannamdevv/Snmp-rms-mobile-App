import React, { useState, useEffect, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, FlatList, RefreshControl, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

let width = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') width = _d.width; } catch(_) {}

export default function UptimeSiteDetails({ route, navigation }: any) {
    const { state_id, state_name, start_date: initialStart, end_date: initialEnd } = route.params;
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sites, setSites] = useState<any[]>([]);
    const [filteredSites, setFilteredSites] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Date Filters
    const [startDate, setStartDate] = useState(new Date(initialStart || Date.now() - 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState(new Date(initialEnd || Date.now()));
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const [stats, setStats] = useState({
        total: 0,
        met: 0,
        failed: 0,
        avgUptime: 0,
        outages: 0,
        downtime: 0
    });

    useEffect(() => {
        fetchSiteDetails();
    }, [state_id]);

    const fetchSiteDetails = async () => {
        setLoading(true);
        try {
            const formattedStart = startDate.toISOString().split('T')[0];
            const formattedEnd = endDate.toISOString().split('T')[0];

            // Get active filters from storage
            const savedFilters = await AsyncStorage.getItem('persistentFilters');
            const filters = savedFilters ? JSON.parse(savedFilters) : {};
            
            const res = await api.getSiteWiseUptime({
                ...filters,
                circle_id: state_id,
                start_date: formattedStart,
                end_date: formattedEnd
            });

            if (res.status === 'success') {
                const data = res.data || [];
                setSites(data);
                setFilteredSites(data);
                calculateStats(data);
            }
        } catch (e) {
            console.error("Fetch Site Details Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStats = (data: any[]) => {
        if (!data.length) {
            setStats({ total: 0, met: 0, failed: 0, avgUptime: 0, outages: 0, downtime: 0 });
            return;
        }
        const total = data.length;
        const met = data.filter(s => s.sla_met).length;
        const sumUptime = data.reduce((acc, s) => acc + (s.uptime_percent || 0), 0);
        const outages = data.reduce((acc, s) => acc + (s.outage_count || 0), 0);
        const downtime = data.reduce((acc, s) => acc + (s.downtime_hours || 0), 0);

        setStats({
            total,
            met,
            failed: total - met,
            avgUptime: parseFloat((sumUptime / total).toFixed(2)),
            outages,
            downtime: parseFloat(downtime.toFixed(2))
        });
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredSites(sites);
            return;
        }
        const filtered = sites.filter(s => 
            s.global_id?.toString().includes(text) ||
            s.site_id?.toString().includes(text) ||
            s.site_name?.toLowerCase().includes(text.toLowerCase()) || 
            s.imei?.toString().includes(text)
        );
        setFilteredSites(filtered);
    };

    const resetDates = () => {
        setStartDate(new Date(initialStart || Date.now() - 30 * 24 * 60 * 60 * 1000));
        setEndDate(new Date(initialEnd || Date.now()));
        // Trigger fetch will happen after re-render if I don't call it manually, but we need to ensure local values are used
    };

    const onDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
        if (type === 'start') {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) setStartDate(selectedDate);
        } else {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) setEndDate(selectedDate);
        }
    };

    const getUptimeColor = (up: number) => {
        if (up >= 99.5) return '#2ecc71';
        if (up >= 99) return '#3498db';
        if (up >= 98) return '#f1c40f';
        return '#e74c3c';
    };

    const renderSiteCard = ({ item }: { item: any }) => {
        const up = item.uptime_percent || 0;
        const color = getUptimeColor(up);

        return (
            <View style={styles.siteCard}>
                <View style={styles.cardTop}>
                    <View style={[styles.uptimeRing, { borderColor: color + '33' }]}>
                        <Text style={[styles.uptimePercent, { color }]}>{up}%</Text>
                    </View>
                    <View style={styles.siteInfo}>
                        <Text style={styles.siteName} numberOfLines={1}>{item.site_name}</Text>
                        <Text style={styles.siteId}>Global ID: {item.global_id || item.site_id} | {item.imei}</Text>
                        <View style={[styles.slaBadge, { backgroundColor: item.sla_met ? '#2ecc71' : '#e74c3c' }]}>
                            <Text style={styles.slaText}>{item.sla_met ? 'SLA MET' : 'SLA FAILED'}</Text>
                        </View>
                    </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                        <Text style={styles.metricVal}>{item.outage_count || 0}</Text>
                        <Text style={styles.metricLab}>Outages</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricVal}>{item.downtime_hours || 0}</Text>
                        <Text style={styles.metricLab}>Down Hrs</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricVal}>{item.sla_target || 99.5}%</Text>
                        <Text style={styles.metricLab}>Target</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title={state_name}
                leftAction="back"
                onLeftPress={() => navigation.goBack()}
            />
            {/* Stats strip below header */}
            <View style={styles.statsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
                    <View style={[styles.statPill, { borderTopColor: '#3498db' }]}>
                        <Text style={styles.statVal}>{stats.total}</Text>
                        <Text style={styles.statLab}>Total Sites</Text>
                    </View>
                    <View style={[styles.statPill, { borderTopColor: '#2ecc71' }]}>
                        <Text style={styles.statVal}>{stats.met}</Text>
                        <Text style={styles.statLab}>SLA Met</Text>
                    </View>
                    <View style={[styles.statPill, { borderTopColor: '#e74c3c' }]}>
                        <Text style={styles.statVal}>{stats.failed}</Text>
                        <Text style={styles.statLab}>SLA Failed</Text>
                    </View>
                    <View style={[styles.statPill, { borderTopColor: '#f1c40f' }]}>
                        <Text style={styles.statVal}>{stats.avgUptime}%</Text>
                        <Text style={styles.statLab}>Avg Uptime</Text>
                    </View>
                    <View style={[styles.statPill, { borderTopColor: '#9b59b6' }]}>
                        <Text style={styles.statVal}>{stats.outages}</Text>
                        <Text style={styles.statLab}>Outages</Text>
                    </View>
                    <View style={[styles.statPill, { borderTopColor: '#e67e22' }]}>
                        <Text style={styles.statVal}>{stats.downtime}</Text>
                        <Text style={styles.statLab}>Downtime (h)</Text>
                    </View>
                </ScrollView>
            </View>
            
            {/* NEW: Date Filters with Apply/Reset Buttons */}
            <View style={styles.filterSection}>
                <View style={styles.datePickerRow}>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
                        <Text style={styles.dateLabel}>Start Date</Text>
                        <Text style={styles.dateValue}>{startDate.toISOString().split('T')[0]}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
                        <Text style={styles.dateLabel}>End Date</Text>
                        <Text style={styles.dateValue}>{endDate.toISOString().split('T')[0]}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.applyBtn} onPress={fetchSiteDetails}>
                        <AppIcon name="filter" size={14} color="#fff" />
                        <Text style={styles.btnText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetDates}>
                        <AppIcon name="rotate-ccw" size={14} color="#1e3c72" />
                        <Text style={[styles.btnText, { color: '#1e3c72' }]}>Reset</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {showStartPicker && (
                <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'start')} />
            )}
            {showEndPicker && (
                <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'end')} />
            )}

            <View style={styles.searchContainer}>
                <AppIcon name="search" size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Global ID or Name..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={handleSearch}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1e3c72" />
                    <Text style={styles.loadingText}>Fetching sites...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredSites}
                    renderItem={renderSiteCard}
                    keyExtractor={(i: any) => i.site_id?.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSiteDetails(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <AppIcon name="info" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No sites found for selected period</Text>
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
    statsContainer: { backgroundColor: '#f1f5f9', paddingVertical: verticalScale(12) },
    statsScroll: { paddingHorizontal: moderateScale(12) },
    statPill: { 
        backgroundColor: '#fff', 
        paddingVertical: verticalScale(12), 
        paddingHorizontal: moderateScale(16), 
        borderRadius: 12, 
        marginHorizontal: moderateScale(6),
        minWidth: 120,
        borderTopWidth: 4,
        elevation: 3,
        alignItems: 'center'
    },
    statVal: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
    statLab: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', textTransform: 'uppercase', marginTop: verticalScale(3), fontWeight: '700' },
    
    // NEW Filter Styles
    filterSection: { backgroundColor: '#fff', padding: moderateScale(16), marginHorizontal: moderateScale(16), marginTop: verticalScale(12), borderRadius: 16, elevation: 4 },
    datePickerRow: { flexDirection: 'row', gap: moderateScale(12), marginBottom: verticalScale(15) },
    dateInput: { flex: 1, backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    dateLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: verticalScale(3), fontWeight: '700' },
    dateValue: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e3c72', fontWeight: '800' },
    actionButtons: { flexDirection: 'row', gap: moderateScale(10) },
    applyBtn: { 
        flex: 2, 
        backgroundColor: '#1e3c72', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: verticalScale(10), 
        borderRadius: 8,
        gap: 6
    },
    resetBtn: { 
        flex: 1, 
        backgroundColor: '#e2e8f0', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: verticalScale(10), 
        borderRadius: 8,
        gap: 6
    },
    btnText: { color: '#fff', fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: 'bold' },

    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#fff', 
        margin: moderateScale(15), 
        paddingHorizontal: moderateScale(15), 
        borderRadius: 12,
        height: verticalScale(48),
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 2
    },
    searchInput: { flex: 1, marginLeft: moderateScale(10), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#334155' },
    listContent: { padding: moderateScale(15), paddingTop: verticalScale(0), paddingBottom: verticalScale(30) },
    siteCard: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(15), marginBottom: verticalScale(15), elevation: 3 },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    uptimeRing: { 
        width: moderateScale(65), 
        height: verticalScale(65), 
        borderRadius: 33, 
        borderWidth: 4, 
        alignItems: 'center', 
        justifyContent: 'center',
        marginRight: moderateScale(15)
    },
    uptimePercent: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: 'bold' },
    siteInfo: { flex: 1 },
    siteName: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: 'bold', color: '#1e293b' },
    siteId: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', marginTop: verticalScale(3) },
    slaBadge: { alignSelf: 'flex-start', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2), borderRadius: 10, marginTop: verticalScale(5) },
    slaText: { color: '#fff', fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: verticalScale(12) },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metric: { flex: 1, alignItems: 'center' },
    metricVal: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: 'bold', color: '#1e3c72' },
    metricLab: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(2) },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: verticalScale(50) },
    loadingText: { marginTop: verticalScale(10), color: '#64748b', fontSize: responsiveFontSize(14), flexShrink: 1, },
    emptyText: { marginTop: verticalScale(10), color: '#94a3b8', textAlign: 'center' }
});