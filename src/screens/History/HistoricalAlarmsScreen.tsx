/**
 * HistoricalAlarmsScreen.tsx
 * API: GET /api/historical-alarms/
 * Params: site_id, site_name, global_id, imei, date_from, date_to,
 *         alarm_type (smps/tpms/both), page, page_size
 *
 * Response:
 * {
 *   status,
 *   data: [{
 *     site_id, site_name, alarm_details (or active_alarms/closed_alarms),
 *     severity (computed client-side), status,
 *     site_running_status (SOEB/SODG/SOBT),
 *     active_time_formatted, start_time, end_time,
 *     alarm_type (AMF/SMPS/RMS etc),
 *     start_volt, end_volt
 *   }],
 *   pagination: { current_page, total_pages, total_count, has_next, has_previous, page_size },
 *   total_alarms_count
 * }
 */

import React, { useState, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
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
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

// ─── Helpers ─────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgoStr(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
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

// ─── Severity maps (same as website) ─────────────────────────
const smpsMap: Record<string, string> = {
    HIGH_TEMPERATURE: 'Major', FIRE_and_SMOKE: 'Fire', LOW_BATTERY_VOLTAGE: 'Major',
    MAINS_FAIL: 'Major', DG_ON: 'Major', DG_Failed_to_start: 'Major',
    SITE_ON_BATTERY: 'Major', EMERGENCY_FAULT: 'Minor', ALTERNATOR_FAULT: 'Minor',
    DG_OVERLOAD: 'Minor', DG_FUEL_LEVEL_LOW1: 'Minor', DG_FUEL_LEVEL_LOW2: 'Minor',
    LLOP_FAULT: 'Minor', DG_Failed_to_stop: 'Minor', DOOR_ALARM: 'Minor', reserve: 'Minor',
};
const rmsMap: Record<string, string> = {
    'BB Loop Break': 'Major', 'Rectifier Fail': 'Major', 'RRU Disconnect': 'Major',
    'BTS Open': 'Major', 'RTN Open': 'Major', 'Shelter Loop Break': 'Major',
    'Fiber cut': 'Major', 'camera alarm': 'Major', 'BTS CABLE CUT': 'Major',
    'cable loop break': 'Major', 'DG Battery Disconnected': 'Major', 'High Temperature': 'Major',
    'DC Battery low': 'Major', 'Mains Failed': 'Major', 'Moter 1 Loop Break': 'Major',
    'Moter 2 Loop Break': 'Major', 'Site Battery Low': 'Major', 'DG Common Fault': 'Major',
    'Site On Battery': 'Major', 'BB Cabinet Door Open': 'Major',
    'Fire and smoke 1': 'Fire', 'fire and smoke 2': 'Fire',
    'Door-Open': 'Minor', 'Extra Alarm': 'Minor', 'SOBT': 'Minor', 'Motion 1': 'Minor',
    'Motion 2': 'Minor', 'DG on Load': 'Minor', 'Door Open': 'Minor', 'DOPN': 'Minor',
    'TPMS Supply Failed': 'Minor',
};

function isNight(ts: string) {
    if (!ts) return false;
    const h = new Date(ts).getHours();
    return h >= 22 || h < 6;
}

function getSeverity(alarm: any): 'Fire' | 'NightDoor' | 'Major' | 'Minor' {
    const nl = getAlarmName(alarm).toLowerCase();
    if (nl.includes('fire') || nl.includes('smoke')) return 'Fire';
    if (nl.includes('door') && isNight(alarm.start_time)) return 'NightDoor';
    return (smpsMap[alarm.alarm_name] as any) || (rmsMap[alarm.alarm_name] as any) || 'Major';
}

function getAlarmName(alarm: any): string {
    return alarm.alarm_name || alarm.column_name || '—';
}

function getStatus(alarm: any): 'ACTIVE' | 'CLOSED' {
    return alarm.status === 'OPEN' || alarm.status === 'ACTIVE' ? 'ACTIVE' : 'CLOSED';
}

// ─── Severity colors ─────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
    Fire: '#ef4444', NightDoor: '#8b5cf6', Major: '#f59e0b', Minor: '#eab308',
};
const SEV_BG: Record<string, string> = {
    Fire: 'rgba(239,68,68,0.10)', NightDoor: 'rgba(139,92,246,0.10)',
    Major: 'rgba(245,158,11,0.10)', Minor: 'rgba(234,179,8,0.10)',
};
const SEV_LABEL: Record<string, string> = {
    Fire: 'FIRE & SMOKE', NightDoor: 'NIGHT DOOR', Major: 'MAJOR', Minor: 'MINOR',
};
const STATUS_INFO: Record<string, { color: string; bg: string }> = {
    ACTIVE: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
    CLOSED: { color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
};
const SITE_STATUS_COLOR: Record<string, string> = {
    SOEB: '#10b981', SODG: '#f59e0b', SOBT: '#ef4444',
};

// ─── Alarm Card ───────────────────────────────────────────────
function AlarmCard({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    const status = getStatus(item);
    const name = getAlarmName(item);
    const stInfo = STATUS_INFO[status];

    return (
        <TouchableOpacity style={AC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={AC.top}>
                <View style={{ flex: 1 }}>
                    <Text style={AC.site} numberOfLines={1}>{item.site_name || '—'}</Text>
                    <Text style={AC.siteId}>Site ID: {item.site_id || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[AC.badge, { backgroundColor: stInfo.bg, borderColor: stInfo.color }]}>
                        <Text style={[AC.badgeTxt, { color: stInfo.color }]}>{status}</Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
                </View>
            </View>

            <Text style={AC.alarmName} numberOfLines={open ? undefined : 2}>{name}</Text>

            <View style={AC.quickRow}>
                {[
                    { l: 'Duration', v: item.duration || '—' },
                    { l: 'Start Volt', v: item.start_volt ? `${parseFloat(item.start_volt).toFixed(2)}V` : '—' },
                    { l: 'End Volt', v: item.end_volt ? `${parseFloat(item.end_volt).toFixed(2)}V` : '—' },
                ].map(x => (
                    <View key={x.l} style={AC.quickItem}>
                        <Text style={AC.quickVal} numberOfLines={1}>{x.v}</Text>
                        <Text style={AC.quickLab}>{x.l}</Text>
                    </View>
                ))}
            </View>

            {open && (
                <View style={AC.detail}>
                    <View style={AC.divider} />
                    {[
                        { l: 'Column Name', v: item.column_name || '—' },
                        { l: 'Start Time', v: fmtTs(item.start_time) },
                        { l: 'End Time', v: fmtTs(item.end_time) },
                        { l: 'Table Name', v: item.table_name || '—' },
                    ].map(r => (
                        <View key={r.l} style={AC.detailRow}>
                            <Text style={AC.detailLab}>{r.l}</Text>
                            <Text style={AC.detailVal}>{r.v}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}

const AC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    top: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(10), gap: 8 },
    site: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(4) },
    siteId: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '600' },
    badge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(5), borderRadius: 8, borderWidth: 1 },
    badgeTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', letterSpacing: 0.5 },
    alarmName: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', color: '#3b82f6', marginBottom: verticalScale(12) },
    quickRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: moderateScale(12) },
    quickItem: { flex: 1, alignItems: 'center' },
    quickVal: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    quickLab: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: verticalScale(3) },
    detail: { marginTop: verticalScale(12) },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: verticalScale(10) },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    detailLab: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#475569', fontWeight: '600' },
    detailVal: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', fontWeight: '800', maxWidth: '60%', textAlign: 'right' },
});

// ─── MAIN ─────────────────────────────────────────────────────
export default function HistoricalAlarmsScreen({ navigation }: any) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [exportVisible, setExportVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [search, setSearch] = useState('');
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [error, setError] = useState('');

    const { globalFilters, setGlobalFilters } = useGlobalFilter();

    React.useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (page = 1, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const params = { ...globalFilters, page, limit: 50 };
            if (params.from_date) { params.date_from = params.from_date; delete params.from_date; }
            if (params.to_date) { params.date_to = params.to_date; delete params.to_date; }
            const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
            const res = await (api as any).getHistoricalAlarms(clean);

            if (res?.success === true) {
                setData(res.alarms || []);
                setCurrentPage(page);
                setTotalPages(res.total_pages || Math.ceil((res.total_alarms || 0) / 50) || 1);
                setTotalCount(res.total_alarms || 0);
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
    }, [globalFilters]);

    React.useEffect(() => {
        fetchData(1);
    }, [globalFilters, fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(currentPage, true); };
    const onApply = () => { setData([]); fetchData(1); };

    const handleExport = async (exportType: string) => {
        setExporting(true);
        const filtered = exportType === 'smps'
            ? data.filter(a => (a.alarm_type || '').toLowerCase() !== 'tpms' && (a.alarm_type || '').toLowerCase() !== 'rms')
            : exportType === 'tpms'
                ? data.filter(a => (a.alarm_type || '').toLowerCase() === 'tpms' || (a.alarm_type || '').toLowerCase() === 'rms')
                : data;

        const title = `"HISTORICAL ALARMS REPORT (${globalFilters.date_from} to ${globalFilters.date_to})"`;
        const header = 'Site ID,Site Name,Alarm Name,Column Name,Status,Duration,Start Time,End Time,Table Name,Start Volt,End Volt';
        
        const rows = filtered.map((a, i) => [
            `"${a.global_id || ''}"`,
            `"${a.site_id || ''}"`,
            `"${a.site_name || ''}"`,
            `"${getAlarmName(a)}"`,
            `"${SEV_LABEL[getSeverity(a)] || ''}"`,
            `"${getStatus(a)}"`,
            `"${a.site_running_status || ''}"`,
            `"${a.active_time_formatted || ''}"`,
            `"${fmtTs(a.start_time_display || a.start_time || a.created_dt)}"`,
            `"${a.end_time_display || a.end_time ? fmtTs(a.end_time_display || a.end_time) : '—'}"`,
            `"${(a.alarm_type?.toLowerCase() === 'tpms' || a.alarm_type?.toLowerCase() === 'rms') ? 'RMS' : (a.alarm_type || '')}${a.vendor ? ` (${a.vendor})` : ''}"`,
            `"${a.start_volt ? parseFloat(a.start_volt).toFixed(2) + 'V' : '—'}"`,
            `"${a.end_volt ? parseFloat(a.end_volt).toFixed(2) + 'V' : 'N/A'}"`,
        ].join(','));

        const csvContent = [title, '', header, ...rows].join('\n');
        
        const path = `${RNFS.TemporaryDirectoryPath}/historical_alarms_${globalFilters.date_from}_to_${globalFilters.date_to}_${Date.now()}.csv`;
        
        try {
            await RNFS.writeFile(path, csvContent, 'utf8');
            await RNShare.open({
                url: `file://${path}`,
                type: 'text/csv',
                filename: 'Historical_Alarms_Report',
                title: 'Share Historical Alarms'
            });
        } catch (e: any) {
            console.log('Export error:', e);
            // Fallback to text share if file share fails
            try { await Share.share({ message: csvContent, title: 'Alarms Export' }); } catch (err) {}
        } finally {
            setExporting(false);
        }
    };

    const filtered = data.filter(row =>
        !search ||
        row.site_name?.toLowerCase().includes(search.toLowerCase()) ||
        row.global_id?.toLowerCase().includes(search.toLowerCase()) ||
        row.site_id?.toLowerCase().includes(search.toLowerCase()) ||
        getAlarmName(row).toLowerCase().includes(search.toLowerCase())
    );

    const dateLabel = globalFilters.date_from === globalFilters.date_to
        ? globalFilters.date_from
        : `${globalFilters.date_from} - ${globalFilters.date_to}`;

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="HISTORICAL ALARMS"
                subtitle={hasLoaded ? `${totalCount} alarms  ·  ${dateLabel}` : 'Apply filters to load'}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    
                ]}
            />

            {loading ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#5B9BD5" />
                    <Text style={styles.loaderTxt}>Loading alarms...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, i) => `${item.site_id || i}_${item.start_time || i}_${i}`}
                    contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5B9BD5']} />}
                    ListHeaderComponent={
                        <View>
                            {error ? (
                                <View style={styles.errorBox}>
                                    <AppIcon name="alert-circle" size={14} color="#ef4444" />
                                    <Text style={styles.errorTxt}>{error}</Text>
                                </View>
                            ) : null}
                            <View style={styles.searchRow}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search Global ID, Name, ID, or Alarm..."
                                    placeholderTextColor="#94a3b8"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {!!search && <TouchableOpacity onPress={() => setSearch('')}><AppIcon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsCount}>{filtered.length} of {totalCount} alarms</Text>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => <AlarmCard item={item} />}
                    ListFooterComponent={
                        totalPages > 1 ? (
                            <View style={styles.pagination}>
                                <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage > 1) fetchData(1); }} disabled={currentPage === 1}>
                                    <Text style={styles.pageBtnTxt}>First</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage > 1) fetchData(currentPage - 1); }} disabled={currentPage === 1}>
                                    <AppIcon name="chevron-left" size={14} color="#5B9BD5" />
                                </TouchableOpacity>
                                <Text style={styles.pageInfo}>Page {currentPage} / {totalPages}</Text>
                                <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage < totalPages) fetchData(currentPage + 1); }} disabled={currentPage === totalPages}>
                                    <AppIcon name="chevron-right" size={14} color="#5B9BD5" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                                    onPress={() => { if (currentPage < totalPages) fetchData(totalPages); }} disabled={currentPage === totalPages}>
                                    <Text style={styles.pageBtnTxt}>Last</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <AppIcon name="inbox" size={36} color="#cbd5e1" />
                            <Text style={styles.emptyTxt}>{search ? 'No alarms match your search' : 'No alarms found'}</Text>
                        </View>
                    }
                />
            )}

            

            

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="HistoricalAlarms"
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
    loaderTxt: { marginTop: verticalScale(12), color: '#5B9BD5', fontWeight: '600', fontSize: responsiveFontSize(13), flexShrink: 1, },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(8), elevation: 1, gap: 8 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(12), flexShrink: 1, color: '#0f172a', fontWeight: '500' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) },
    statsCount: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#5B9BD5', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6) },
    exportTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(11), flexShrink: 1, },
    pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: verticalScale(16) },
    pageBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), elevation: 1 },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#5B9BD5' },
    pageInfo: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#1e293b' },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(60) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '500', textAlign: 'center', paddingHorizontal: moderateScale(30) },
    filterPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5B9BD5', borderRadius: 12, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(12), marginTop: verticalScale(16) },
    filterPromptTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13), flexShrink: 1, },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(10) },
    errorTxt: { flex: 1, fontSize: responsiveFontSize(12), flexShrink: 1, color: '#ef4444', fontWeight: '600' },
});