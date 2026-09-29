import React, { useState, useEffect, useCallback } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import AppHeader from '../../components/AppHeader';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../../components/AppIcon';
import DateTimePicker from '@react-native-community/datetimepicker';

const screenWidth = Dimensions.get('window').width;

export default function UptimeDashboard({ navigation, route }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(route.params?.tab || 'circle');
    const [listData, setListData] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any>({ compliance: 0, total: 0, met: 0, failed: 0, change: 0, trend: 'neutral' });
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    // Filter States
    const [startDate, setStartDate] = useState(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState(new Date());
    const [season, setSeason] = useState('All');
    const [groupBy, setGroupBy] = useState('Site-wise');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showSeasonModal, setShowSeasonModal] = useState(false);

    // Chart Data
    const [chartData, setChartData] = useState<any>(null);

    useEffect(() => {
        const loadUser = async () => {
            const name = await AsyncStorage.getItem('user_fullname');
            if (name) setFullname(name);
        };
        loadUser();
        fetchDashboardData();
    }, [activeTab, startDate, endDate, season, groupBy]);

    // Handle deep link / sidebar navigation
    useEffect(() => {
        if (route.params?.tab) setActiveTab(route.params.tab);
    }, [route.params?.tab]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const formattedStart = startDate.toISOString().split('T')[0];
            const formattedEnd = endDate.toISOString().split('T')[0];
            
            const filters = {
                start_date: formattedStart,
                end_date: formattedEnd,
                season: season !== 'All' ? season : undefined,
                groupby: groupBy === 'Site-wise' ? 'site' : 'opco'
            };

            const [compRes, trendRes] = await Promise.all([
                api.getSlaCompliance(filters),
                api.getUptimeComparison({ 
                    current_start: filters.start_date, 
                    current_end: filters.end_date 
                })
            ]);

            if (compRes.status === 'success') {
                setKpis({
                    total: compRes.data.total_sites,
                    met: compRes.data.sites_meeting_sla,
                    failed: compRes.data.sites_failing_sla,
                    compliance: compRes.data.compliance_percent,
                    change: (trendRes.status === 'success') ? trendRes.comparison.uptime_change : 0,
                    trend: (trendRes.status === 'success') ? trendRes.comparison.trend : 'neutral'
                });
            }

            // 2. Load Tab Data
            let res: any;
            if (activeTab === 'circle') res = await api.getCircleUptime(filters);
            else if (activeTab === 'opco') res = await api.getOpcoUptime(filters);
            else if (activeTab === 'attribute') res = await api.getAttributeAnalysis(filters);
            else if (activeTab === 'repeat') res = await api.getRepeatOutages(filters, 2);
            else if (activeTab === 'seasonal') res = await api.getSeasonalPreparedness(filters, season);
            else if (activeTab === 'monthly') res = await api.getMonthlyUptimeHistory(filters, filters.groupby);
            else if (activeTab === 'quarterly') res = await api.getQuarterlyUptimeHistory(filters, filters.groupby);

            const data = (res?.data || []).length === undefined ? [] : res.data;
            setListData(data);

            // 3. Prepare Chart Data (Top 10)
            if (data.length > 0) {
                const top10 = data.slice(0, 10);
                setChartData({
                    labels: top10.map((i: any) => {
                        const label = i.site_name || i.circle_name || i.opco_name || i.cause_type || i.month || i.quarter || 'N/A';
                        return label.substring(0, 5);
                    }),
                    datasets: [{ data: top10.map((i: any) => i.uptime_percent || i.outage_count || i.avg_uptime || i.prepared_percent || 0) }]
                });
            } else {
                setChartData(null);
            }
        } catch (e) {
            console.log("Uptime Dashboard Fetch Error", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const quickSelect = (type: string) => {
        const now = new Date();
        if (type === '7days') {
            setStartDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
            setEndDate(now);
        } else if (type === 'prevMonth') {
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = new Date(now.getFullYear(), now.getMonth(), 0);
            setStartDate(first);
            setEndDate(last);
        } else if (type === 'prevQuarter') {
            const q = Math.floor(now.getMonth() / 3);
            const first = new Date(now.getFullYear(), (q - 1) * 3, 1);
            const last = new Date(now.getFullYear(), q * 3, 0);
            setStartDate(first);
            setEndDate(last);
        }
        // No need to call fetchDashboardData here, as the useEffect will trigger on state change
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.tableRow}
            onPress={() => {
                if (activeTab === 'circle' && item.state_id) {
                    navigation.navigate('UptimeSiteDetails', { 
                        state_id: item.state_id, 
                        state_name: item.circle_name,
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0]
                    });
                }
            }}
        >
            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.site_name || item.circle_name || item.opco_name || item.cause_type || item.global_id || item.site_id || 'Unknown'}
                </Text>
                
                {activeTab === 'seasonal' ? (
                    <View>
                        <Text style={styles.rowSub}>Circle: {item.circle_name}</Text>
                        <Text style={styles.rowSub}>Checks: {item.completed_checks}/{item.total_checks} Completed</Text>
                    </View>
                ) : activeTab === 'monthly' || activeTab === 'quarterly' ? (
                    <View>
                        <Text style={styles.rowSub}>Circle: {item.circle || item.circle_name}</Text>
                        <View style={styles.historyRow}>
                           {(item.history || []).slice(0, 3).map((h: any, idx: number) => (
                               <View key={idx} style={styles.historyPill}>
                                   <Text style={styles.historyLabel}>{h.period || h.month || h.quarter}</Text>
                                   <Text style={[styles.historyVal, { color: h.uptime >= 99.5 ? '#2ecc71' : '#e74c3c' }]}>{h.uptime}%</Text>
                               </View>
                           ))}
                        </View>
                    </View>
                ) : (
                    <Text style={styles.rowSub}>
                        {activeTab === 'attribute' ? `Downtime: ${item.downtime_hours}h` : 
                         activeTab === 'repeat' ? `Circle: ${item.circle || item.circle_name} | Global ID: ${item.global_id || item.site_id}` : 
                         `Total Sites: ${item.total_sites || item.outage_count}`}
                    </Text>
                )}
                
                {activeTab === 'repeat' && (
                    <Text style={[styles.rowSub, { color: '#e67e22', fontWeight: 'bold' }]}>
                        Total Downtime: {item.downtime_hours}h
                    </Text>
                )}
            </View>

            <View style={styles.rowRight}>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.uptimeValue, { 
                        color: (item.uptime_percent >= 99.5 || item.sla_met || item.avg_uptime >= 99.5 || item.prepared_percent >= 90) ? '#2ecc71' : 
                               (item.uptime_percent >= 98 || item.avg_uptime >= 98) ? '#f39c12' : '#e74c3c' 
                    }]}>
                        {item.uptime_percent !== undefined ? `${item.uptime_percent}%` : 
                         item.avg_uptime !== undefined ? `${item.avg_uptime}%` :
                         item.prepared_percent !== undefined ? `${item.prepared_percent}%` :
                         item.outage_count !== undefined ? `${item.outage_count}` : 'N/A'}
                    </Text>
                    <Text style={styles.valueSub}>
                        {activeTab === 'repeat' ? 'Outage Count' : 
                         activeTab === 'opco' ? `${item.downtime_hours}h Downtime` :
                         activeTab === 'seasonal' ? 'Completion' :
                         activeTab === 'monthly' || activeTab === 'quarterly' ? 'Latest Uptime' :
                         'Avg Uptime'}
                    </Text>
                </View>
                {activeTab === 'circle' && <AppIcon name="chevron-right" size={16} color="#cbd5e1" style={{ marginLeft: moderateScale(10) }} />}
            </View>
        </TouchableOpacity>
    );

    const onDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
        if (type === 'start') {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) setStartDate(selectedDate);
        } else {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) setEndDate(selectedDate);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="Uptime & SLA Analytics"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
            />

            {/* KPI Cards (4-Column Layout like Web) */}
            <View style={{ backgroundColor: '#f1f5f9', paddingVertical: verticalScale(12), paddingHorizontal: moderateScale(12) }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll}>
                    <View style={[styles.kpiBox, { borderTopColor: '#2ecc71' }]}>
                        <Text style={[styles.kpiTextValue, { color: '#2ecc71' }]}>{kpis.compliance}%</Text>
                        <Text style={styles.kpiTitleLabel}>SLA Compliance</Text>
                    </View>
                    <View style={[styles.kpiBox, { borderTopColor: '#1e3c72' }]}>
                        <Text style={[styles.kpiTextValue, { color: '#1e3c72' }]}>{kpis.total}</Text>
                        <Text style={styles.kpiTitleLabel}>Total Sites</Text>
                    </View>
                    <View style={[styles.kpiBox, { borderTopColor: '#2ecc71' }]}>
                        <Text style={[styles.kpiTextValue, { color: '#2ecc71' }]}>{kpis.met}</Text>
                        <Text style={styles.kpiTitleLabel}>Sites Meeting SLA</Text>
                    </View>
                    <View style={[styles.kpiBox, { borderTopColor: '#e74c3c' }]}>
                        <Text style={[styles.kpiTextValue, { color: '#e74c3c' }]}>{kpis.failed}</Text>
                        <Text style={styles.kpiTitleLabel}>Sites Failing SLA</Text>
                    </View>
                </ScrollView>
            </View>

            <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
                {/* Top Section Container (Non-sticky part) */}
                <View>
                    {/* Advanced Filter Section */}
                    <View style={styles.filterSection}>
                        <View style={styles.dateControlRow}>
                            <TouchableOpacity style={styles.dateInputWrapper} onPress={() => setShowStartPicker(true)}>
                                <Text style={styles.filterLabelSmall}>Start Date</Text>
                                <Text style={styles.filterValueText}>{startDate.toISOString().split('T')[0]}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateInputWrapper} onPress={() => setShowEndPicker(true)}>
                                <Text style={styles.filterLabelSmall}>End Date</Text>
                                <Text style={styles.filterValueText}>{endDate.toISOString().split('T')[0]}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateInputWrapper} onPress={() => setShowSeasonModal(true)}>
                                <Text style={styles.filterLabelSmall}>Season Filter</Text>
                                <Text style={styles.filterValueText}>{season}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.filterLabelSec}>QUICK SELECT PERIOD</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSelectScroll}>
                            <TouchableOpacity style={styles.qsBtn} onPress={() => quickSelect('7days')}><Text style={styles.qsText}>Last 7 Days</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.qsBtn} onPress={() => quickSelect('prevMonth')}><Text style={styles.qsText}>Prev Month</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.qsBtn} onPress={() => quickSelect('prevQuarter')}><Text style={styles.qsText}>Prev Quarter</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.qsBtn} onPress={() => setActiveTab('monthly')}><Text style={styles.qsText}>Monthly History</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.qsBtn} onPress={() => setActiveTab('quarterly')}><Text style={styles.qsText}>Quarterly History</Text></TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity style={styles.applyBtnLarge} onPress={fetchDashboardData}>
                            <AppIcon name="filter" color="#fff" size={16} style={{ marginRight: moderateScale(8) }} />
                            <Text style={styles.applyBtnText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Group By Selector (for Monthly/Quarterly) */}
                    {(activeTab === 'monthly' || activeTab === 'quarterly') && (
                        <View style={styles.groupSection}>
                            <Text style={styles.groupLabel}>Group by</Text>
                            <View style={styles.groupButtons}>
                                <TouchableOpacity 
                                    style={[styles.groupBtn, groupBy === 'Site-wise' && styles.groupBtnActive]} 
                                    onPress={() => setGroupBy('Site-wise')}
                                >
                                    <Text style={[styles.groupBtnText, groupBy === 'Site-wise' && styles.groupBtnTextActive]}>Site-wise</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.groupBtn, groupBy === 'OPCO-wise' && styles.groupBtnActive]} 
                                    onPress={() => setGroupBy('OPCO-wise')}
                                >
                                    <Text style={[styles.groupBtnText, groupBy === 'OPCO-wise' && styles.groupBtnTextActive]}>OPCO-wise</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Tab Menu - Sticky Header Item */}
                <View style={styles.tabBarContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                        {[
                            { id: 'circle', label: 'Circle-wise', icon: 'map-pin' },
                            { id: 'opco', label: 'OPCO-wise', icon: 'users' },
                            { id: 'attribute', label: 'Attributes', icon: 'activity' },
                            { id: 'repeat', label: 'Repeat Outages', icon: 'repeat' },
                            { id: 'seasonal', label: 'Seasonal', icon: 'sun' },
                            { id: 'monthly', label: 'Monthly History', icon: 'calendar' },
                            { id: 'quarterly', label: 'Quarterly History', icon: 'layers' }
                        ].map(t => (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.tabItem, activeTab === t.id && styles.activeTabItem]}
                                onPress={() => setActiveTab(t.id)}
                            >
                                <AppIcon name={t.icon as any} size={14} color={activeTab === t.id ? '#fff' : '#64748b'} />
                                <Text style={[styles.tabItemText, activeTab === t.id && styles.activeTabItemText]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Compliance Pie Chart */}
                {!loading && (
                    <View style={styles.chartArea}>
                        <View style={styles.chartInfo}>
                           <Text style={styles.chartAreaTitle}>SLA Compliance Distribution</Text>
                           <Text style={styles.chartAreaSub}>{groupBy} trend over period</Text>
                        </View>
                        <PieChart
                            data={[
                                { name: 'Meeting SLA', population: kpis.met, color: '#2ecc71', legendFontColor: '#7F7F7F', legendFontSize: 12 },
                                { name: 'Failing SLA', population: kpis.failed, color: '#e74c3c', legendFontColor: '#7F7F7F', legendFontSize: 12 }
                            ]}
                            width={screenWidth - 40}
                            height={160}
                            chartConfig={{ color: (opacity = 1) => `rgba(0,0,0, ${opacity})` }}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            absolute
                        />
                    </View>
                )}

                {/* Data List */}
                <View style={styles.listArea}>
                    <View style={styles.listAreaHeader}>
                        <Text style={styles.listAreaTitle}>{activeTab.replace('-', ' ').toUpperCase()} RECORDS</Text>
                        <Text style={styles.listAreaCount}>{listData.length} records</Text>
                    </View>
                    
                    {loading ? (
                        <ActivityIndicator color="#1e3c72" size="large" style={{ marginVertical: verticalScale(30) }} />
                    ) : (
                        <View style={styles.dataCardWrap}>
                            {listData.length > 0 ? (
                                listData.map((item, index) => <View key={index}>{renderItem({ item })}</View>)
                            ) : (
                                <View style={styles.noData}>
                                    <AppIcon name="database" size={40} color="#cbd5e1" />
                                    <Text style={styles.noDataText}>No records found</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
                <View style={{ height: verticalScale(100) }} />
            </ScrollView>

            {/* Date Pickers */}
            {showStartPicker && <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'start')} />}
            {showEndPicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => onDateChange(e, d, 'end')} />}

            {/* Season Modal */}
            <Modal visible={showSeasonModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Season</Text>
                        {['All', 'Summer', 'Monsoon', 'Winter'].map(s => (
                            <TouchableOpacity key={s} style={styles.modalOption} onPress={() => { setSeason(s); setShowSeasonModal(false); }}>
                                <Text style={[styles.optionText, season === s && { color: '#1e3c72', fontWeight: 'bold' }]}>{s}</Text>
                                {season === s && <AppIcon name="check" size={18} color="#1e3c72" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            <Sidebar
                isVisible={isSidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation}
                fullname={fullname} activeRoute="UptimeDashboard"
                handleLogout={async () => { await AsyncStorage.removeItem('user_fullname'); await logoutApi(); navigation.replace('Login'); }}
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    kpiScroll: { flexDirection: 'row', marginHorizontal: -5 },
    kpiBox: { backgroundColor: '#fff', borderRadius: 10, padding: moderateScale(12), marginRight: moderateScale(10), width: moderateScale(120), borderTopWidth: 4, elevation: 3, alignItems: 'center' },
    kpiTextValue: { fontSize: responsiveFontSize(22), fontWeight: 'bold', color: '#1e3c72', marginBottom: verticalScale(4) },
    kpiTitleLabel: { fontSize: responsiveFontSize(9), color: '#64748b', marginTop: verticalScale(2), textTransform: 'uppercase', textAlign: 'center' },
    
    filterSection: { backgroundColor: '#fff', margin: moderateScale(15), padding: moderateScale(15), borderRadius: 15, elevation: 4 },
    dateControlRow: { flexDirection: 'row', gap: 10, marginBottom: verticalScale(15) },
    dateInputWrapper: { flex: 1, backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    filterLabelSmall: { fontSize: responsiveFontSize(9), color: '#94a3b8', textTransform: 'uppercase', marginBottom: verticalScale(2) },
    filterValueText: { fontSize: responsiveFontSize(12), color: '#1e3c72', fontWeight: 'bold' },
    filterLabelSec: { fontSize: responsiveFontSize(11), fontWeight: 'bold', color: '#64748b', marginBottom: verticalScale(10) },
    quickSelectScroll: { flexDirection: 'row', marginBottom: verticalScale(15) },
    qsBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: moderateScale(15), paddingVertical: verticalScale(8), borderRadius: 20, marginRight: moderateScale(8) },
    qsText: { fontSize: responsiveFontSize(11), color: '#475569', fontWeight: '600' },
    applyBtnLarge: { backgroundColor: '#1e3c72', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: moderateScale(14), borderRadius: 10 },
    applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: responsiveFontSize(14) },

    groupSection: { backgroundColor: '#fff', marginHorizontal: moderateScale(15), paddingHorizontal: moderateScale(15), paddingBottom: verticalScale(15), borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginTop: -15 },
    groupLabel: { fontSize: responsiveFontSize(11), fontWeight: 'bold', color: '#64748b', marginBottom: verticalScale(8) },
    groupButtons: { flexDirection: 'row', gap: 10 },
    groupBtn: { flex: 1, padding: moderateScale(10), borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
    groupBtnActive: { backgroundColor: '#1e3c72' },
    groupBtnText: { fontSize: responsiveFontSize(12), color: '#64748b', fontWeight: '600' },
    groupBtnTextActive: { color: '#fff' },

    tabBarContainer: { backgroundColor: '#f0f2f5', paddingVertical: verticalScale(10), borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabScroll: { paddingHorizontal: moderateScale(15) },
    tabItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(15), paddingVertical: verticalScale(10), borderRadius: 25, backgroundColor: '#fff', marginRight: moderateScale(10), elevation: 1 },
    activeTabItem: { backgroundColor: '#1e3c72' },
    tabItemText: { fontSize: responsiveFontSize(12), color: '#64748b', fontWeight: 'bold', marginLeft: moderateScale(6) },
    activeTabItemText: { color: '#fff' },

    chartArea: { backgroundColor: '#fff', margin: moderateScale(15), borderRadius: 15, padding: moderateScale(15), elevation: 3 },
    chartInfo: { marginBottom: verticalScale(15) },
    chartAreaTitle: { fontSize: responsiveFontSize(14), fontWeight: 'bold', color: '#1e3c72' },
    chartAreaSub: { fontSize: responsiveFontSize(10), color: '#94a3b8' },

    listArea: { paddingHorizontal: moderateScale(15) },
    listAreaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(12) },
    listAreaTitle: { fontSize: responsiveFontSize(13), fontWeight: 'bold', color: '#64748b' },
    listAreaCount: { fontSize: responsiveFontSize(12), color: '#94a3b8' },
    dataCardWrap: { backgroundColor: '#fff', borderRadius: 15, elevation: 3, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', justifyContent: 'space-between', padding: moderateScale(15), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
    rowTitle: { fontSize: responsiveFontSize(14), fontWeight: '900', color: '#1e293b' },
    rowSub: { fontSize: responsiveFontSize(11), color: '#64748b', marginTop: verticalScale(3) },
    historyRow: { flexDirection: 'row', gap: 6, marginTop: verticalScale(8) },
    historyPill: { backgroundColor: '#f8fafc', padding: moderateScale(5), borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 60, alignItems: 'center' },
    historyLabel: { fontSize: responsiveFontSize(9), color: '#94a3b8', textTransform: 'uppercase' },
    historyVal: { fontSize: responsiveFontSize(10), fontWeight: 'bold' },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    uptimeValue: { fontSize: responsiveFontSize(16), fontWeight: 'bold' },
    valueSub: { fontSize: responsiveFontSize(9), color: '#94a3b8', marginTop: verticalScale(2), fontWeight: 'bold', textTransform: 'uppercase' },
    noData: { padding: moderateScale(40), alignItems: 'center' },
    noDataText: { marginTop: verticalScale(10), color: '#94a3b8', fontSize: responsiveFontSize(13) },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: moderateScale(25) },
    modalTitle: { fontSize: responsiveFontSize(18), fontWeight: 'bold', marginBottom: verticalScale(20), color: '#1e3c72' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(15), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    optionText: { fontSize: responsiveFontSize(16), color: '#475569' }
});