/**
 * OptimizationReportsScreen.tsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions,
    RefreshControl, FlatList, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

const SW = Dimensions.get('window').width;

type TabKey = 'overview' | 'energy' | 'losses' | 'leakage' | 'voltage' | 'power' | 'powerfactor' | 'sanctioned' | 'events';

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'bar-chart-2' },
    { key: 'energy', label: 'Energy KPIs', icon: 'zap' },
    { key: 'losses', label: 'High Loss Sites', icon: 'alert-triangle' },
    { key: 'leakage', label: 'Revenue Leakage', icon: 'droplet' },
    { key: 'voltage', label: 'Low Voltage', icon: 'activity' },
    { key: 'power', label: 'SO vs Actual', icon: 'trending-up' },
    { key: 'powerfactor', label: 'Power Factor', icon: 'sliders' },
    { key: 'sanctioned', label: 'Load Optimization', icon: 'layers' },
    { key: 'events', label: 'Event Monitoring', icon: 'calendar' },
];

const C = {
    primary: '#01497c', dark: '#013a63', light: '#89C2D9', bg: '#c5d4eeff',
    success: '#10b981', warning: '#f59e0b', danger: '#ef4444',
    blue1: '#012A4A', blue2: '#2A6F97', blue3: '#61A5C2', blue4: '#A9D6E5',
};

const FILTER_TYPES = [
    { v: 'all', l: 'All Sites' },
    { v: 'leakage', l: 'Leakage Sites' },
    { v: 'no_leakage', l: 'No Leakage' },
    { v: 'null', l: 'Null / Unknown' },
];

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

function MBar({ pct, color }: { pct: number; color: string }) {
    return (
        <View style={{ height: verticalScale(6), backgroundColor: '#f1f5f9', borderRadius: 3, marginTop: verticalScale(4) }}>
            <View style={{ height: verticalScale(6), width: `${Math.min(pct || 0, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
        </View>
    );
}

function KpiCard({ title, value, sub, trend, up }: any) {
    return (
        <View style={KS.card}>
            <Text style={KS.title}>{title}</Text>
            <Text style={KS.value}>{value}</Text>
            {!!sub && <Text style={KS.sub}>{sub}</Text>}
            {!!trend && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: verticalScale(6) }}>
                    <Icon name={up ? 'trending-up' : 'trending-down'} size={11} color={up ? C.success : C.danger} />
                    <Text style={{ fontSize: responsiveFontSize(10), fontWeight: '700', color: up ? C.success : C.danger }}>{trend}</Text>
                </View>
            )}
        </View>
    );
}
const KS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), flex: 1, marginHorizontal: moderateScale(3), elevation: 2, borderTopWidth: 3, borderTopColor: C.primary, minWidth: (SW - 44) / 2 },
    title: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: verticalScale(5) },
    value: { fontSize: responsiveFontSize(20), fontWeight: '800', color: C.primary, marginBottom: verticalScale(3) },
    sub: { fontSize: responsiveFontSize(9), color: '#94a3b8' },
});

function RevCard({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    const avgL = item.avg_load_leakage === 1;
    const peakL = item.peak_load_leakage === 1;
    const hasL = avgL || peakL;
    const col = hasL ? C.danger : C.success;
    return (
        <TouchableOpacity style={[RC.card, { borderLeftColor: col }]} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={RC.top}>
                <View style={{ flex: 1 }}>
                    <Text style={RC.sid}>Global ID: {item.global_id || item.site_id || '—'}</Text>
                    <Text style={RC.imei}>{item.imei || '—'} {item.site_id ? `| ${item.site_id}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <View style={[RC.badge, { backgroundColor: `${col}15`, borderColor: col }]}>
                        <Text style={[RC.btxt, { color: col }]}>{hasL ? '⚡ Leakage' : '✓ Normal'}</Text>
                    </View>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>
            <View style={RC.stats}>
                {[['Avg', item.avg_load], ['Peak', item.peak_load], ['SO', item.so_load]].map(([l, v]) => (
                    <View key={String(l)} style={RC.stat}>
                        <Text style={RC.sv}>{v ?? '—'}</Text>
                        <Text style={RC.sl}>{l} Load</Text>
                    </View>
                ))}
            </View>
            {open && (
                <View style={RC.detail}>
                    <View style={RC.div} />
                    {[
                        ['Avg Leakage', avgL ? '🔴 Leakage' : '🟢 Normal'],
                        ['Peak Leakage', peakL ? '🔴 Leakage' : '🟢 Normal'],
                        ['Analysis Date', item.analysis_date ?? '—'],
                    ].map(([l, v]) => (
                        <View key={String(l)} style={RC.drow}>
                            <Text style={RC.dl}>{l}</Text>
                            <Text style={RC.dv}>{v}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}
const RC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), marginBottom: verticalScale(8), borderLeftWidth: 4, elevation: 2 },
    top: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(8) },
    sid: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    imei: { fontSize: responsiveFontSize(9), color: '#64748b' },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    btxt: { fontSize: responsiveFontSize(10), fontWeight: '800' },
    stats: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: moderateScale(8) },
    stat: { flex: 1, alignItems: 'center' },
    sv: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#0f172a' },
    sl: { fontSize: responsiveFontSize(8), color: '#64748b', fontWeight: '600', marginTop: verticalScale(1) },
    detail: { marginTop: verticalScale(10) },
    div: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    drow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    dl: { fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '600' },
    dv: { fontSize: responsiveFontSize(11), color: '#1e293b', fontWeight: '700' },
});

function STable({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
                <View style={[ST.row, { backgroundColor: C.primary }]}>
                    {headers.map(h => <Text key={h} style={ST.th}>{h}</Text>)}
                </View>
                {rows.map((r, i) => (
                    <View key={i} style={[ST.row, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }]}>
                        {r.map((c, j) => <Text key={j} style={ST.td}>{c}</Text>)}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
const ST = StyleSheet.create({
    row: { flexDirection: 'row' },
    th: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#fff', padding: moderateScale(10), minWidth: 100, textTransform: 'uppercase' },
    td: { fontSize: responsiveFontSize(11), color: '#334155', fontWeight: '500', padding: moderateScale(10), minWidth: 100, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
});

export default function OptimizationReportsScreen({ navigation, route }: any) {
    const initTab: TabKey = (route?.params?.initialTab as TabKey) || 'overview';
    const [activeTab, setActiveTab] = useState<TabKey>(initTab);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    const [revData, setRevData] = useState<any>(null);
    const [revLoading, setRevLoading] = useState(false);
    const [revRefresh, setRevRefresh] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [revError, setRevError] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterModal, setFilterModal] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PAGE = 20;

    useEffect(() => {
        const t = (route?.params?.initialTab as TabKey) || 'overview';
        setActiveTab(t);
        if (t === 'leakage' && !revData) loadRevenue('all');
    }, [route?.params?.initialTab]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const loadRevenue = useCallback(async (type: string, isRefresh = false) => {
        if (!isRefresh) setRevLoading(true);
        setRevError('');
        try {
            const res = await (api as any).getRevenueData({ type });
            if (res?.status === 'success') {
                setRevData(res);
                setPage(1);
            } else {
                setRevError(res?.message || 'Failed to load data');
            }
        } catch (e: any) {
            setRevError(e.message || 'Network error');
        } finally {
            setRevLoading(false);
            setRevRefresh(false);
        }
    }, []);

    const switchTab = (key: TabKey) => {
        setActiveTab(key);
        setSearch('');
        if (key === 'leakage' && !revData) loadRevenue('all');
    };

    const applyFilter = (type: string) => {
        setFilterType(type);
        setFilterModal(false);
        setRevData(null);
        loadRevenue(type);
    };

    const resetFilters = () => {
        setFilterType('all');
        setSearch('');
        setRevData(null);
        loadRevenue('all');
    };

    const allRows: any[] = revData?.rows || [];
    const filtered = useMemo(() => {
        if (!search) return allRows;
        const query = search.toLowerCase();
        return allRows.filter(r =>
            (r.global_id || '').toLowerCase().includes(query) || 
            (r.site_id || '').toLowerCase().includes(query) || 
            (r.site_name || '').toLowerCase().includes(query) ||
            (r.imei || '').toLowerCase().includes(query)
        );
    }, [allRows, search]);

    const totalPages = Math.ceil(filtered.length / PAGE);
    const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

    const handleShare = async () => {
        if (!revData || !allRows.length) return;
        setExporting(true);
        try {
            const csvString = convertToCSV(allRows);
            const fileName = `Revenue_Leakage_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Revenue Leakage Export',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (e: any) {
            if (e?.message !== 'User did not share') {
                Alert.alert("Export Error", "Failed to generate CSV");
            }
        } finally {
            setExporting(false);
        }
    };

    return (
        <SafeAreaView style={S.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="OPTIMIZATION REPORTS"
                subtitle="TelecomEnergy Pro · Energy Dashboard"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={activeTab === 'leakage' ? [
                    { icon: exporting ? 'loader' : 'download', onPress: handleShare },
                ] : undefined}
            />

            <View style={S.tabBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabScroll}>
                    {TABS.map(tab => (
                        <TouchableOpacity key={tab.key}
                            style={[S.tabBtn, activeTab === tab.key && S.tabBtnActive]}
                            onPress={() => switchTab(tab.key)} activeOpacity={0.8}>
                            <Icon name={tab.icon} size={11} color={activeTab === tab.key ? C.primary : '#64748b'} />
                            <Text style={[S.tabTxt, activeTab === tab.key && S.tabTxtActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={{ flex: 1 }}>
            {activeTab === 'leakage' && (
                revLoading && !revData ? (
                    <View style={S.loader}>
                        <ActivityIndicator size="large" color={C.primary} />
                        <Text style={S.loaderTxt}>Loading revenue data...</Text>
                    </View>
                ) : revError ? (
                    <View style={S.errBox}>
                        <Icon name="alert-circle" size={32} color={C.danger} />
                        <Text style={S.errTxt}>{revError}</Text>
                        <TouchableOpacity style={S.retryBtn} onPress={() => loadRevenue(filterType)}>
                            <Text style={S.retryTxt}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={pageRows}
                        keyExtractor={(item, i) => `${item.site_id || i}_${i}`}
                        contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={revRefresh} onRefresh={() => { setRevRefresh(true); loadRevenue(filterType, true); }} colors={[C.primary]} />}
                        ListHeaderComponent={revData ? (
                            <View style={{ paddingTop: verticalScale(5) }}>
                                <Text style={S.rowCount}>{filtered.length} records  ·  Page {page} of {totalPages || 1}</Text>
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Revenue Leakage — National · Last 30 days</Text>
                                    <View style={{ flexDirection: 'row', height: verticalScale(18), borderRadius: 9, overflow: 'hidden', marginBottom: verticalScale(12) }}>
                                        <View style={{ flex: revData.leakage_percent || 0.5, backgroundColor: C.blue1 }} />
                                        <View style={{ flex: revData.no_leakage_percent || 0.5, backgroundColor: C.blue3 }} />
                                        <View style={{ flex: revData.null_percent > 0 ? revData.null_percent : 0.2, backgroundColor: C.blue4 }} />
                                    </View>
                                    <Text style={{ fontSize: responsiveFontSize(32), fontWeight: '800', color: C.primary, textAlign: 'center', marginBottom: verticalScale(4) }}>{revData.total_sites}</Text>
                                    <Text style={{ fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '600', textAlign: 'center', marginBottom: verticalScale(14) }}>Site Count</Text>
                                    {[
                                        { color: C.blue1, label: 'Leakage', pct: revData.leakage_percent, cnt: revData.leakage_count },
                                        { color: C.blue3, label: 'No Leakage', pct: revData.no_leakage_percent, cnt: revData.no_leakage_count },
                                        { color: C.blue4, label: 'Null', pct: revData.null_percent, cnt: revData.null_count },
                                    ].map(l => (
                                        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: verticalScale(6) }}>
                                            <View style={{ width: moderateScale(14), height: verticalScale(14), borderRadius: 3, backgroundColor: l.color }} />
                                            <Text style={{ fontSize: responsiveFontSize(12), fontWeight: '700', color: '#1e293b' }}>{l.pct}%  ({l.cnt})  <Text style={{ color: '#64748b', fontWeight: '500' }}>{l.label}</Text></Text>
                                        </View>
                                    ))}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: verticalScale(14), paddingTop: verticalScale(14), borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                                        {[
                                            { l: 'Peak Load kW', v: revData.avg_peak_load },
                                            { l: 'Avg Load kW', v: revData.avg_avg_load },
                                            { l: 'SO Load kW', v: revData.avg_total_declared },
                                        ].map(m => (
                                            <View key={m.l} style={{ alignItems: 'center' }}>
                                                <Text style={{ fontSize: responsiveFontSize(20), fontWeight: '800', color: C.primary }}>{m.v ?? '—'}</Text>
                                                <Text style={{ fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '600', marginTop: verticalScale(2) }}>{m.l}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Load Monitoring Analytics</Text>
                                    {[
                                        { l: 'Total Sites', v: revData.total_sites, pct: 100, color: C.blue1 },
                                        { l: 'Leakage Sites', v: revData.leakage_count, pct: revData.leakage_percent, color: C.danger },
                                        { l: 'No Leakage', v: revData.no_leakage_count, pct: revData.no_leakage_percent, color: C.success },
                                    ].map(b => (
                                        <View key={b.l} style={{ marginBottom: verticalScale(12) }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: responsiveFontSize(11), fontWeight: '700', color: '#334155' }}>{b.l}</Text>
                                                <Text style={{ fontSize: responsiveFontSize(11), fontWeight: '800', color: b.color }}>{b.v}  ({b.pct}%)</Text>
                                            </View>
                                            <MBar pct={b.pct} color={b.color} />
                                        </View>
                                    ))}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: verticalScale(15) }}>
                                    <View style={S.searchBox}>
                                        <Icon name="search" size={14} color="#94a3b8" />
                                        <TextInput style={S.searchInput} value={search} onChangeText={setSearch} placeholder="Search by Global ID or Name..." placeholderTextColor="#94a3b8" />
                                        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Icon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                                    </View>
                                    <TouchableOpacity style={S.filterBtn} onPress={() => setFilterModal(true)}>
                                        <Icon name="filter" size={14} color={C.primary} />
                                        <Text style={S.filterBtnTxt}>{FILTER_TYPES.find(f => f.v === filterType)?.l}</Text>
                                        <Icon name="chevron-down" size={12} color={C.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={S.resetBtn} onPress={resetFilters}><Icon name="rotate-ccw" size={16} color="#fff" /><Text style={S.resetTxt}>Reset</Text></TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                        renderItem={({ item }) => <RevCard item={item} />}
                        ListFooterComponent={totalPages > 1 ? (
                            <View style={S.pagination}>
                                <TouchableOpacity style={[S.pageBtn, page === 1 && S.pageBtnDis]} onPress={() => { if (page > 1) setPage(1); }} disabled={page === 1}><Text style={S.pageBtnTxt}>First</Text></TouchableOpacity>
                                <TouchableOpacity style={[S.pageBtn, page === 1 && S.pageBtnDis]} onPress={() => { if (page > 1) setPage(p => p - 1); }} disabled={page === 1}><Icon name="chevron-left" size={14} color={C.primary} /></TouchableOpacity>
                                <Text style={S.pageInfo}>{page} / {totalPages}</Text>
                                <TouchableOpacity style={[S.pageBtn, page === totalPages && S.pageBtnDis]} onPress={() => { if (page < totalPages) setPage(p => p + 1); }} disabled={page === totalPages}><Icon name="chevron-right" size={14} color={C.primary} /></TouchableOpacity>
                                <TouchableOpacity style={[S.pageBtn, page === totalPages && S.pageBtnDis]} onPress={() => { if (page < totalPages) setPage(totalPages); }} disabled={page === totalPages}><Text style={S.pageBtnTxt}>Last</Text></TouchableOpacity>
                            </View>
                        ) : null}
                        ListEmptyComponent={!revLoading ? (
                            <View style={{ alignItems: 'center', paddingTop: verticalScale(40) }}><Icon name="droplet" size={36} color="#cbd5e1" /><Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(13), marginTop: verticalScale(12) }}>{search ? 'No sites match your search' : 'No revenue data available'}</Text></View>
                        ) : null}
                    />
                )
            )}

            {activeTab !== 'leakage' && (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }} showsVerticalScrollIndicator={false}>
                    {activeTab === 'overview' && (
                        <View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: verticalScale(12) }}>
                                <KpiCard title="Total Sites" value="2,847" sub="Active monitoring" trend="12 New" up />
                                <KpiCard title="Active Alerts" value="34" sub="Last 24h" trend="8 Resolved" up={false} />
                                <KpiCard title="Energy Savings" value="₹34.5K" sub="vs Last Month" trend="12.5%" up />
                                <KpiCard title="Avg Power Factor" value="0.87" sub="Target: 0.90" trend="0.05" up />
                            </View>
                            <View style={S.card}>
                                <Text style={S.cardTitle}>24-Hour Energy Mix Distribution</Text>
                                {[
                                    { l: 'Grid', v: '12,400 kWh', pct: 47, color: C.blue1 },
                                    { l: 'Diesel', v: '4,890 kWh', pct: 18, color: C.blue2 },
                                    { l: 'Solar', v: '9,200 kWh', pct: 23, color: C.blue3 },
                                    { l: 'Battery', v: '7,200 kWh', pct: 12, color: C.blue4 },
                                ].map(b => (
                                    <View key={b.l} style={{ marginBottom: verticalScale(10) }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: responsiveFontSize(11), fontWeight: '700', color: '#334155' }}>{b.l}</Text><Text style={{ fontSize: responsiveFontSize(11), fontWeight: '800', color: b.color }}>{b.v} ({b.pct}%)</Text></View>
                                        <MBar pct={b.pct} color={b.color} />
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                    {activeTab === 'energy' && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            <KpiCard title="Generator Runtime" value="1,206 hrs" trend="-4.3% vs last week" up={false} />
                            <KpiCard title="Battery SoC Avg" value="89%" trend="+2.1% vs last month" up />
                            <KpiCard title="Energy Loss" value="2,340 kWh" trend="+0.8% this week" up={false} />
                            <KpiCard title="Carbon Emissions" value="1,540 kg" trend="-5.2% this month" up />
                        </View>
                    )}
                    {activeTab === 'losses' && (
                        <View style={S.card}><Text style={S.cardTitle}>High Conversion Loss Sites</Text><STable headers={['Site', 'Loss (kWh)', 'Status']} rows={[['Delhi-Central-01', '312', '🔴 Critical'], ['Kolkata-East-12', '288', '🟡 Review'], ['Mumbai-West-19', '261', '🔵 Attention'], ['Chennai-South-05', '240', '🟢 Normal']]} /></View>
                    )}
                    {activeTab === 'voltage' && (
                        <View style={S.card}><Text style={S.cardTitle}>Low Voltage Sites</Text><STable headers={['Site', 'Voltage (V)', 'Status', 'Action']} rows={[['Patna-North-09', '173', '🔴 Critical', 'Dispatch engineer'], ['Vadodara-South-04', '182', '🟡 Low', 'Remote battery check'], ['Ranchi-East-08', '190', '🔵 Attention', 'Monitor 24h']]} /></View>
                    )}
                    {activeTab === 'power' && (
                        <View style={S.card}><Text style={S.cardTitle}>SO vs Actual Power (Top Sites)</Text><STable headers={['Site', 'SO (kW)', 'Actual (kW)', 'Diff']} rows={[['Delhi-Central', '60', '52', '-8'], ['Mumbai-West', '58', '63', '+5'], ['Kolkata-East', '56', '54', '-2'], ['Bengaluru-North', '62', '65', '+3'], ['Jaipur-City', '75', '63', '-12']]} /></View>
                    )}
                    {activeTab === 'powerfactor' && (
                        <View style={S.card}><Text style={S.cardTitle}>Power Factor Analysis</Text><STable headers={['Site', 'PF', 'Status', 'Penalty']} rows={[['Delhi-Central-01', '0.82', '🟡 Warning', '₹465'], ['Kolkata-East-12', '0.91', '🟢 Normal', 'No penalty'], ['Mumbai-West-19', '0.88', '🔵 Attention', 'Monitoring'], ['Chennai-South-05', '0.80', '🔴 Critical', '₹610']]} /></View>
                    )}
                    {activeTab === 'sanctioned' && (
                        <View style={S.card}><Text style={S.cardTitle}>Load Optimization</Text><View style={S.warnBanner}><Icon name="alert-triangle" size={14} color="#f59e0b" /><Text style={{ fontSize: responsiveFontSize(11), color: '#f59e0b', fontWeight: '600', flex: 1 }}>1 site within 5% of sanctioned load limit.</Text></View><STable headers={['Site', 'Sanctioned (kW)', 'Current (kW)', 'Status']} rows={[['Delhi-Central-01', '60', '58', '🟡 Approaching'], ['Jaipur-City-03', '75', '63', '🟢 Normal'], ['Chennai-South-05', '80', '72', '🔵 Attention']]} /></View>
                    )}
                    {activeTab === 'events' && (
                        <View>
                            {[
                                { title: "Cyclone 'Varun' Monitoring", type: 'Critical', color: C.danger, detail: "Emergency protocols active for 43 sites. Battery backup completed. 2 sites reported grid outages." },
                                { title: "Rath Yatra Coverage", type: 'Festival', color: C.warning, detail: "Load increased 18% in covered regions. Additional generator deployed. No downtime reported." },
                                { title: "VVIP Visit Monitoring", type: 'VVIP', color: '#3b82f6', detail: "High-availability enabled for 15 city sites. Status updates every 15 min. 1 minor voltage dip resolved." },
                            ].map(ev => (
                                <View key={ev.title} style={[S.eventCard, { borderLeftColor: ev.color }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(8) }}><Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', flex: 1 }}>{ev.title}</Text><View style={{ paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 12, backgroundColor: `${ev.color}15`, borderWidth: 1, borderColor: ev.color }}><Text style={{ fontSize: responsiveFontSize(9), fontWeight: '800', color: ev.color }}>{ev.type}</Text></View></View><Text style={{ fontSize: responsiveFontSize(11), color: '#64748b', lineHeight: 17 }}>{ev.detail}</Text></View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
            </View>

            <Modal visible={filterModal} transparent animationType="fade">
                <TouchableOpacity style={FM.overlay} onPress={() => setFilterModal(false)} activeOpacity={1}><View style={FM.box}><Text style={FM.title}>Filter Type</Text>{FILTER_TYPES.map(f => (<TouchableOpacity key={f.v} style={[FM.opt, filterType === f.v && FM.optActive]} onPress={() => applyFilter(f.v)}><Text style={[FM.optTxt, filterType === f.v && { color: C.primary, fontWeight: '800' }]}>{f.l}</Text>{filterType === f.v && <Icon name="check" size={14} color={C.primary} />}</TouchableOpacity>))}</View></TouchableOpacity>
            </Modal>

            <Sidebar isVisible={isSidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation} fullname={fullname} activeRoute="OptimizationReports" handleLogout={async () => { await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']); navigation.replace('Login'); }} />
            </View>
        </SafeAreaView>
    );
}

const FM = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: moderateScale(40) },
    box: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(20) },
    title: { fontSize: responsiveFontSize(15), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(14) },
    opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: verticalScale(12), paddingHorizontal: moderateScale(10), borderRadius: 10, marginBottom: verticalScale(4) },
    optActive: { backgroundColor: `${C.primary}10` },
    optTxt: { fontSize: responsiveFontSize(13), color: '#334155', fontWeight: '600' },
});

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: C.primary, fontWeight: '600', fontSize: responsiveFontSize(13) },
    tabBarContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabScroll: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), gap: 6, alignItems: 'center' },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: moderateScale(11), paddingVertical: verticalScale(7), borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    tabBtnActive: { backgroundColor: `${C.primary}12`, borderColor: C.primary },
    tabTxt: { fontSize: responsiveFontSize(10), fontWeight: '700', color: '#64748b' },
    tabTxtActive: { color: C.primary },
    resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#64748b', borderRadius: 10, paddingHorizontal: moderateScale(15), paddingVertical: verticalScale(8), elevation: 1 },
    resetTxt: { color: '#fff', fontSize: responsiveFontSize(12), fontWeight: '700' },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2 },
    cardTitle: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(14) },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), borderWidth: 1.5, borderColor: '#d0e4f7', elevation: 1 },
    filterBtnTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: C.primary },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), elevation: 1, gap: 6 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(11), color: '#0f172a', fontWeight: '500' },
    rowCount: { fontSize: responsiveFontSize(10), fontWeight: '800', color: '#64748b', marginBottom: verticalScale(8), textTransform: 'uppercase', letterSpacing: 0.5 },
    pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: verticalScale(16) },
    pageBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), elevation: 1 },
    pageBtnDis: { opacity: 0.4 },
    pageBtnTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: C.primary },
    pageInfo: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#1e293b' },
    errBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(30) },
    errTxt: { color: C.danger, fontSize: responsiveFontSize(13), fontWeight: '600', marginTop: verticalScale(12), marginBottom: verticalScale(16), textAlign: 'center' },
    retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(10) },
    retryTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13) },
    warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: moderateScale(10), marginBottom: verticalScale(12), borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
    eventCard: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(16), marginBottom: verticalScale(12), borderLeftWidth: 5, elevation: 2 },
});