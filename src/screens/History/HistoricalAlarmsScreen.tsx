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
    const type = (alarm.alarm_type || '').toLowerCase();
    const ts = alarm.start_time || alarm.created_dt;

    if (type === 'tpms' || type === 'rms') {
        const name = alarm.alarm_name || alarm.alarm_details || '';
        const nl = name.toLowerCase();
        if (nl.includes('fire') || nl.includes('smoke') || nl.includes('fsmk')) return 'Fire';
        if (['door-open', 'door open', 'dopn'].some(p => nl.includes(p)) && isNight(ts)) return 'NightDoor';
        return (rmsMap[name] as any) || 'Minor';
    }
    // SMPS
    const all = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
    if (!all.length) {
        const f = alarm.alarm_details || alarm.alarm_name || '';
        if (f === 'FIRE_and_SMOKE') return 'Fire';
        return (smpsMap[f] as any) || 'Minor';
    }
    for (const a of all) if (a.field === 'FIRE_and_SMOKE') return 'Fire';
    for (const a of all) if (a.field === 'DOOR_ALARM' && isNight(ts)) return 'NightDoor';
    for (const a of all) if (smpsMap[a.field] === 'Major') return 'Major';
    return 'Minor';
}

function getAlarmName(alarm: any): string {
    if (alarm.alarm_details) return alarm.alarm_details;
    const closed = alarm.closed_alarms || [];
    if (closed.length) return closed.map((a: any) => a.name || a.field).join(', ');
    const active = alarm.active_alarms || [];
    if (active.length) return active.map((a: any) => a.name || a.field).join(', ');
    return alarm.alarm_name || '—';
}

function getStatus(alarm: any): 'ACTIVE' | 'CLOSED' {
    if (alarm.end_time || alarm.end_time_display) return 'CLOSED';
    if (alarm.closed_alarms?.length) return 'CLOSED';
    return alarm.alarm_status === 'Open' ? 'ACTIVE' : 'CLOSED';
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
    const sev = getSeverity(item);
    const status = getStatus(item);
    const name = getAlarmName(item);
    const sevCol = SEV_COLOR[sev];
    const sevBg = SEV_BG[sev];
    const stInfo = STATUS_INFO[status];
    const ss = item.site_running_status || '';
    const ssCol = SITE_STATUS_COLOR[ss] || '#64748b';

    return (
        <TouchableOpacity style={AC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            {/* Top row */}
            <View style={AC.top}>
                <View style={{ flex: 1 }}>
                    <Text style={AC.site} numberOfLines={1}>{item.site_name || '—'}</Text>
                    <Text style={AC.siteId}>Global ID: {item.global_id || item.site_id || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[AC.badge, { backgroundColor: sevBg, borderColor: sevCol }]}>
                        <Text style={[AC.badgeTxt, { color: sevCol }]}>{SEV_LABEL[sev]}</Text>
                    </View>
                    <View style={[AC.badge, { backgroundColor: stInfo.bg, borderColor: stInfo.color }]}>
                        <Text style={[AC.badgeTxt, { color: stInfo.color }]}>{status}</Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>

            {/* Alarm name */}
            <Text style={AC.alarmName} numberOfLines={open ? undefined : 1}>{name}</Text>

            {/* Quick info row */}
            <View style={AC.quickRow}>
                {[
                    { l: 'Duration', v: item.active_time_formatted || '—' },
                    { l: 'Type', v: (item.alarm_type?.toLowerCase() === 'tpms' || item.alarm_type?.toLowerCase() === 'rms') ? 'RMS' : (item.alarm_type || '—') },
                    { l: 'Site Status', v: ss || '—', color: ssCol },
                    { l: 'Start Volt', v: item.start_volt ? `${parseFloat(item.start_volt).toFixed(2)}V` : '—' },
                ].map(x => (
                    <View key={x.l} style={AC.quickItem}>
                        <Text style={[AC.quickVal, x.color ? { color: x.color, fontWeight: '800' } : {}]}>{x.v}</Text>
                        <Text style={AC.quickLab}>{x.l}</Text>
                    </View>
                ))}
            </View>

            {/* Expanded detail */}
            {open && (
                <View style={AC.detail}>
                    <View style={AC.divider} />
                    {[
                        { l: 'Start Time', v: fmtTs(item.start_time_display || item.start_time || item.created_dt) },
                        { l: 'End Time', v: fmtTs(item.end_time_display || item.end_time) },
                        { l: 'Duration', v: item.active_time_formatted || '—' },
                        { l: 'Start Volt', v: item.start_volt ? `${parseFloat(item.start_volt).toFixed(2)}V` : '—' },
                        { l: 'End Volt', v: item.end_volt ? `${parseFloat(item.end_volt).toFixed(2)}V` : '—' },
                        { l: 'Alarm Type', v: (item.alarm_type?.toLowerCase() === 'tpms' || item.alarm_type?.toLowerCase() === 'rms') ? 'RMS' : (item.alarm_type || '—') },
                        { l: 'Site Status', v: item.site_running_status || '—' },
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
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), marginBottom: verticalScale(8), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
    top: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(8), gap: 8 },
    site: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    siteId: { fontSize: responsiveFontSize(9), color: '#64748b' },
    badge: { paddingHorizontal: moderateScale(7), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    badgeTxt: { fontSize: responsiveFontSize(8), fontWeight: '800', letterSpacing: 0.3 },
    alarmName: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#1e40af', marginBottom: verticalScale(8) },
    quickRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 10, padding: moderateScale(8) },
    quickItem: { flex: 1, alignItems: 'center' },
    quickVal: { fontSize: responsiveFontSize(10), fontWeight: '700', color: '#0f172a' },
    quickLab: { fontSize: responsiveFontSize(7), color: '#64748b', fontWeight: '600', marginTop: verticalScale(1) },
    detail: { marginTop: verticalScale(10) },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    detailLab: { fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '600' },
    detailVal: { fontSize: responsiveFontSize(11), color: '#1e293b', fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
});

// ─── Filter Drawer ────────────────────────────────────────────
function FilterDrawer({ visible, onClose, filters, setFilters, onApply }: any) {
    const [showFrom, setShowFrom] = useState(false);
    const [showTo, setShowTo] = useState(false);
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
                            { key: 'date_from', label: 'DATE FROM', placeholder: 'YYYY-MM-DD', isDate: true },
                            { key: 'date_to', label: 'DATE TO', placeholder: 'YYYY-MM-DD', isDate: true },
                            { key: 'site_id', label: 'SITE ID', placeholder: 'e.g. 706307' },
                            { key: 'site_name', label: 'SITE NAME', placeholder: 'Search...' },
                            { key: 'global_id', label: 'GLOBAL ID', placeholder: 'Global ID' },
                            { key: 'imei', label: 'IMEI', placeholder: 'Enter IMEI' },
                        ].map(f => (
                            <View key={f.key}>
                                <Text style={FD.label}>{f.label}</Text>
                                {f.isDate ? (
                                    <TouchableOpacity style={FD.input} onPress={() => f.key === 'date_from' ? setShowFrom(true) : setShowTo(true)}>
                                        <Text style={{ color: filters[f.key] ? '#1e293b' : '#94a3b8' }}>{filters[f.key] || f.placeholder}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TextInput style={FD.input} value={filters[f.key] || ''}
                                        onChangeText={v => setFilters((p: any) => ({ ...p, [f.key]: v }))}
                                        placeholder={f.placeholder} placeholderTextColor="#94a3b8" />
                                )}
                            </View>
                        ))}

                        {showFrom && (
                            <DateTimePicker
                                value={filters.date_from ? new Date(filters.date_from) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowFrom(false);
                                    if (d) setFilters((p: any) => ({ ...p, date_from: d.toISOString().split('T')[0] }));
                                }}
                            />
                        )}

                        {showTo && (
                            <DateTimePicker
                                value={filters.date_to ? new Date(filters.date_to) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowTo(false);
                                    if (d) setFilters((p: any) => ({ ...p, date_to: d.toISOString().split('T')[0] }));
                                }}
                            />
                        )}

                        {/* Quick dates */}
                        <Text style={FD.label}>QUICK DATE</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: verticalScale(14) }}>
                            {[
                                { l: 'Today', s: todayStr(), e: todayStr() },
                                { l: 'Yesterday', s: daysAgoStr(1), e: daysAgoStr(1) },
                                { l: '7 Days', s: daysAgoStr(7), e: todayStr() },
                                { l: '30 Days', s: daysAgoStr(30), e: todayStr() },
                            ].map(p => (
                                <TouchableOpacity key={p.l}
                                    style={[FD.chip, filters.date_from === p.s && FD.chipActive]}
                                    onPress={() => setFilters((prev: any) => ({ ...prev, date_from: p.s, date_to: p.e }))}
                                >
                                    <Text style={[FD.chipTxt, filters.date_from === p.s && FD.chipTxtActive]}>{p.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Alarm type */}
                        <Text style={FD.label}>ALARM TYPE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: verticalScale(16) }}>
                            {[
                                { v: 'both', l: 'Both' },
                                { v: 'smps', l: 'SMPS' },
                                { v: 'tpms', l: 'RMS' },
                            ].map(t => (
                                <TouchableOpacity key={t.v}
                                    style={[FD.chip, filters.alarm_type === t.v && FD.chipActive]}
                                    onPress={() => setFilters((p: any) => ({ ...p, alarm_type: t.v }))}
                                >
                                    <Text style={[FD.chipTxt, filters.alarm_type === t.v && FD.chipTxtActive]}>{t.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={FD.applyBtn} onPress={() => { onApply(); onClose(); }}>
                            <AppIcon name="filter" size={14} color="#fff" />
                            <Text style={FD.applyTxt}>Apply Filters</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={FD.resetBtn}
                            onPress={() => setFilters({ date_from: daysAgoStr(7), date_to: todayStr(), alarm_type: 'both' })}>
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

// ─── Export type modal ────────────────────────────────────────
function ExportModal({ visible, onClose, onExport }: { visible: boolean; onClose: () => void; onExport: (t: string) => void }) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity style={EM.overlay} onPress={onClose} activeOpacity={1}>
                <View style={EM.box}>
                    <Text style={EM.title}>Export Alarms</Text>
                    {[
                        { v: 'all', l: 'Export All Alarms (SMPS + RMS)', icon: 'download' },
                        { v: 'smps', l: 'Export SMPS Alarms Only', icon: 'cpu' },
                        { v: 'tpms', l: 'Export RMS Alarms Only', icon: 'radio' },
                    ].map(o => (
                        <TouchableOpacity key={o.v} style={EM.option} onPress={() => { onExport(o.v); onClose(); }}>
                            <AppIcon name={o.icon} size={16} color="#5B9BD5" />
                            <Text style={EM.optTxt}>{o.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
const EM = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: moderateScale(30) },
    box: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(20) },
    title: { fontSize: responsiveFontSize(15), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(14) },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    optTxt: { fontSize: responsiveFontSize(13), color: '#334155', fontWeight: '600' },
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

    const [filters, setFilters] = useState({
        date_from: daysAgoStr(7),
        date_to: todayStr(),
        alarm_type: 'both',
    });

    React.useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (page = 1, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const params = { ...filters, page, page_size: 50 };
            const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
            const res = await (api as any).getHistoricalAlarms(clean);

            if (res?.status === 'success') {
                setData(res.data || []);
                setCurrentPage(res.pagination?.current_page || 1);
                setTotalPages(res.pagination?.total_pages || 1);
                setTotalCount(res.total_alarms_count || res.pagination?.total_count || 0);
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

    const handleExport = async (exportType: string) => {
        setExporting(true);
        const filtered = exportType === 'smps'
            ? data.filter(a => (a.alarm_type || '').toLowerCase() !== 'tpms' && (a.alarm_type || '').toLowerCase() !== 'rms')
            : exportType === 'tpms'
                ? data.filter(a => (a.alarm_type || '').toLowerCase() === 'tpms' || (a.alarm_type || '').toLowerCase() === 'rms')
                : data;

        const title = `"HISTORICAL ALARMS REPORT (${filters.date_from} to ${filters.date_to})"`;
        const header = 'Global ID,Site ID,Site Name,Alarm Details,Severity,Status,Site Status,Duration,Start Time,End Time,Type,Start Volt,End Volt';
        
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
        
        const path = `${RNFS.TemporaryDirectoryPath}/historical_alarms_${filters.date_from}_to_${filters.date_to}_${Date.now()}.csv`;
        
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

    const dateLabel = filters.date_from === filters.date_to
        ? filters.date_from
        : `${filters.date_from} - ${filters.date_to}`;

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="HISTORICAL ALARMS"
                subtitle={hasLoaded ? `${totalCount} alarms  ·  ${dateLabel}` : 'Apply filters to load'}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: () => setExportVisible(true) },
                    { icon: 'filter', onPress: () => setFilterVisible(true) },
                ]}
            />

            {!hasLoaded ? (
                <View style={styles.emptyBox}>
                    <AppIcon name="bell" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTxt}>Apply filters to load historical alarms</Text>
                    <TouchableOpacity style={styles.filterPromptBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.8}>
                        <AppIcon name="sliders" size={14} color="#fff" />
                        <Text style={styles.filterPromptTxt}>Open Filters</Text>
                    </TouchableOpacity>
                </View>
            ) : loading ? (
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

            <FilterDrawer visible={filterVisible} onClose={() => setFilterVisible(false)}
                filters={filters} setFilters={setFilters} onApply={onApply} />

            <ExportModal visible={exportVisible} onClose={() => setExportVisible(false)} onExport={handleExport} />

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
    pageInfo: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#1e293b' },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(60) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(13), marginTop: verticalScale(12), fontWeight: '500', textAlign: 'center', paddingHorizontal: moderateScale(30) },
    filterPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5B9BD5', borderRadius: 12, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(12), marginTop: verticalScale(16) },
    filterPromptTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13) },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(10) },
    errorTxt: { flex: 1, fontSize: responsiveFontSize(12), color: '#ef4444', fontWeight: '600' },
});