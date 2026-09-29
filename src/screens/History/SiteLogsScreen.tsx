/**
 * SiteLogsScreen.tsx
 * API: GET /api/site-logs/
 * Params: start_date, end_date, state_id, district_id, cluster_id,
 *         site_id, site_name, imei, page, page_size
 *
 * Response:
 * {
 *   status, data[], columns[], total_records,
 *   current_page, total_pages, page_size,
 *   has_previous, has_next
 * }
 */

import React, { useState, useCallback } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    FlatList, TextInput, Modal, Share, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../api';
import LinearGradient from 'react-native-linear-gradient';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

const { width: SW } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgoStr(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}

const COL_LABELS: Record<string, string> = {
    state_id: 'State', dist_id: 'District', cluster_id: 'Cluster',
    gsm_imei_no: 'IMEI', site_name: 'Site Name', globel_id: 'Global ID',
    companyName: 'Company', mainsVoltR: 'Mains R', mainsVoltY: 'Mains Y',
    mainsVoltB: 'Mains B', dgVoltR: 'DG R', dgVoltY: 'DG Y', dgVoltB: 'DG B',
    dgBattVolt: 'DG Batt', btsBattVolt: 'BTS Batt', site_id: 'Site ID',
    kwhMains: 'kWh Mains', kwhDG1: 'kWh DG1', kwhDG2: 'kWh DG2',
    kwhOperator1: 'kWh Op1', kwhOperator2: 'kWh Op2',
    kwhOperator3: 'kWh Op3', kwhOperator4: 'kWh Op4',
    room_temp: 'Temp', Mains_Frequency: 'Mains Hz',
    dgFreq: 'DG Hz', updated_dt: 'Updated',
};

function colLabel(col: string): string {
    return COL_LABELS[col] || col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function fmtTs(ts: any) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function fmtVal(col: string, val: any): string {
    if (val === null || val === undefined) return '—';
    if (col === 'updated_dt') return fmtTs(val);
    if (typeof val === 'number') {
        if (col.includes('olt')) return val.toFixed(2) + 'V';
        if (col.includes('kwh')) return val.toFixed(3);
        if (col.includes('temp') || col.includes('Freq')) return val.toFixed(1);
        return String(val);
    }
    return String(val) || '—';
}

// Priority columns to show in card summary
const SUMMARY_COLS = [
    'site_name', 'site_id', 'mainsVoltR', 'mainsVoltY', 'mainsVoltB',
    'btsBattVolt', 'dgBattVolt', 'room_temp', 'updated_dt',
];

// ─── Log Card ─────────────────────────────────────────────────
function LogCard({ row, columns }: { row: any; columns: string[] }) {
    const [open, setOpen] = useState(false);
    const mainV = (parseFloat(row.mainsVoltR) || parseFloat(row.mainsVoltY) || 0);
    const mainColor = mainV > 200 ? '#10b981' : mainV > 0 ? '#f59e0b' : '#ef4444';

    return (
        <TouchableOpacity style={LC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            {/* Header row */}
            <View style={LC.top}>
                <View style={{ flex: 1 }}>
                    <Text style={LC.name} numberOfLines={1}>{row.site_name || '—'}</Text>
                    <Text style={LC.id}>Global ID: {row.global_id || row.globel_id || row.site_id}  ·  SID: {row.site_id || '—'}  ·  IMEI: {row.gsm_imei_no || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[LC.voltBadge, { backgroundColor: `${mainColor}18`, borderColor: mainColor }]}>
                        <Text style={[LC.voltTxt, { color: mainColor }]}>
                            {mainV > 0 ? `${fmtVal('mainsVoltR', row.mainsVoltR)}` : 'No Mains'}
                        </Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>

            {/* Quick stats */}
            <View style={LC.quickRow}>
                {[
                    { l: 'Mains R', v: fmtVal('mainsVoltR', row.mainsVoltR) },
                    { l: 'Mains Y', v: fmtVal('mainsVoltY', row.mainsVoltY) },
                    { l: 'BTS Batt', v: fmtVal('btsBattVolt', row.btsBattVolt) },
                    { l: 'DG Batt', v: fmtVal('dgBattVolt', row.dgBattVolt) },
                ].map(x => (
                    <View key={x.l} style={LC.quickItem}>
                        <Text style={LC.quickVal}>{x.v}</Text>
                        <Text style={LC.quickLab}>{x.l}</Text>
                    </View>
                ))}
            </View>

            {/* Expanded — all columns */}
            {open && (
                <View style={LC.detail}>
                    <View style={LC.divider} />
                    {columns.map(col => {
                        if (['site_name', 'site_id', 'global_id', 'globel_id', 'gsm_imei_no'].includes(col)) return null;
                        return (
                            <View key={col} style={LC.detailRow}>
                                <Text style={LC.detailLabel}>{colLabel(col)}</Text>
                                <Text style={LC.detailValue}>{fmtVal(col, row[col])}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </TouchableOpacity>
    );
}
const LC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), marginBottom: verticalScale(8), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
    top: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(10) },
    name: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    id: { fontSize: responsiveFontSize(9), color: '#64748b', fontFamily: 'monospace' },
    voltBadge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    voltTxt: { fontSize: responsiveFontSize(10), fontWeight: '800' },
    quickRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 10, padding: moderateScale(10), marginBottom: verticalScale(4) },
    quickItem: { flex: 1, alignItems: 'center' },
    quickVal: { fontSize: responsiveFontSize(11), fontWeight: '800', color: '#0f172a' },
    quickLab: { fontSize: responsiveFontSize(8), color: '#64748b', fontWeight: '600', marginTop: verticalScale(1) },
    detail: { marginTop: verticalScale(8) },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    detailLabel: { fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '600' },
    detailValue: { fontSize: responsiveFontSize(11), color: '#1e293b', fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
});

// ─── Filter Drawer ────────────────────────────────────────────
function FilterDrawer({ visible, onClose, filters, setFilters, onApply }: any) {
    const [showStart, setShowStart] = useState(false);
    const [showEnd, setShowEnd] = useState(false);
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={FD.overlay}>
                <View style={FD.drawer}>
                    <View style={FD.header}>
                        <Text style={FD.title}>Filters</Text>
                        <TouchableOpacity onPress={onClose}><AppIcon name="x" size={22} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ paddingBottom: verticalScale(24) }}>
                        {[
                            { key: 'start_date', label: 'START DATE', placeholder: 'YYYY-MM-DD', isDate: true },
                            { key: 'end_date', label: 'END DATE', placeholder: 'YYYY-MM-DD', isDate: true },
                            { key: 'site_id', label: 'SITE ID', placeholder: 'e.g. 446358' },
                            { key: 'global_id', label: 'GLOBAL ID', placeholder: 'Global ID' },
                            { key: 'site_name', label: 'SITE NAME', placeholder: 'Search...' },
                            { key: 'imei', label: 'IMEI', placeholder: 'Enter IMEI number' },
                            { key: 'state_id', label: 'STATE ID', placeholder: 'State ID' },
                            { key: 'district_id', label: 'DISTRICT ID', placeholder: 'District ID' },
                            { key: 'cluster_id', label: 'CLUSTER ID', placeholder: 'Cluster ID' },
                        ].map(f => (
                            <View key={f.key}>
                                <Text style={FD.label}>{f.label}</Text>
                                {f.isDate ? (
                                    <TouchableOpacity style={FD.input} onPress={() => f.key === 'start_date' ? setShowStart(true) : setShowEnd(true)}>
                                        <Text style={{ color: filters[f.key] ? '#1e293b' : '#94a3b8' }}>{filters[f.key] || f.placeholder}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TextInput
                                        style={FD.input}
                                        value={filters[f.key] || ''}
                                        onChangeText={v => setFilters((prev: any) => ({ ...prev, [f.key]: v }))}
                                        placeholder={f.placeholder}
                                        placeholderTextColor="#94a3b8"
                                    />
                                )}
                            </View>
                        ))}

                        {showStart && (
                            <DateTimePicker
                                value={filters.start_date ? new Date(filters.start_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowStart(false);
                                    if (d) setFilters((prev: any) => ({ ...prev, start_date: d.toISOString().split('T')[0] }));
                                }}
                            />
                        )}

                        {showEnd && (
                            <DateTimePicker
                                value={filters.end_date ? new Date(filters.end_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowEnd(false);
                                    if (d) setFilters((prev: any) => ({ ...prev, end_date: d.toISOString().split('T')[0] }));
                                }}
                            />
                        )}

                        {/* Date presets */}
                        <Text style={FD.label}>QUICK DATE</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: verticalScale(16) }}>
                            {[
                                { l: 'Today', s: todayStr(), e: todayStr() },
                                { l: 'Yesterday', s: daysAgoStr(1), e: daysAgoStr(1) },
                                { l: '7 Days', s: daysAgoStr(7), e: todayStr() },
                                { l: '30 Days', s: daysAgoStr(30), e: todayStr() },
                            ].map(p => (
                                <TouchableOpacity key={p.l}
                                    style={[FD.chip, filters.start_date === p.s && filters.end_date === p.e && FD.chipActive]}
                                    onPress={() => setFilters((prev: any) => ({ ...prev, start_date: p.s, end_date: p.e }))}
                                >
                                    <Text style={[FD.chipTxt, filters.start_date === p.s && FD.chipTxtActive]}>{p.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={FD.applyBtn} onPress={() => { onApply(); onClose(); }}>
                            <AppIcon name="filter" size={14} color="#fff" />
                            <Text style={FD.applyTxt}>Apply Filters</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={FD.resetBtn}
                            onPress={() => setFilters({ start_date: daysAgoStr(1), end_date: daysAgoStr(1) })}>
                            <Text style={FD.resetTxt}>Reset</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
const FD = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    drawer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: moderateScale(20), maxHeight: '85%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(16) },
    title: { fontSize: responsiveFontSize(16), fontWeight: '800', color: '#0f172a' },
    label: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#5B9BD5', marginBottom: verticalScale(4), marginTop: verticalScale(10), textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), fontSize: responsiveFontSize(12), color: '#0f172a', fontWeight: '600', borderWidth: 1.5, borderColor: '#d0e4f7', marginBottom: verticalScale(2) },
    chip: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#d0e4f7' },
    chipActive: { backgroundColor: '#5B9BD5', borderColor: '#5B9BD5' },
    chipTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#64748b' },
    chipTxtActive: { color: '#fff' },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5B9BD5', borderRadius: 12, paddingVertical: verticalScale(14), marginBottom: verticalScale(10), marginTop: verticalScale(8) },
    applyTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14) },
    resetBtn: { alignItems: 'center', paddingVertical: verticalScale(8) },
    resetTxt: { color: '#5B9BD5', fontWeight: '700', fontSize: responsiveFontSize(13) },
});

// ─── MAIN ─────────────────────────────────────────────────────
export default function SiteLogsScreen({ navigation }: any) {
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [search, setSearch] = useState('');
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        start_date: daysAgoStr(1),
        end_date: daysAgoStr(1),
    });

    React.useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (page = 1, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const params = { ...filters, page, page_size: 20 };
            const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
            const res = await (api as any).getSiteLogs(clean);

            if (res?.status === 'success') {
                setData(res.data || []);
                setColumns(res.columns || []);
                setCurrentPage(res.current_page || 1);
                setTotalPages(res.total_pages || 1);
                setTotalRecords(res.total_records || 0);
                setHasLoaded(true);
            } else {
                setError(res?.message || 'No data found');
                setData([]);
            }
        } catch (e: any) {
            setError(e.message || 'Network error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters]);

    const onRefresh = () => { setRefreshing(true); fetchData(currentPage, true); };
    const onApply = () => { setData([]); fetchData(1); };

    const filtered = data.filter(row =>
        !search ||
        row.site_name?.toLowerCase().includes(search.toLowerCase()) ||
        row.global_id?.toLowerCase().includes(search.toLowerCase()) ||
        row.globel_id?.toLowerCase().includes(search.toLowerCase()) ||
        row.site_id?.toLowerCase().includes(search.toLowerCase()) ||
        row.gsm_imei_no?.includes(search)
    );

    const handleShare = async () => {
        if (!data.length) return;
        setExporting(true);
        const title = `"SITE LOGS REPORT (${filters.start_date} to ${filters.end_date})"`;
        const header = columns.map(c => colLabel(c)).join(',');
        const rows = data.map(row => 
            columns.map(col => `"${fmtVal(col, row[col])}"`).join(',')
        );
        const csvContent = [title, '', header, ...rows].join('\n');

        const path = `${RNFS.TemporaryDirectoryPath}/site_logs_${Date.now()}.csv`;
        
        try {
            await RNFS.writeFile(path, csvContent, 'utf8');
            await RNShare.open({
                url: `file://${path}`,
                type: 'text/csv',
                filename: 'Site_Logs_Report',
                title: 'Share Site Logs'
            });
        } catch (e: any) {
            console.log('Export error:', e);
            try { await Share.share({ message: csvContent, title: 'Logs Export' }); } catch (err) {}
        } finally {
            setExporting(false);
        }
    };

    const dateLabel = filters.start_date === filters.end_date
        ? filters.start_date
        : `${filters.start_date} - ${filters.end_date}`;

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="SITE LOGS"
                subtitle={hasLoaded ? `${totalRecords} records  ·  ${dateLabel}` : 'Apply filters to load'}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleShare },
                    { icon: 'filter', onPress: () => setFilterVisible(true) },
                ]}
            />

            {!hasLoaded ? (
                <View style={styles.emptyBox}>
                    <AppIcon name="database" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTxt}>Apply filters to load site logs</Text>
                    <TouchableOpacity style={styles.filterPromptBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.8}>
                        <AppIcon name="sliders" size={14} color="#fff" />
                        <Text style={styles.filterPromptTxt}>Open Filters</Text>
                    </TouchableOpacity>
                </View>
            ) : loading ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#5B9BD5" />
                    <Text style={styles.loaderTxt}>Loading site logs...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, i) => `${item.gsm_imei_no || i}_${item.updated_dt || i}`}
                    contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5B9BD5']} />}
                    ListHeaderComponent={
                        <View>
                            {error ? (
                                <View style={styles.errorBox}>
                                    <AppIcon name="alert-circle" size={16} color="#ef4444" />
                                    <Text style={styles.errorTxt}>{error}</Text>
                                </View>
                            ) : null}
                            <View style={styles.searchRow}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search Global ID, Name, ID, IMEI..."
                                    placeholderTextColor="#94a3b8"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {!!search && <TouchableOpacity onPress={() => setSearch('')}><AppIcon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsCount}>{filtered.length} of {totalRecords} records</Text>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => <LogCard row={item} columns={columns} />}
                    ListFooterComponent={
                        totalPages > 1 ? (
                            <View style={styles.pagination}>
                                <TouchableOpacity
                                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage > 1) fetchData(1); }}
                                    disabled={currentPage === 1}
                                >
                                    <Text style={styles.pageBtnTxt}>First</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage > 1) fetchData(currentPage - 1); }}
                                    disabled={currentPage === 1}
                                >
                                    <AppIcon name="chevron-left" size={14} color="#5B9BD5" />
                                </TouchableOpacity>
                                <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
                                <TouchableOpacity
                                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage < totalPages) fetchData(currentPage + 1); }}
                                    disabled={currentPage === totalPages}
                                >
                                    <AppIcon name="chevron-right" size={14} color="#5B9BD5" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage < totalPages) fetchData(totalPages); }}
                                    disabled={currentPage === totalPages}
                                >
                                    <Text style={styles.pageBtnTxt}>Last</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <AppIcon name="inbox" size={36} color="#cbd5e1" />
                            <Text style={styles.emptyTxt}>
                                {error || 'No records found. Try different filters.'}
                            </Text>
                        </View>
                    }
                />
            )}

            <FilterDrawer
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filters={filters}
                setFilters={setFilters}
                onApply={onApply}
            />

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="SiteLogs"
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
    loaderTxt: { marginTop: verticalScale(12), color: '#5B9BD5', fontWeight: '600', fontSize: responsiveFontSize(13) },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(8), elevation: 1, gap: 8 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(12), color: '#0f172a', fontWeight: '500' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) },
    statsCount: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#64748b' },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#5B9BD5', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6) },
    exportTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(11) },
    pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: verticalScale(16) },
    pageBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), elevation: 1 },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#5B9BD5' },
    pageInfo: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#233344' },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(60) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(13), marginTop: verticalScale(12), fontWeight: '500', textAlign: 'center', paddingHorizontal: moderateScale(30) },
    filterPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5B9BD5', borderRadius: 12, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(12), marginTop: verticalScale(16) },
    filterPromptTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13) },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(10) },
    errorTxt: { flex: 1, fontSize: responsiveFontSize(12), color: '#ef4444', fontWeight: '600' },
});