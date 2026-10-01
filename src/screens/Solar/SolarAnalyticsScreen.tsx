import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

function DropdownPicker({ value, options, onSelect, placeholder }: { value: any, options: any[], onSelect: (val: any) => void, placeholder: string }) {
    const [visible, setVisible] = useState(false);
    const [search, setSearch] = useState('');
    
    const selectedOpt = options.find(o => o.value === value);
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(true)} activeOpacity={0.8}>
                <Text style={styles.dropdownTxt} numberOfLines={1}>
                    {selectedOpt ? selectedOpt.label : placeholder}
                </Text>
                <Icon name="chevron-down" size={14} color="#64748b" />
            </TouchableOpacity>
            
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Reading</Text>
                            <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); }} style={{ padding: 4 }}>
                                <Icon name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.searchContainer}>
                            <Icon name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput 
                                style={styles.searchInput}
                                placeholder="Search date/time (e.g. 2026-09-01)..."
                                placeholderTextColor="#94a3b8"
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>

                        <FlatList 
                            data={filteredOptions}
                            keyExtractor={(item, index) => index.toString()}
                            initialNumToRender={20}
                            maxToRenderPerBatch={50}
                            windowSize={10}
                            renderItem={({item}) => (
                                <TouchableOpacity 
                                    style={[styles.modalItem, value === item.value && styles.modalItemActive]}
                                    onPress={() => { onSelect(item.value); setVisible(false); setSearch(''); }}
                                >
                                    <Text style={[styles.modalItemTxt, value === item.value && styles.modalItemTxtActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.emptySearchTxt}>No matching readings found</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}

const SummaryItem = ({ label, value }: { label: string, value: any }) => (
    <View style={styles.summaryItem}>
        <Text style={styles.summaryLbl}>{label}</Text>
        <Text style={styles.summaryVal}>{(value === null || value === undefined || value === '') ? '—' : value}</Text>
    </View>
);

function SiteCard({ item, expanded, onToggle, reportType }: { item: any; expanded: boolean; onToggle: () => void, reportType: string }) {
    const [selectedReadingIdx, setSelectedReadingIdx] = useState<number | null>(null);

    const readings = item.all_readings || [];
    const options = [
        { label: '★ Best available (latest valid value)', value: null },
        ...readings.map((r: any, i: number) => ({
            label: r.created_at,
            value: i
        }))
    ];

    const isBestAvailable = selectedReadingIdx === null;
    const currentReading = isBestAvailable ? null : readings[selectedReadingIdx];
    const source = currentReading || (item.extra || {});

    const mpptInstalled = parseInt(source.mppt_installed || '0', 10);
    const mpptStats = [];
    if (mpptInstalled >= 1) mpptStats.push({ label: 'MPPT-1 ENERGY', value: source.mppt1_energy });
    if (mpptInstalled >= 2) mpptStats.push({ label: 'MPPT-2 ENERGY', value: source.mppt2_energy });
    if (mpptInstalled >= 3) mpptStats.push({ label: 'MPPT-3 ENERGY', value: source.mppt3_energy });
    if (mpptInstalled >= 4) mpptStats.push({ label: 'MPPT-4 ENERGY', value: source.mppt4_energy });
    if (mpptInstalled >= 5) mpptStats.push({ label: 'MPPT-5 ENERGY', value: source.mppt5_energy });

    const stats = [
        { label: 'SOLAR ENERGY (KWH)', value: currentReading ? currentReading.solar_energy : (item.accumulative_data || item.solar_end_kwh) },
        { label: 'RAW START KWH', value: currentReading ? '—' : (item.solar_start_kwh || readings[0]?.solar_energy || '—') },
        { label: 'RAW END KWH', value: currentReading ? '—' : (item.solar_end_kwh || readings[readings.length - 1]?.solar_energy || '—') },
        { label: 'SOLAR VOLTAGE', value: source.solar_voltage },
        { label: 'SOLAR CURRENT', value: source.solar_current },
        { label: 'BATTERY BANK RUN HRS', value: source.solar_bb_rn_hrs === 'def' ? '—' : source.solar_bb_rn_hrs },
        { label: 'EB RUN HRS', value: source.solar_eb_rn_hrs === 'def' ? '—' : source.solar_eb_rn_hrs },
        { label: 'DG RUN HRS', value: source.solar_dg_rn_hrs === 'def' ? '—' : source.solar_dg_rn_hrs },
        { label: 'MPPT INSTALLED', value: source.mppt_installed },
        { label: 'ACTIVE MPPT MODULES', value: source.active_mppt_modules },
        ...mpptStats
    ];

    return (
        <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.9}>
            <View style={styles.cardTop}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.siteName} numberOfLines={1}>{item.site_name || '—'}</Text>
                    <Text style={styles.siteId}>Global ID: <Text style={styles.highlight}>{item.global_id || item.site_id || '—'}</Text>  ·  {item.circle || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={styles.kwhBadge}>
                        <Text style={styles.kwhTxt}>{item.solar_units ?? item.total_solar_units ?? 0} Units</Text>
                    </View>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
                </View>
            </View>

            {/* Front Summary Data (Always Visible) */}
            <View style={styles.summaryGrid}>
                {reportType === 'monthly' ? (
                    <>
                        <SummaryItem label="Installation Date" value={item.solar_installation_date} />
                        <SummaryItem label="Reading Start" value={item.solar_reading_start_date} />
                        <SummaryItem label="Reading End" value={item.solar_reading_end_date} />
                        <SummaryItem label="No. of Days" value={item.solar_no_of_days} />
                        <SummaryItem label="Start KWH" value={item.solar_start_kwh} />
                        <SummaryItem label="End KWH" value={item.solar_end_kwh} />
                        <SummaryItem label="Total Units" value={item.total_solar_units} />
                        <SummaryItem label="Run Hours" value={item.solar_run_hours} />
                    </>
                ) : (
                    <>
                        <SummaryItem label="Date" value={item.date} />
                        <SummaryItem label="Start Time" value={item.solar_reading_start_time} />
                        <SummaryItem label="End Time" value={item.solar_reading_end_time} />
                        <SummaryItem label="Solar Units" value={item.solar_units} />
                        <SummaryItem label="Accumulative" value={item.accumulative_data} />
                        <SummaryItem label="Run Hours" value={item.solar_run_hours} />
                    </>
                )}
            </View>

            {/* Expanded Detailed Grid (Readings) */}
            {expanded && (
                <View style={styles.expandedContent}>
                    {/* Divider removed in favor of background color */}
                    
                    <View style={styles.viewingContainer}>
                        <Text style={styles.viewingLbl}>VIEWING:</Text>
                        <View style={{ flex: 1 }}>
                            <DropdownPicker 
                                options={options} 
                                value={selectedReadingIdx} 
                                onSelect={setSelectedReadingIdx}
                                placeholder="Select Reading"
                            />
                        </View>
                        <View style={styles.entriesBadge}>
                            <Text style={styles.entriesTxt}>{readings.length} entries</Text>
                        </View>
                    </View>

                    <View style={styles.grid}>
                        {stats.map((s, i) => (
                            <View key={i} style={styles.gridItem}>
                                <Text style={styles.gridLbl}>{s.label}</Text>
                                <Text style={styles.gridVal}>{(s.value === null || s.value === undefined || s.value === '') ? '—' : s.value}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function SolarAnalyticsScreen({ navigation }: any) {
    const { globalFilters, setGlobalFilters } = useGlobalFilter();
    const [data, setData] = useState<any[]>([]);
    const [period, setPeriod] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [reportType, setReportType] = useState<'monthly'|'daily'>('monthly');

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const apiCall = reportType === 'monthly' ? api.getSolarAnalyticsMonthly : api.getSolarAnalyticsDaily;
            const res = await apiCall(globalFilters);
            if (res && res.rows) {
                setData(res.rows);
                setPeriod({
                    start: res.date_range?.start || res.period?.start || 'N/A',
                    end: res.date_range?.end || res.period?.end || 'N/A'
                });
            }
        } catch (e) {
            console.log('Error fetching SolarAnalytics:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [globalFilters, reportType]);

    useEffect(() => {
        fetchData();
        setExpandedId(null);
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <AppHeader
                    title="SOLAR ANALYTICS"
                    subtitle={reportType === 'monthly' ? "Monthly Report" : "Daily Report"}
                    leftAction="menu"
                    onLeftPress={() => setSidebarVisible(true)}
                    rightActions={[
                        
                    ]}
                />
                
                

                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, reportType === 'monthly' && styles.tabActive]} 
                        onPress={() => setReportType('monthly')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, reportType === 'monthly' && styles.tabTextActive]}>Monthly Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, reportType === 'daily' && styles.tabActive]} 
                        onPress={() => setReportType('daily')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, reportType === 'daily' && styles.tabTextActive]}>Daily Report</Text>
                    </TouchableOpacity>
                </View>

                {period && period.start !== 'N/A' && (
                    <View style={styles.periodBox}>
                        <Text style={styles.periodText}>Period: {period.start} to {period.end}</Text>
                        <Text style={styles.periodSub}>Total Sites: {data.length}</Text>
                    </View>
                )}

                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                    </View>
                ) : (
                    <FlatList
                        data={data.filter(item => {
                            const units = parseFloat(item.solar_units ?? item.total_solar_units ?? '0');
                            return units > 0;
                        })}
                        keyExtractor={(item, index) => item.site_id || item.global_id || index.toString()}
                        contentContainerStyle={styles.listContainer}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />}
                        renderItem={({ item }) => (
                            <SiteCard
                                item={item}
                                expanded={expandedId === (item.site_id || item.global_id)}
                                onToggle={() => setExpandedId(expandedId === (item.site_id || item.global_id) ? null : (item.site_id || item.global_id))}
                                reportType={reportType}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyBox}>
                                <Icon name="sun" size={40} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No solar data available for this period.</Text>
                            </View>
                        }
                    />
                )}
                
                
                <Sidebar
                    isVisible={sidebarVisible}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                    fullname={fullname}
                    activeRoute="SolarAnalytics"
                    handleLogout={async () => {
                        await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                        navigation.replace('Login');
                    }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#e2e8f0' },
    content: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 },
    tabContainer: {
        flexDirection: 'row',
        padding: moderateScale(14),
        paddingBottom: verticalScale(0),
        gap: moderateScale(10),
    },
    tab: {
        flex: 1,
        paddingVertical: verticalScale(10),
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tabActive: {
        backgroundColor: '#0ea5e9',
        borderColor: '#0ea5e9',
    },
    tabText: {
        fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b',
        fontWeight: '700',
    },
    tabTextActive: {
        color: '#fff',
    },
    periodBox: {
        paddingHorizontal: moderateScale(14),
        paddingVertical: verticalScale(12),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    periodText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#475569', fontWeight: '700' },
    periodSub: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#0ea5e9', fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { paddingHorizontal: moderateScale(14), paddingBottom: verticalScale(30) },
    
    /* Card Styles */
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), marginBottom: verticalScale(12), elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, borderWidth: 1, borderColor: '#e2e8f0' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(10) },
    siteName: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    siteId: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '600' },
    highlight: { color: '#0f172a', fontWeight: '800' },
    kwhBadge: { backgroundColor: 'rgba(14,165,233,0.1)', borderRadius: 8, paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4) },
    kwhTxt: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800', color: '#0284c7' },
    
    /* Summary Grid (Always Visible) */
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 8, padding: moderateScale(10), borderWidth: 1, borderColor: '#f1f5f9' },
    summaryItem: { width: '48%', marginBottom: verticalScale(6) },
    summaryLbl: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    summaryVal: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', fontWeight: '700' },
    
    expandedContent: { marginTop: verticalScale(8), backgroundColor: '#f1f5f9', padding: moderateScale(12), borderRadius: 10 },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: verticalScale(12) },
    
    viewingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(12), gap: 8 },
    viewingLbl: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
    entriesBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    entriesTxt: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#0284c7', fontWeight: '700' },
    
    dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: moderateScale(10), paddingVertical: 6, backgroundColor: '#f8fafc' },
    dropdownTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#0f172a', fontWeight: '600', flex: 1, marginRight: 4 },
    
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '48%', backgroundColor: '#fff', borderRadius: 8, padding: moderateScale(10), marginBottom: verticalScale(8), borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    gridLbl: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '800', letterSpacing: 0.2, marginBottom: verticalScale(4) },
    gridVal: { fontSize: responsiveFontSize(15), flexShrink: 1, color: '#1e293b', fontWeight: '700' },
    
    emptyBox: { alignItems: 'center', marginTop: verticalScale(60) },
    emptyText: { color: '#94a3b8', marginTop: moderateScale(12), fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '600' },

    /* Modal Styles */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxHeight: '75%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: moderateScale(14), borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modalTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', margin: moderateScale(12), paddingHorizontal: moderateScale(12), borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, paddingVertical: verticalScale(8), fontSize: responsiveFontSize(12), flexShrink: 1, color: '#0f172a', fontWeight: '600' },
    
    modalItem: { padding: moderateScale(14), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalItemActive: { backgroundColor: '#f0f9ff' },
    modalItemTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#334155', fontWeight: '600' },
    modalItemTxtActive: { color: '#0284c7', fontWeight: '800' },
    emptySearchTxt: { padding: moderateScale(20), textAlign: 'center', color: '#94a3b8', fontSize: responsiveFontSize(12), flexShrink: 1, }
});
