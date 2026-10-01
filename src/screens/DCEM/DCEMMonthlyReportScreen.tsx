import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import LinearGradient from 'react-native-linear-gradient';
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

const convertToCSV = (objArray: any[], meta: any) => {
    if (!objArray || objArray.length === 0) return '';
    const headers = [
        'IMEI', 'Global ID', 'Site ID', 'Site Name', 'Month', 'Readings', 'Total kWh', 'Avg Load', 'Avg Curr', 'Max Curr', 'Min Curr',
        'CH1 Cons', 'CH1 Open', 'CH1 Close',
        'CH2 Cons', 'CH2 Open', 'CH2 Close',
        'CH3 Cons', 'CH3 Open', 'CH3 Close',
        'CH4 Cons', 'CH4 Open', 'CH4 Close'
    ];
    const csvRows = [headers.join(',')];

    for (const row of objArray) {
        const ch = row.channels || {};
        const values = [
            `"${row.imei || ''}"`,
            `"${row.global_id || ''}"`,
            `"${row.site_id || ''}"`,
            `"${(row.site_name || '').replace(/"/g, '""')}"`,
            `"${row.month_year || ''}"`,
            `"${row.total_readings || 0}"`,
            `"${meta.total_load_consumed || 0}"`,
            `"${meta.avg_load_per_site || 0}"`,
            `"${meta.total_avgCurr_all || 0}"`,
            `"${row.overall_max_current || 0}"`,
            `"${row.overall_min_current || 0}"`,
            // CH1
            `"${fmt(row.operator1_consumption || ch.ch1?.consumption)}"`,
            `"${fmt(row.start_operator1 || ch.ch1?.opening_kwh)}"`,
            `"${fmt(row.end_operator1 || ch.ch1?.closing_kwh)}"`,
            // CH2
            `"${fmt(row.operator2_consumption || ch.ch2?.consumption)}"`,
            `"${fmt(row.start_operator2 || ch.ch2?.opening_kwh)}"`,
            `"${fmt(row.end_operator2 || ch.ch2?.closing_kwh)}"`,
            // CH3
            `"${fmt(row.operator3_consumption || ch.ch3?.consumption)}"`,
            `"${fmt(row.start_operator3 || ch.ch3?.opening_kwh)}"`,
            `"${fmt(row.end_operator3 || ch.ch3?.closing_kwh)}"`,
            // CH4
            `"${fmt(row.operator4_consumption || ch.ch4?.consumption)}"`,
            `"${fmt(row.start_operator4 || ch.ch4?.opening_kwh)}"`,
            `"${fmt(row.end_operator4 || ch.ch4?.closing_kwh)}"`,
        ];
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

const CH_COLORS = ['#e74c3c', '#f39c12', '#27ae60', '#3498db'];
const CH_BG = ['rgba(231,76,60,0.08)', 'rgba(243,156,18,0.08)', 'rgba(39,174,96,0.08)', 'rgba(52,152,219,0.08)'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ─── Small stat cell ─────────────────────────────────────────
function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <View style={SC.cell}>
            <Text style={[SC.val, color ? { color } : {}]}>{value}</Text>
            <Text style={SC.lab}>{label}</Text>
        </View>
    );
}
const SC = StyleSheet.create({
    cell: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(10), paddingHorizontal: moderateScale(4) },
    val: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    lab: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#64748b', fontWeight: '600', textAlign: 'center' },
});

// ─── Channel Card ─────────────────────────────────────────────
function ChannelCard({ num, ch, consumption, avgCur, maxCur, minCur, load, opening, closing }: {
    num: number; ch: any;
    consumption: number; avgCur: number; maxCur: number; minCur: number;
    load: number; opening: number; closing: number;
}) {
    const color = CH_COLORS[num - 1];
    const bg = CH_BG[num - 1];

    return (
        <View style={[CCS.card, { borderLeftColor: color }]}>
            {/* Header */}
            <View style={CCS.header}>
                <Text style={CCS.chName} numberOfLines={1}>{ch?.name || `Channel ${num}`}</Text>
                <View style={[CCS.numBadge, { backgroundColor: color }]}>
                    <Text style={CCS.numTxt}>{num}</Text>
                </View>
            </View>

            {/* Stats grid */}
            <View style={[CCS.grid, { backgroundColor: bg }]}>
                <View style={CCS.gridRow}>
                    <StatCell label="Consumption (kWh)" value={fmt(consumption)} color={color} />
                    <StatCell label="Avg Current" value={`${fmt(avgCur)}A`} />
                </View>
                <View style={CCS.gridRow}>
                    <StatCell label="Max Current" value={`${fmt(maxCur)}A`} />
                    <StatCell label="Min Current" value={`${fmt(minCur)}A`} />
                </View>
                <View style={CCS.gridRow}>
                    <StatCell label="Avg Load (kW)" value={fmt(load)} />
                    <StatCell label="— " value=" " />
                </View>
            </View>

            {/* KWH readings */}
            <View style={CCS.kwhRow}>
                <View style={CCS.kwhBox}>
                    <Text style={CCS.kwhVal}>{fmt(opening)}</Text>
                    <Text style={CCS.kwhLbl}>Opening kWh</Text>
                </View>
                <AppIcon name="arrow-right" size={14} color="#94a3b8" />
                <View style={CCS.kwhBox}>
                    <Text style={[CCS.kwhVal, { color }]}>{fmt(closing)}</Text>
                    <Text style={CCS.kwhLbl}>Closing kWh</Text>
                </View>
            </View>
        </View>
    );
}
const CCS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), marginBottom: verticalScale(12), borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(12) },
    chName: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a', flex: 1 },
    numBadge: { width: moderateScale(32), height: verticalScale(32), borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    numTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14), flexShrink: 1, },
    grid: { borderRadius: 10, marginBottom: verticalScale(12), overflow: 'hidden' },
    gridRow: { flexDirection: 'row' },
    kwhRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(52,152,219,0.08)', borderRadius: 10, padding: moderateScale(12) },
    kwhBox: { alignItems: 'center' },
    kwhVal: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    kwhLbl: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: verticalScale(2) },
});

// ─── IMEI Section ─────────────────────────────────────────────
function ImeiSection({ row, data }: { row: any; data: any }) {
    const ch = row.channels || {};

    return (
        <View style={IS.wrap}>
            <View style={IS.header}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <View style={IS.tag}>
                        <Text style={IS.imeiTxt}>IMEI: {row.imei}</Text>
                    </View>
                    <View style={IS.tag}>
                        <Text style={IS.siteTxt}>{row.site_name}</Text>
                    </View>
                    <View style={IS.tag}>
                        <Text style={IS.siteTxt}>Global ID: {row.global_id || row.site_id || '—'}</Text>
                    </View>
                    <View style={[IS.tag, { backgroundColor: 'rgba(219, 39, 119, 0.2)' }]}>
                        <Text style={[IS.siteTxt, { color: '#fff' }]}>{row.total_readings} Readings</Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={IS.tag}>
                        <Text style={IS.monthTxt}>{row.month_year}</Text>
                    </View>
                </View>
            </View>

            {/* Summary KPIs */}
            <View style={IS.kpiSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {[
                        { l: 'Total Consumption', v: `${data.total_load_consumed || 0} kWh`, c: '#10b981' },
                        { l: 'Total Readings', v: String(row.total_readings || 0), c: '#db2777' },
                        { l: 'Overall Avg Current', v: `${fmt(data.total_avgCurr_all)}A`, c: '#ef4444' },
                        { l: 'Max Current', v: `${fmt(row.overall_max_current)}A`, c: '#f59e0b' },
                        { l: 'Min Current', v: `${fmt(row.overall_min_current)}A`, c: '#10b981' },
                        { l: 'Avg Voltage', v: `${fmt(data.overall_avg_voltage, 1)}V`, c: '#8b5cf6' },
                        { l: 'Max Voltage', v: `${fmt(data.overall_max_voltage, 1)}V`, c: '#06b6d4' },
                        { l: 'Min Voltage', v: `${fmt(data.overall_min_voltage, 1)}V`, c: '#64748b' },
                        { l: 'Avg Power', v: `${data.total_avg_power_all || 0}KW`, c: '#f59e0b' },
                        { l: 'Period Start', v: row.month_start_date || '—', c: '#3b82f6' },
                        { l: 'Period End', v: row.month_end_date || '—', c: '#3b82f6' },
                    ].map(k => (
                        <View key={k.l} style={[IS.kpiCard, { borderTopColor: k.c }]}>
                            <Text style={[IS.kpiVal, { color: k.c }]}>{k.v}</Text>
                            <Text style={IS.kpiLbl}>{k.l}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {/* Channel cards */}
            <View style={{ paddingHorizontal: moderateScale(14), paddingBottom: verticalScale(14), backgroundColor: '#fff', marginHorizontal: moderateScale(14), borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
                <Text style={IS.sectionTitle}>Channel-wise Energy Analysis</Text>
                {[1, 2, 3, 4].map(n => (
                    <ChannelCard
                        key={n}
                        num={n}
                        ch={ch[`ch${n}`]}
                        consumption={row[`operator${n}_consumption`] || ch[`ch${n}`]?.consumption || 0}
                        avgCur={row[`independent_avg_cur${n}`] || ch[`ch${n}`]?.avg_current || 0}
                        maxCur={row[`independent_max_cur${n}`] || ch[`ch${n}`]?.max_current || 0}
                        minCur={row[`independent_min_cur${n}`] || ch[`ch${n}`]?.min_current || 0}
                        load={row[`operator${n}_load`] || ch[`ch${n}`]?.avg_load_kw || 0}
                        opening={row[`start_operator${n}`] || ch[`ch${n}`]?.opening_kwh || 0}
                        closing={row[`end_operator${n}`] || ch[`ch${n}`]?.closing_kwh || 0}
                    />
                ))}
            </View>

            {/* Summary table row */}
            <View style={[IS.tableWrap, { backgroundColor: '#fff', marginHorizontal: moderateScale(14), borderRadius: 14, marginTop: verticalScale(12), padding: moderateScale(14) }]}>
                <Text style={[IS.sectionTitle, { paddingHorizontal: moderateScale(0) }]}>Summary Table</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        {/* Header */}
                        <View style={IS.tRow}>
                            {[
                                'IMEI', 'Global ID', 'Site ID', 'Site', 'Month', 'Readings',
                                'CH1 Cons', 'CH1 Opening', 'CH1 Closing',
                                'CH2 Cons', 'CH2 Opening', 'CH2 Closing',
                                'CH3 Cons', 'CH3 Opening', 'CH3 Closing',
                                'CH4 Cons', 'CH4 Opening', 'CH4 Closing',
                                'Total', 'Avg Load', 'Avg Curr', 'Max Curr', 'Min Curr', 'Peak', 'Avg Volt', 'Min Volt'
                            ].map(h => (
                                <Text key={h} style={IS.tHead}>{h}</Text>
                            ))}
                        </View>
                        {/* Data */}
                        <View style={[IS.tRow, { backgroundColor: '#f8fafc' }]}>
                            {[
                                row.imei,
                                row.global_id,
                                row.site_id,
                                row.site_name,
                                row.month_year,
                                row.total_readings,
                                // CH 1
                                fmt(row.operator1_consumption || ch.ch1?.consumption),
                                fmt(row.start_operator1 || ch.ch1?.opening_kwh),
                                fmt(row.end_operator1 || ch.ch1?.closing_kwh),
                                // CH 2
                                fmt(row.operator2_consumption || ch.ch2?.consumption),
                                fmt(row.start_operator2 || ch.ch2?.opening_kwh),
                                fmt(row.end_operator2 || ch.ch2?.closing_kwh),
                                // CH 3
                                fmt(row.operator3_consumption || ch.ch3?.consumption),
                                fmt(row.start_operator3 || ch.ch3?.opening_kwh),
                                fmt(row.end_operator3 || ch.ch3?.closing_kwh),
                                // CH 4
                                fmt(row.operator4_consumption || ch.ch4?.consumption),
                                fmt(row.start_operator4 || ch.ch4?.opening_kwh),
                                fmt(row.end_operator4 || ch.ch4?.closing_kwh),

                                fmt(data.total_load_consumed),
                                fmt(data.avg_load_per_site),
                                fmt(data.total_avgCurr_all),
                                fmt(row.overall_max_current),
                                fmt(row.overall_min_current),
                                fmt(row.peak_current),
                                fmt(row.avg_voltage, 1),
                                fmt(row.min_voltage, 1),
                            ].map((v, i) => (
                                <Text key={i} style={IS.tCell}>{v ?? '—'}</Text>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const IS = StyleSheet.create({
    wrap: { marginBottom: verticalScale(20) },
    header: { 
        padding: moderateScale(12), 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#1e3c72', 
        borderBottomWidth: 1, 
        borderBottomColor: 'rgba(255,255,255,0.1)',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        marginHorizontal: moderateScale(14),
        marginTop: verticalScale(10)
    },
    tag: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(5),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    imeiTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(12), flexShrink: 1, },
    siteTxt: { color: 'rgba(255,255,255,0.9)', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700' },
    monthTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(11), flexShrink: 1, },
    readingsTxt: { color: '#db2777', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800' },
    kpiSection: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(12), backgroundColor: '#fff', marginHorizontal: moderateScale(14) },
    kpiCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: moderateScale(10), minWidth: 110, borderTopWidth: 3, elevation: 1, alignItems: 'center' },
    kpiVal: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800' },
    kpiLbl: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: verticalScale(2), textAlign: 'center' },
    sectionTitle: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(12), paddingHorizontal: moderateScale(14) },
    tableWrap: { paddingBottom: verticalScale(14) },
    tRow: { flexDirection: 'row' },
    tHead: { width: moderateScale(90), padding: moderateScale(8), fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800', color: '#fff', backgroundColor: '#34495e', borderWidth: 0.5, borderColor: '#2c3e50', textAlign: 'center' },
    tCell: { width: moderateScale(90), padding: moderateScale(8), fontSize: responsiveFontSize(10), flexShrink: 1, color: '#1e293b', borderWidth: 0.5, borderColor: '#e2e8f0', textAlign: 'center', fontFamily: 'monospace' },
});

// ─── MAIN ─────────────────────────────────────────────────────
export default function DCEMMonthlyReportScreen({ navigation, route }: any) {
    const passedImei = route?.params?.imei || '';

    const now = new Date();
    const [imei, setImei] = useState(passedImei);
    const [year, setYear] = useState(String(now.getFullYear()));
    const [month, setMonth] = useState(String(now.getMonth() + 1));
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [searchQuery, setSearchQuery] = useState('');
    const { globalFilters } = useGlobalFilter();

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchReport = useCallback(async (isRefresh = false) => {
        if (!imei.trim()) return;
        if (!isRefresh) setLoading(true);
        try {
            const res = await (api as any).getDCEMMonthlyReport({
                ...globalFilters,
                imei: imei.trim(),
                year: parseInt(year),
                month: parseInt(month),
            });
            setData(res);
        } catch (e) {
            console.log('DCEM Monthly Report error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [imei, year, month, JSON.stringify(globalFilters)]);

    // Auto-fetch if imei passed from navigation
    useEffect(() => {
        if (passedImei) fetchReport();
    }, [JSON.stringify(globalFilters)]);

    const onRefresh = () => { setRefreshing(true); fetchReport(true); };

    const rows = data?.rows || [];

    const filteredRows = useMemo(() => {
        if (!searchQuery) return rows;
        const q = searchQuery.toLowerCase();
        return rows.filter((row: any) => 
            (row.global_id || '').toLowerCase().includes(q) ||
            (row.site_id || '').toLowerCase().includes(q) ||
            (row.site_name || '').toLowerCase().includes(q) ||
            (row.imei || '').toLowerCase().includes(q)
        );
    }, [rows, searchQuery]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="DCEM MONTHLY REPORT"
                    subtitle={`${MONTHS[parseInt(month) - 1]} ${year}`}
                    leftAction={route.params?.showBack ? 'back' : 'menu'}
                    onLeftPress={() => route.params?.showBack ? navigation.goBack() : setSidebarVisible(true)}
                    rightActions={[
                        {
                            icon: exporting ? 'loader' : 'download', onPress: () => {
                                const csv = convertToCSV(rows, data);
                                if (!csv) return Alert.alert('No data', 'Nothing to download.');
                                setExporting(true);
                                const fileName = `DCEM_Monthly_${new Date().getTime()}.csv`;
                                const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
                                RNFS.writeFile(filePath, csv, 'utf8')
                                    .then(() => Share.open({ url: `file://${filePath}`, type: 'text/csv' }))
                                    .catch(err => console.log('Export error:', err))
                                    .finally(() => setExporting(false));
                            }
                        },
                    ]}
                />

            <ScrollView
                style={{ flex: 1, backgroundColor: '#f1f5f9' }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2c3e50']} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Filter section */}
                <View style={styles.filterCard}>
                    <View style={styles.filterHeader}>
                        <AppIcon name="file-text" size={16} color="#fff" />
                        <Text style={styles.filterTitle}>Generate Report</Text>
                    </View>

                    <View style={styles.labelContainer}>
                        <Text style={styles.filterLabel}>IMEI Numbers (comma separated)</Text>
                    </View>
                    <TextInput
                        style={[styles.input, passedImei ? styles.inputDisabled : {}]}
                        value={imei}
                        onChangeText={setImei}
                        placeholder="e.g. 123456789012345, 987654321098765"
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={2}
                        editable={!passedImei}
                    />

                    <View style={styles.filterRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.labelContainer}>
                                <Text style={styles.filterLabel}>Year</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={year}
                                onChangeText={setYear}
                                keyboardType="numeric"
                                placeholder="2025"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={{ width: moderateScale(12) }} />
                        <View style={{ flex: 1 }}>
                            <View style={styles.labelContainer}>
                                <Text style={styles.filterLabel}>Month (1-12)</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={month}
                                onChangeText={setMonth}
                                keyboardType="numeric"
                                placeholder="3"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    {/* Month picker chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: verticalScale(8), marginBottom: verticalScale(14) }}>
                        {MONTHS.map((m, i) => (
                            <TouchableOpacity
                                key={m}
                                onPress={() => setMonth(String(i + 1))}
                                style={[styles.monthChip, parseInt(month) === i + 1 && styles.monthChipActive]}
                            >
                                <Text style={[styles.monthChipTxt, parseInt(month) === i + 1 && styles.monthChipTxtActive]}>
                                    {m.slice(0, 3)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.genBtn}
                        onPress={() => fetchReport()}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <AppIcon name="activity" size={16} color="#fff" />
                                <Text style={styles.genBtnTxt}>Generate Report</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search Bar - only show if we have data */}
                {rows.length > 0 && (
                    <View style={styles.searchContainer}>
                        <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Global ID or Name..."
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
                )}

                {/* Error / info */}
                {data?.status === 'error' && (
                    <View style={styles.errorBox}>
                        <AppIcon name="alert-circle" size={16} color="#ef4444" />
                        <Text style={styles.errorTxt}>{data.message}</Text>
                    </View>
                )}

                {data?.status === 'info' && (
                    <View style={styles.infoBox}>
                        <AppIcon name="info" size={16} color="#3b82f6" />
                        <Text style={styles.infoTxt}>{data.message}</Text>
                    </View>
                )}

                {/* Results */}
                {filteredRows.length > 0 && (
                    <View style={{ paddingBottom: verticalScale(30) }}>
                        <View style={styles.resultHeader}>
                            <Text style={styles.resultTitle}>
                                {data?.month_name}  ·  {filteredRows.length} Result{filteredRows.length > 1 ? 's' : ''}
                            </Text>
                            <Text style={styles.resultSub}>
                                Report generated: {data?.report_generated || '—'}
                            </Text>
                        </View>
                        {filteredRows.map((row: any, i: number) => (
                            <ImeiSection key={row.imei || i} row={row} data={data} />
                        ))}
                    </View>
                )}

                {/* Empty / No Match */}
                {data?.status === 'success' && rows.length > 0 && filteredRows.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <AppIcon name="search" size={38} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No matches found</Text>
                        <Text style={styles.emptySubtitle}>Try searching with different criteria</Text>
                    </View>
                )}

                {data?.status === 'success' && rows.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <AppIcon name="inbox" size={38} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No data found for this period</Text>
                    </View>
                )}
            </ScrollView>

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="DCEMMonthlyReport"
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
    header: { paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(12), flexDirection: 'row', alignItems: 'center' },
    hBtn: { padding: moderateScale(6) },
    hTitle: { color: '#fff', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', letterSpacing: 1 },
    hSub: { color: 'rgba(255,255,255,0.75)', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '600', marginTop: verticalScale(2) },

    filterCard: { margin: moderateScale(14), backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
    filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e3c72', padding: moderateScale(10), margin: -16, marginBottom: verticalScale(16), borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    filterTitle: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#fff' },
    labelContainer: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2), borderRadius: 6, marginBottom: verticalScale(6), marginTop: verticalScale(10), borderWidth: 1, borderColor: '#e2e8f0' },
    filterLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800', color: '#475569' },
    input: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a', fontWeight: '800', borderWidth: 1, borderColor: '#e2e8f0' },
    inputDisabled: { backgroundColor: '#f8fafc', color: '#64748b', borderColor: '#f1f5f9', opacity: 0.8 },
    filterRow: { flexDirection: 'row', marginTop: verticalScale(4) },

    searchContainer: { 
        backgroundColor: '#fff', 
        paddingHorizontal: moderateScale(16), 
        paddingVertical: verticalScale(10), 
        marginHorizontal: moderateScale(14),
        marginBottom: verticalScale(14),
        borderRadius: 12,
        flexDirection: 'row', 
        alignItems: 'center',
        elevation: 1
    },
    searchIcon: { marginRight: moderateScale(10) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', height: verticalScale(40), padding: moderateScale(0) },

    emptyContainer: { alignItems: 'center', paddingVertical: verticalScale(40) },
    emptyText: { color: '#334155', fontSize: responsiveFontSize(16), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '700' },
    emptySubtitle: { color: '#94a3b8', fontSize: responsiveFontSize(14), flexShrink: 1, marginTop: verticalScale(4) },

    monthChip: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6), borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: moderateScale(6), borderWidth: 1, borderColor: '#e2e8f0' },
    monthChipActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    monthChipTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    monthChipTxtActive: { color: '#fff' },

    genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1e3c72', borderRadius: 12, paddingVertical: verticalScale(14) },
    genBtnTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14), flexShrink: 1, },

    errorBox: { margin: moderateScale(14), flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: moderateScale(12) },
    errorTxt: { flex: 1, fontSize: responsiveFontSize(12), flexShrink: 1, color: '#ef4444', fontWeight: '600' },
    infoBox: { margin: moderateScale(14), flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 10, padding: moderateScale(12) },
    infoTxt: { flex: 1, fontSize: responsiveFontSize(12), flexShrink: 1, color: '#3b82f6', fontWeight: '600' },

    resultHeader: { marginHorizontal: moderateScale(14), marginBottom: verticalScale(10) },
    resultTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    resultSub: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', marginTop: verticalScale(2) },
});