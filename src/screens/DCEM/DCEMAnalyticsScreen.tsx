

import React, { useState, useEffect, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    FlatList, TextInput, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../api';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalFilter } from '../../context/FilterContext';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

const fmt = (v: any, d = 2) => (parseFloat(v) || 0).toFixed(d);

// Helper to convert JSON array to CSV string
const convertToCSV = (objArray: any[]) => {
    if (!objArray || objArray.length === 0) return '';
    const headers = ['IMEI', 'Global ID', 'Site ID', 'Site Name', 'Date Range', 'Total kWh', 'Operators', 'Avg Current', 'Avg Power', 'Voltage'];
    const csvRows = [headers.join(',')];

    for (const row of objArray) {
        const values = [
            `"${row.imei || ''}"`,
            `"${row.global_id || ''}"`,
            `"${row.site_id || ''}"`,
            `"${(row.site_name || '').replace(/"/g, '""')}"`,
            `"${row.date_range || ''}"`,
            `"${row.total_kwh || 0}"`,
            `"${row.actual_operator_count || 0}"`,
            `"${row.site_avg_current || row.total_avgCurr || 0}"`,
            `"${row.site_avg_power || 0}"`,
            `"${row.voltage || 48}" V`,
        ];
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

// ─── Colors ──────────────────────────────────────────────────
const CH_COLORS = ['#e74c3c', '#f39c12', '#27ae60', '#3498db'];

function kpiColor(idx: number) {
    return ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6];
}

// ─── Meta KPI Card ────────────────────────────────────────────
function MetaCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={[MCS.card, { borderTopColor: color }]}>
            <Text style={[MCS.val, { color }]}>{value}</Text>
            <Text style={MCS.lab}>{label}</Text>
        </View>
    );
}
const MCS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), minWidth: 100, borderTopWidth: 3, elevation: 2, alignItems: 'center', marginRight: moderateScale(10) },
    val: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800' },
    lab: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: verticalScale(3), textAlign: 'center' },
});

// ─── Operator badge ───────────────────────────────────────────
function OpBadge({ op }: { op: any }) {
    return (
        <View style={OBS.wrap}>
            <Text style={OBS.name}>{op.operator}</Text>
            <Text style={OBS.val}>{op.kwh} kWh</Text>
            <View style={OBS.pct}>
                <Text style={OBS.pctTxt}>{op.percentage}%</Text>
            </View>
        </View>
    );
}
const OBS = StyleSheet.create({
    wrap: { backgroundColor: '#dbeafe', borderRadius: 6, padding: moderateScale(8), marginRight: moderateScale(6), marginBottom: verticalScale(4) },
    name: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#1e40af' },
    val: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e40af' },
    pct: { backgroundColor: '#10b981', borderRadius: 4, paddingHorizontal: moderateScale(4), paddingVertical: verticalScale(1), alignSelf: 'flex-start', marginTop: verticalScale(2) },
    pctTxt: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#fff', fontWeight: '800' },
});

// ─── Site Card ────────────────────────────────────────────────
function SiteCard({ item, onPress }: { item: any; onPress: () => void }) {
    const [open, setOpen] = useState(false);

    return (
        <TouchableOpacity style={SCC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            {/* Header */}
            <View style={SCC.header}>
                <View style={{ flex: 1 }}>
                    <Text style={SCC.name} numberOfLines={1}>{item.site_name || '—'}</Text>
                    <Text style={SCC.sub}>Site ID: <Text style={SCC.highlight}>{item.site_id}</Text>  ·  IMEI: <Text style={SCC.highlight}>{item.imei}</Text></Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={SCC.kwh}>
                        <Text style={SCC.kwhTxt}>{item.total_kwh} kWh</Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#94a3b8" />
                </View>
            </View>

            {/* Quick stats row */}
            <View style={SCC.quickRow}>
                {[
                    { l: 'Avg Current', v: `${item.site_avg_current || item.total_avgCurr || 0}A` },
                    { l: 'Avg Power', v: `${item.site_avg_power || 0}KW` },
                ].map(x => (
                    <View key={x.l} style={SCC.quickItem}>
                        <Text style={SCC.quickVal}>{x.v}</Text>
                        <Text style={SCC.quickLbl}>{x.l}</Text>
                    </View>
                ))}
            </View>

            {/* Expanded */}
            {open && (
                <View style={{ marginTop: verticalScale(10) }}>
                    <View style={SCC.divider} />

                    {/* Operator consumptions */}
                    <Text style={SCC.secTitle}>Operator Consumption</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: verticalScale(10) }}>
                        {(item.operator_consumptions || []).map((op: any, i: number) => (
                            <OpBadge key={i} op={op} />
                        ))}
                        {(!item.operator_consumptions || item.operator_consumptions.length === 0) && (
                            <Text style={SCC.noData}>No operator data</Text>
                        )}
                    </View>

                    

                    {/* Detail Button */}
                    <TouchableOpacity style={SCC.detailBtn} onPress={onPress} activeOpacity={0.8}>
                        <AppIcon name="activity" size={13} color="#fff" />
                        <Text style={SCC.detailBtnTxt}>View Monthly Report</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
}
const SCC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), marginBottom: verticalScale(10), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: verticalScale(10) },
    name: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    sub: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b' },
    highlight: { color: '#0f172a', fontWeight: '800' },
    kwh: { backgroundColor: 'rgba(59,130,246,0.10)', borderRadius: 8, paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4) },
    kwhTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1e40af' },
    quickRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 10, padding: moderateScale(10) },
    quickItem: { alignItems: 'center', flex: 1 },
    quickVal: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    quickLbl: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: verticalScale(2) },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(12) },
    input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: moderateScale(8), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '600', flex: 1 },
    secTitle: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800', color: '#64748b', marginBottom: verticalScale(6), letterSpacing: 0.5 },
    noData: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#94a3b8' },
    tenantCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: moderateScale(10), borderLeftWidth: 3 },
    tenantTitle: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(4) },
    tenantKwh: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(2) },
    tenantPct: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3b82f6', borderRadius: 10, padding: moderateScale(10), marginTop: verticalScale(4) },
    detailBtnTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14), flexShrink: 1, },
});

// ─── Date Picker Row ──────────────────────────────────────────
function DateRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    return (
        <View style={DRS.wrap}>
            <Text style={DRS.label}>{label}</Text>
            <TouchableOpacity style={DRS.input} onPress={onPress}>
                <Text style={{ color: value ? '#0f172a' : '#94a3b8', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '600' }}>{value || 'YYYY-MM-DD'}</Text>
            </TouchableOpacity>
        </View>
    );
}
const DRS = StyleSheet.create({
    wrap: { flex: 1 },
    label: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(4) },
    input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: moderateScale(8), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '600' },
});

// ─── MAIN ─────────────────────────────────────────────────────
export default function DCEMAnalyticsScreen({ navigation }: any) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const [fromDate, setFromDate] = useState(fmtDate(firstDay));
    const [toDate, setToDate] = useState(fmtDate(today));
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'custom' | 'monthly'>('custom');
    const [selYear, setSelYear] = useState(today.getFullYear().toString());
    const [selMonth, setSelMonth] = useState((today.getMonth() + 1).toString().padStart(2, '0'));
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const { globalFilters } = useGlobalFilter();

    const setMonthRange = (year: string, month: string) => {
        const y = parseInt(year);
        const m = parseInt(month);
        const f = new Date(y, m - 1, 1);
        const l = new Date(y, m, 0);
        setFromDate(f.toISOString().split('T')[0]);
        setToDate(l.toISOString().split('T')[0]);
    };

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const res = await (api as any).getDCEMAnalytics({ ...globalFilters, date_from: fromDate, date_to: toDate });
            setData(res);
        } catch (e) {
            console.log('DCEM Analytics error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fromDate, toDate, JSON.stringify(globalFilters)]);

    useEffect(() => { fetchData(); }, [JSON.stringify(globalFilters)]);

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    const meta = data?.meta || {};
    const sites = (data?.sites || []).filter((s: any) =>
        !search ||
        s.global_id?.toLowerCase().includes(search.toLowerCase()) || 
        s.site_id?.toLowerCase().includes(search.toLowerCase()) || 
        s.site_name?.toLowerCase().includes(search.toLowerCase()) || 
        s.imei?.includes(search)
    );

    const metaKpis = [
        { label: 'Total Energy', value: `${meta.total_energy_kwh || 0} kWh` },
        { label: 'Avg Current', value: `${meta.total_avg_current_a || 0}A` },
                { label: 'Avg Power', value: `${meta.total_avg_power_kw || 0}KW` },
        { label: 'Total Records', value: String(meta.total_records || 0) },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="DCEM ANALYTICS"
                    subtitle={`${fromDate} → ${toDate}`}
                    leftAction="menu"
                    onLeftPress={() => setSidebarVisible(true)}
                    rightActions={[
                        {
                            icon: exporting ? 'loader' : 'download', onPress: () => {
                                const csv = convertToCSV(sites);
                                if (!csv) return Alert.alert('No data', 'Nothing to download.');
                                setExporting(true);
                                const fileName = `DCEM_Analytics_${new Date().getTime()}.csv`;
                                const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
                                RNFS.writeFile(filePath, csv, 'utf8')
                                    .then(() => Share.open({ url: `file://${filePath}`, type: 'text/csv' }))
                                    .catch(err => console.log('Export error:', err))
                                    .finally(() => setExporting(false));
                            }
                        }
                    ]}
                />

                {loading && !data ? (
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="large" color="#1e3c72" />
                        <Text style={styles.loaderTxt}>Loading DCEM data...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={sites}
                        keyExtractor={(item, i) => `${item.imei || i}`}
                        contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
                        ListHeaderComponent={
                            <View>
                                {/* View Mode Toggle */}
                                <View style={styles.tabContainer}>
                                    <TouchableOpacity
                                        style={[styles.tabBtn, viewMode === 'custom' && styles.tabActive]}
                                        onPress={() => setViewMode('custom')}
                                    >
                                        <Text style={[styles.tabTxt, viewMode === 'custom' && styles.tabTxtActive]}>Custom Range</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.tabBtn, viewMode === 'monthly' && styles.tabActive]}
                                        onPress={() => setViewMode('monthly')}
                                    >
                                        <Text style={[styles.tabTxt, viewMode === 'monthly' && styles.tabTxtActive]}>Monthly Report</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Date filter row */}
                                <View style={styles.dateRow}>
                                    <View style={{ flex: 1, flexDirection: 'row', gap: moderateScale(10) }}>
                                        {viewMode === 'custom' ? (
                                            <>
                                                <DateRow label="FROM DATE" value={fromDate} onPress={() => setShowFromPicker(true)} />
                                                <DateRow label="TO DATE" value={toDate} onPress={() => setShowToPicker(true)} />
                                            </>
                                        ) : (
                                            <>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={DRS.label}>Year</Text>
                                                    <TextInput
                                                        style={DRS.input}
                                                        value={selYear}
                                                        onChangeText={setSelYear}
                                                        keyboardType="numeric"
                                                        maxLength={4}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={DRS.label}>Month (01-12)</Text>
                                                    <TextInput
                                                        style={DRS.input}
                                                        value={selMonth}
                                                        onChangeText={v => {
                                                            setSelMonth(v);
                                                            if (v.length === 2) setMonthRange(selYear, v);
                                                        }}
                                                        keyboardType="numeric"
                                                        maxLength={2}
                                                    />
                                                </View>
                                            </>
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        style={styles.fetchBtn}
                                        onPress={() => {
                                            if (viewMode === 'monthly') setMonthRange(selYear, selMonth);
                                            fetchData();
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <AppIcon name="search" size={14} color="#fff" />
                                        <Text style={styles.fetchBtnTxt}>Fetch</Text>
                                    </TouchableOpacity>
                                </View>

                                {showFromPicker && (
                                    <DateTimePicker
                                        value={new Date(fromDate)}
                                        mode="date"
                                        display="default"
                                        onChange={(e, d) => {
                                            setShowFromPicker(false);
                                            if (d) setFromDate(d.toISOString().split('T')[0]);
                                        }}
                                    />
                                )}

                                {showToPicker && (
                                    <DateTimePicker
                                        value={new Date(toDate)}
                                        mode="date"
                                        display="default"
                                        onChange={(e, d) => {
                                            setShowToPicker(false);
                                            if (d) setToDate(d.toISOString().split('T')[0]);
                                        }}
                                    />
                                )}

                                {/* Meta KPI scroll */}
                                {data && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(14) }}>
                                        {metaKpis.map((k, i) => (
                                            <MetaCard key={k.label} label={k.label} value={k.value} color={kpiColor(i)} />
                                        ))}
                                    </ScrollView>
                                )}

                                {/* Search */}
                                <View style={styles.searchRow}>
                                    <AppIcon name="search" size={14} color="#94a3b8" style={{ marginRight: moderateScale(6) }} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by Global ID or Name..."
                                        placeholderTextColor="#94a3b8"
                                        value={search}
                                        onChangeText={setSearch}
                                    />
                                    {!!search && (
                                        <TouchableOpacity onPress={() => setSearch('')}>
                                            <AppIcon name="x" size={14} color="#94a3b8" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Count */}
                                {data && (
                                    <Text style={styles.count}>{sites.length} SITES</Text>
                                )}
                            </View>
                        }
                        renderItem={({ item }) => (
                            <SiteCard
                                item={item}
                                onPress={() => navigation.navigate('DCEMMonthlyReport', { imei: item.imei, showBack: true })}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', paddingTop: verticalScale(60) }}>
                                <AppIcon name="inbox" size={38} color="#cbd5e1" />
                                <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(16), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '500' }}>
                                    {data ? 'No sites found' : 'Fetch data to begin'}
                                </Text>
                            </View>
                        }
                    />
                )}

                <Sidebar
                    isVisible={isSidebarVisible}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                    fullname={fullname}
                    activeRoute="DCEMAnalytics"
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
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: '#1e3c72', fontWeight: '600', fontSize: responsiveFontSize(15), flexShrink: 1, },
    header: { paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hBtn: { padding: moderateScale(6) },
    hTitle: { color: '#fff', fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', letterSpacing: 1.2 },
    hSub: { color: 'rgba(255,255,255,0.75)', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', marginTop: verticalScale(2) },
    dateRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: verticalScale(14) },
    fetchBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1e3c72', borderRadius: 10, paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(10), marginLeft: moderateScale(8) },
    fetchBtnTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14), flexShrink: 1, },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(10), elevation: 1 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '500' },
    count: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800', color: '#64748b', marginBottom: verticalScale(8) },
    tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: moderateScale(4), marginBottom: verticalScale(15) },
    tabBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: '#fff', elevation: 2 },
    tabTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    tabTxtActive: { color: '#1e3c72' },
});