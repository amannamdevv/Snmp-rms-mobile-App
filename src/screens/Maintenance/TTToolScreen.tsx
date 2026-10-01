/**
 * TTToolScreen.tsx
 *
 * Now accepts route.params.initialTab to jump to correct tab from sidebar:
 *   - 'equipment'  → Equipment History Log
 *   - 'repairs'    → Major Repairs
 *   - 'tickets'    → Raise Ticket & Closure (open + closed)
 *   - 'raise'      → TT Tool (raise form only)
 *
 * APIs:
 *   GET  /api/tt_tools/ → { success, open_count, progress_count, closed_count, tickets[] }
 *   POST /api/tt_tools/ → FormData { siteId, category, description, priority, file? }
 *   GET  /api/tool/     → { equipment:{battery[],dg[],ac[]},
 *                           tickets:{open[],closed[],metrics},
 *                           major_repairs:{data[],metrics} }
 */

import React, { useState, useEffect, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    FlatList, TextInput, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, TouchableWithoutFeedback } from 'react-native';
import { api } from '../../api';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

// ─── Color helpers ────────────────────────────────────────────
function equipStatusColor(cls: string): string {
    if (cls === 'operational') return '#10b981';
    if (cls === 'attention') return '#f59e0b';
    if (cls === 'critical') return '#ef4444';
    return '#94a3b8';
}
function priorityColor(p: string): string {
    const s = (p || '').toLowerCase();
    if (s === 'critical' || s === 'major') return '#ef4444';
    if (s === 'minor') return '#10b981';
    return '#f59e0b';
}
function ticketStatusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'open') return '#ef4444';
    if (s === 'in progress') return '#f59e0b';
    if (s === 'closed') return '#10b981';
    return '#94a3b8';
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: any; color: string }) {
    return (
        <View style={[KS.card, { borderTopColor: color }]}>
            <Text style={[KS.val, { color }]}>{value ?? 0}</Text>
            <Text style={KS.lab}>{label}</Text>
        </View>
    );
}
const KS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), flex: 1, borderTopWidth: 3, elevation: 2, alignItems: 'center', marginHorizontal: moderateScale(3) },
    val: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(4) },
    lab: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '700', textAlign: 'center' },
});

// ─── Equipment Card ───────────────────────────────────────────
function EquipmentCard({ item, onLogPress }: { item: any; onLogPress?: () => void; }) {
    const [open, setOpen] = useState(false);
    const col = equipStatusColor(item.status_class || '');
    return (
        <TouchableOpacity style={EC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={EC.row}>
                <View style={{ flex: 1 }}>
                    <Text style={EC.site} numberOfLines={1}>Global ID: {item.global_id || item.site_id || '—'}</Text>
                    <Text style={EC.type}>{item.equipment_type} (Site: {item.site_id})</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[EC.badge, { backgroundColor: `${col}15`, borderColor: col }]}>
                        <View style={[EC.dot, { backgroundColor: col }]} />
                        <Text style={[EC.badgeTxt, { color: col }]}>{item.status_label || '—'}</Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>
            {open && (
                <View style={EC.detail}>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginBottom: moderateScale(10), gap: 8}}>
                        <TouchableOpacity style={{backgroundColor: '#e2e8f0', paddingHorizontal: moderateScale(12), paddingVertical: 4, borderRadius: 6}} onPress={onLogPress}>
                            <Text style={{fontSize: responsiveFontSize(11), flexShrink: 1, color: '#334155', fontWeight: '700'}}>Log Entry</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={EC.div} />
                    {[
                        { l: 'Installation Date', v: item.installation_date || '—' },
                        { l: 'Last Maintenance', v: item.last_maintenance || '—' },
                        { l: 'Status', v: item.status_label || '—' },
                    ].map(r => (
                        <View key={r.l} style={EC.row2}>
                            <Text style={EC.rl}>{r.l}</Text>
                            <Text style={EC.rv}>{r.v}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}
const EC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), marginBottom: verticalScale(8), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    site: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    type: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 8, borderWidth: 1, gap: 5 },
    dot: { width: moderateScale(7), height: verticalScale(7), borderRadius: 4 },
    badgeTxt: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700' },
    detail: { marginTop: verticalScale(10) },
    div: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    row2: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    rl: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '700' },
    rv: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '700' },
});

// ─── Ticket Card ──────────────────────────────────────────────
function TicketCard({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    const pc = priorityColor(item.priority || '');
    const sc = ticketStatusColor(item.status || '');
    return (
        <TouchableOpacity style={TC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={TC.row}>
                <View style={{ flex: 1 }}>
                    <Text style={TC.code}>#{item.ticket_code || item.id || '—'}</Text>
                    <Text style={TC.sub} numberOfLines={1}>{item.global_id || item.site_id}  ·  {item.issue_category}</Text>
                    <Text style={TC.date}>{item.raised_date} {item.site_id ? ` · Site: ${item.site_id}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {!!item.priority && (
                        <View style={[TC.badge, { backgroundColor: `${pc}15`, borderColor: pc }]}>
                            <Text style={[TC.badgeTxt, { color: pc }]}>{item.priority}</Text>
                        </View>
                    )}
                    <View style={[TC.badge, { backgroundColor: `${sc}12`, borderColor: sc }]}>
                        <Text style={[TC.badgeTxt, { color: sc }]}>{(item.status || '—').toUpperCase()}</Text>
                    </View>
                    <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>
            {open && (
                <View style={TC.detail}>
                    <View style={TC.div} />
                    {[
                        { l: 'Assigned To', v: item.assigned_to },
                        { l: 'Closed Date', v: item.closed_date },
                        { l: 'Resolution', v: item.resolution_time },
                        { l: 'Closed By', v: item.closed_by },
                    ].filter(r => !!r.v).map(r => (
                        <View key={r.l} style={TC.row2}>
                            <Text style={TC.rl}>{r.l}</Text>
                            <Text style={TC.rv}>{r.v}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}
const TC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), marginBottom: verticalScale(8), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    code: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: verticalScale(2) },
    sub: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },
    date: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(2) },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    badgeTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800' },
    detail: { marginTop: verticalScale(10) },
    div: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    row2: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    rl: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '700' },
    rv: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
});

// ─── Tab definitions per entry point ──────────────────────────
// 'raise'     → TT Tool sidebar → only raise form shown
// 'equipment' → Equipment History Log
// 'repairs'   → Major Repairs
// 'tickets'   → Raise Ticket & Closure (open + closed + raise form)

type TabKey = 'raise' | 'equipment' | 'repairs' | 'tickets';

const EQ_TABS = [
    { key: 'battery', label: 'Battery (BB)' },
    { key: 'dg', label: 'DG' },
    { key: 'ac', label: 'AC' },
];
const CATEGORIES = ['Infra', 'Power', 'DG', 'AC', 'Battery', 'Safety', 'Others'];
const PRIORITIES = ['Critical', 'Major', 'Minor'];

// ─── Raise Form Component ─────────────────────────────────────
function RaiseForm({ onSubmit, submitting }: {
    onSubmit: (form: any) => void;
    submitting: boolean;
}) {
    const [form, setForm] = useState({ siteId: '', category: '', description: '', priority: '' });

    const submit = () => {
        if (!form.siteId || !form.category || !form.description || !form.priority) {
            Alert.alert('Missing Fields', 'Please fill all required fields.');
            return;
        }
        onSubmit(form);
        setForm({ siteId: '', category: '', description: '', priority: '' });
    };

    return (
        <View style={RF.card}>
            <Text style={RF.title}>Raise New TT</Text>

            <Text style={RF.label}>Site ID / Name *</Text>
            <TextInput style={RF.input} value={form.siteId}
                onChangeText={v => setForm(f => ({ ...f, siteId: v }))}
                placeholder="Enter Site ID or Name" placeholderTextColor="#94a3b8" />

            <Text style={RF.label}>Issue Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(12) }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity key={c}
                            style={[RF.chip, form.category === c && RF.chipActive]}
                            onPress={() => setForm(f => ({ ...f, category: c }))}>
                            <Text style={[RF.chipTxt, form.category === c && RF.chipTxtActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <Text style={RF.label}>Issue Description *</Text>
            <TextInput style={[RF.input, { height: verticalScale(90), textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder="Describe the issue in detail"
                placeholderTextColor="#94a3b8"
                multiline numberOfLines={4} />

            <Text style={RF.label}>Priority *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: verticalScale(14) }}>
                {PRIORITIES.map(p => {
                    const col = priorityColor(p);
                    const active = form.priority === p;
                    return (
                        <TouchableOpacity key={p}
                            style={[RF.chip, { borderColor: col, flex: 1, justifyContent: 'center' }, active && { backgroundColor: col }]}
                            onPress={() => setForm(f => ({ ...f, priority: p }))}>
                            <Text style={[RF.chipTxt, { color: active ? '#fff' : col }]}>{p}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={RF.label}>Attach Photo / File</Text>
            <TouchableOpacity style={RF.fileBtn} activeOpacity={0.8}
                onPress={() => Alert.alert('Attach File', 'Install react-native-image-picker to enable file attachment.\n\nnpm install react-native-image-picker')}>
                <AppIcon name="paperclip" size={14} color="#01497c" />
                <Text style={RF.fileBtnTxt}>Choose file  (Photo / PDF / Doc)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[RF.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submit} disabled={submitting} activeOpacity={0.8}>
                {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (<><AppIcon name="send" size={14} color="#fff" /><Text style={RF.submitTxt}>Submit Ticket</Text></>)
                }
            </TouchableOpacity>
        </View>
    );
}
const RF = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2 },
    title: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(14) },
    label: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#64748b', marginBottom: verticalScale(5), textTransform: 'uppercase', letterSpacing: 0.5, marginTop: verticalScale(4) },
    input: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '700', borderWidth: 1.5, borderColor: '#d0e4f7', marginBottom: verticalScale(10) },
    chip: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#d0e4f7', alignItems: 'center' },
    chipActive: { backgroundColor: '#01497c', borderColor: '#01497c' },
    chipTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    chipTxtActive: { color: '#fff' },
    fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(12), borderWidth: 1.5, borderColor: '#d0e4f7', borderStyle: 'dashed', marginBottom: verticalScale(14) },
    fileBtnTxt: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#01497c', fontWeight: '700', flex: 1 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: verticalScale(14) },
    submitTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(16), flexShrink: 1, },
});

// ─── My Tickets Table Component ──────────────────────────────
function MyTicketsTable({ filteredMy, onExport, exporting }: { filteredMy: any[], onExport: () => void, exporting: boolean }) {
    return (
        <View style={styles.myTicketsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(12) }}>
                <Text style={styles.secHead}>My Tickets</Text>
            </View>
            <View style={styles.tblHeader}>
                {['TT No', 'Site ID', 'Category', 'Status', 'Raised On'].map((h, i) => (
                    <Text key={h} style={[styles.th, i === 0 ? { width: moderateScale(44) } : { flex: 1 }]}>{h}</Text>
                ))}
            </View>
            {filteredMy.length === 0
                ? <Text style={styles.noData}>No tickets found</Text>
                : filteredMy.map((t: any, i: number) => (
                    <View key={t.id || i} style={[styles.tblRow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[styles.td, { width: moderateScale(44), fontWeight: '800', color: '#01497c' }]}>#{t.id}</Text>
                        <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{t.site_id}</Text>
                        <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{t.issue_category}</Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <View style={[styles.sBadge, { borderColor: ticketStatusColor(t.status), backgroundColor: `${ticketStatusColor(t.status)}12` }]}>
                                <Text style={[styles.sTxt, { color: ticketStatusColor(t.status) }]}>{(t.status || '').toLowerCase()}</Text>
                            </View>
                        </View>
                        <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{t.raised_date}</Text>
                    </View>
                ))
            }
        </View>
    );
}

// ─── Quick Nav Tab Bar Component ───────────────────────────────
function MaintenanceTopTabs({ activeKey, onTabPress }: {
    activeKey: string;
    onTabPress: (screen: string, tab?: string) => void;
}) {
    const tabs = [
        { label: 'Equipment History', screen: 'TTTool', tab: 'equipment' },
        { label: 'Infrastructure', screen: 'SiteMaintenanceTool', tab: 'infra' },
        { label: 'SMPS', screen: 'SiteMaintenanceTool', tab: 'smps' },
        { label: 'DCEM', screen: 'SiteMaintenanceTool', tab: 'dcem' },
        { label: 'Major Repairs', screen: 'TTTool', tab: 'repairs' },
        { label: 'Tickets', screen: 'TTTool', tab: 'tickets' },
    ];
    return (
        <View style={QS.bar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={QS.scroll}>
                {tabs.map(t => {
                    const isActive = activeKey === t.tab;
                    return (
                        <TouchableOpacity key={t.tab}
                            style={[QS.btn, isActive && QS.btnActive]}
                            onPress={() => onTabPress(t.screen, t.tab)}>
                            <Text style={[QS.txt, isActive && QS.txtActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const QS = StyleSheet.create({
    bar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
    scroll: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), gap: 8 },
    btn: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#d0e4f7' },
    btnActive: { backgroundColor: '#01497c', borderColor: '#01497c' },
    txt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    txtActive: { color: '#fff' },
});

export default function TTToolScreen({ navigation, route }: any) {

    // initialTab from sidebar navigation
    const initialTab: TabKey = (route?.params?.initialTab as TabKey) || 'raise';

    const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
    const [eqTab, setEqTab] = useState('battery');
    const [ttData, setTTData] = useState<any>(null);
    const [toolData, setToolData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [addEqVisible, setAddEqVisible] = useState(false);
    const [logEntryVisible, setLogEntryVisible] = useState(false);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    // When sidebar navigates to same screen with different tab
    useEffect(() => {
        const newTab = (route?.params?.initialTab as TabKey) || 'raise';
        setActiveTab(newTab);
        setSearch('');
    }, [route?.params?.initialTab]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
        loadAll();
    }, [activeTab]);

    const loadAll = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const [ttRes, toolRes] = await Promise.allSettled([
                (api as any).getTTTools(),
                (api as any).getToolData({ section: activeTab, page: 1, rep_page: 1 }),
            ]);
            if (ttRes.status === 'fulfilled' && ttRes.value?.success) setTTData(ttRes.value);
            if (toolRes.status === 'fulfilled' && toolRes.value) setToolData(toolRes.value);
        } catch (e) {
            console.log('TTTool loadAll error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => { setRefreshing(true); loadAll(true); };

    // Submit ticket
    const handleSubmit = async (form: any) => {
        setSubmitting(true);
        try {
            const data = new FormData();
            data.append('siteId', form.siteId);
            data.append('category', form.category);
            data.append('description', form.description);
            data.append('priority', form.priority);
            const res = await (api as any).submitTTTool(data);
            if (res?.success) {
                Alert.alert('✅ Success', res.message || 'Ticket submitted successfully!');
                loadAll(true);
            } else {
                Alert.alert('Error', res?.error || 'Submission failed.');
            }
        } catch (e: any) {
            if (e?.response?.status === 403) {
                Alert.alert('Session Expired', 'Please log in again.', [
                    { text: 'OK', onPress: () => navigation.replace('Login') }
                ]);
            } else {
                Alert.alert('Error', e.message || 'Network error.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Data shortcuts
    const counts = { open: ttData?.open_count ?? 0, progress: ttData?.progress_count ?? 0, closed: ttData?.closed_count ?? 0 };
    const myTickets = ttData?.tickets || [];
    const openTickets = toolData?.tickets?.open || [];
    const closedTickets = toolData?.tickets?.closed || [];
    const ticketMeta = toolData?.tickets?.metrics || {};
    const repairs = toolData?.major_repairs?.data || [];
    const repairMeta = toolData?.major_repairs?.metrics || {};
    const eqData: any[] = toolData?.equipment?.[eqTab] || [];

    // Filtered lists (Prioritizing Global ID)
    const filteredEq = eqData.filter(r => !search || 
        r.global_id?.toLowerCase().includes(search.toLowerCase()) || 
        r.site_id?.toLowerCase().includes(search.toLowerCase()));
    
    const filteredOpen = openTickets.filter((t: any) => !search || 
        (t.global_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.imei || '').toLowerCase().includes(search.toLowerCase()) ||
        String(t.ticket_code || '').includes(search));
    
    const filteredClosed = closedTickets.filter((t: any) => !search || 
        (t.global_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.imei || '').toLowerCase().includes(search.toLowerCase()));
    
    const filteredRepairs = repairs.filter((t: any) => !search || 
        (t.global_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.imei || '').toLowerCase().includes(search.toLowerCase()) ||
        String(t.ticket_code || '').includes(search));
    
    const filteredMy = myTickets.filter((t: any) => !search || 
        (t.global_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_id || '').toLowerCase().includes(search.toLowerCase()) || 
        (t.site_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.imei || '').toLowerCase().includes(search.toLowerCase()));

    // Tab header title
    const TAB_TITLES: Record<TabKey, string> = {
        raise: 'TT Tool — Raise Ticket',
        equipment: 'Equipment History Log',
        repairs: 'Major Repair Tracker',
        tickets: 'Raise Ticket & Closure',
    };

    // Share export
    const handleShare = async () => {
        setExporting(true);
        try {
            let csvString = '';
            let fileName = '';

            if (activeTab === 'equipment') {
                const header = 'GLOBAL ID,SITE ID,TYPE,INSTALL DATE,STATUS\n';
                const rows = eqData.map(r => `"${r.global_id || '-'}","${r.site_id}","${r.equipment_type}","${r.installation_date || '-'}","${r.status_label}"`).join('\n');
                csvString = header + rows;
                fileName = `Equipment_${eqTab}_${Date.now()}.csv`;
            } else if (activeTab === 'repairs') {
                const header = 'TICKET,GLOBAL ID,SITE ID,CATEGORY,PRIORITY,STATUS,DATE\n';
                const rows = repairs.map((t: any) => `"${t.ticket_code || t.id}","${t.global_id || '-'}","${t.site_id}","${t.issue_category}","${t.priority}","${t.status}","${t.raised_date}"`).join('\n');
                csvString = header + rows;
                fileName = `Major_Repairs_${Date.now()}.csv`;
            } else if (activeTab === 'tickets' || activeTab === 'raise') {
                const header = 'TT No,Site ID,Category,Status,Raised On\n';
                const rows = myTickets.map((t: any) => `"${t.id}","${t.site_id}","${t.issue_category}","${t.status}","${t.raised_date}"`).join('\n');
                csvString = header + rows;
                fileName = `My_Tickets_${Date.now()}.csv`;
            }

            if (csvString) {
                const path = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
                await RNFS.writeFile(path, csvString, 'utf8');
                await RNShare.open({
                    url: `file://${path}`,
                    type: 'text/csv',
                    filename: fileName,
                    title: 'TT Tool Export'
                });
            }
        } catch (e: any) {
            console.log('Export error:', e);
        } finally {
            setExporting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>

            {/* Header */}
            <AppHeader
                title={TAB_TITLES[activeTab]}
                subtitle="Site Maintenance Tool"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleShare }
                ]}
            />

            {/* Quick Navigation Tab Bar — Only show if not on Raise TT page */}
            {activeTab !== 'raise' && (
                <MaintenanceTopTabs
                    activeKey={activeTab}
                    onTabPress={(screen, tab) => {
                        if (screen === 'TTTool') {
                            setActiveTab(tab as TabKey);
                            setSearch('');
                        } else {
                            navigation.navigate(screen, { initialTab: tab });
                        }
                    }}
                />
            )}

            {loading && !ttData && !toolData ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#01497c" />
                    <Text style={styles.loaderTxt}>Loading...</Text>
                </View>
            ) : (
                <>
                    {/* ══════════════════════════════════════════════
                        TAB: raise — TT Tool (raise form only)
                    ══════════════════════════════════════════════ */}
                    {activeTab === 'raise' && (
                        <ScrollView
                            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                        >
                            {/* KPI counts */}
                            <View style={{ flexDirection: 'row', marginBottom: verticalScale(14) }}>
                                <KpiCard label="Open Tickets" value={counts.open} color="#ef4444" />
                                <KpiCard label="In Progress" value={counts.progress} color="#f59e0b" />
                                <KpiCard label="Closed" value={counts.closed} color="#10b981" />
                            </View>

                            <RaiseForm onSubmit={handleSubmit} submitting={submitting} />

                            {/* My Tickets table — Added here */}
                            <MyTicketsTable filteredMy={filteredMy} onExport={handleShare} exporting={exporting} />
                        </ScrollView>
                    )}

                    {/* ══════════════════════════════════════════════
                        TAB: tickets — Raise Ticket & Closure
                        Shows: KPIs + Open tickets + Closed tickets
                    ══════════════════════════════════════════════ */}
                    {activeTab === 'tickets' && (
                        <>
                            <View style={styles.searchWrap}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
                                <TextInput style={styles.searchInput}
                                    placeholder="Search by Site ID or Name..."
                                    placeholderTextColor="#94a3b8"
                                    value={search} onChangeText={setSearch} />
                                {!!search && <TouchableOpacity onPress={() => setSearch('')}><AppIcon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                            </View>
                            <ScrollView
                                style={{ flex: 1 }}
                                contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                            >
                                {/* KPIs */}
                                <View style={{ flexDirection: 'row', marginBottom: verticalScale(14) }}>
                                    <KpiCard label="Open" value={ticketMeta.total_open} color="#ef4444" />
                                    <KpiCard label="In Progress" value={ticketMeta.total_in_progress} color="#f59e0b" />
                                    <KpiCard label="Resolved" value={ticketMeta.resolved_this_month} color="#10b981" />
                                    <KpiCard label="Total" value={ticketMeta.total} color="#3b82f6" />
                                </View>

                                {/* Open Tickets from tool API */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: verticalScale(8) }}>
            <Text style={styles.secHead}>Open Tickets ({filteredOpen.length})</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#01497c', paddingHorizontal: moderateScale(12), paddingVertical: 6, borderRadius: 20}} onPress={() => setActiveTab('raise')}>
                <AppIcon name="plus" size={14} color="#fff" />
                <Text style={{color: '#fff', fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700'}}>Raise Ticket</Text>
            </TouchableOpacity>
        </View>
                                {filteredOpen.length === 0
                                    ? <EmptyState msg="No open tickets" />
                                    : filteredOpen.map((t: any, i: number) => <TicketCard key={t.ticket_code || i} item={t} />)
                                }

                                {/* Closed Tickets */}
                                <Text style={[styles.secHead, { marginTop: verticalScale(14) }]}>Recently Closed ({filteredClosed.length})</Text>
                                {filteredClosed.length === 0
                                    ? <EmptyState msg="No closed tickets" />
                                    : filteredClosed.map((t: any, i: number) => <TicketCard key={`c_${t.ticket_code || i}`} item={t} />)
                                }
                            </ScrollView>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        TAB: equipment — Equipment History Log
                    ══════════════════════════════════════════════ */}
                    {activeTab === 'equipment' && (
                        <>
                            <View style={styles.eqTabBar}>
                                {EQ_TABS.map(t => (
                                    <TouchableOpacity key={t.key}
                                        style={[styles.eqTabBtn, eqTab === t.key && styles.eqTabBtnActive]}
                                        onPress={() => setEqTab(t.key)}>
                                        <Text style={[styles.eqTabTxt, eqTab === t.key && styles.eqTabTxtActive]}>{t.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.searchWrap}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
                                <TextInput style={styles.searchInput}
                                    placeholder="Search by Site ID or Name..."
                                    placeholderTextColor="#94a3b8"
                                    value={search} onChangeText={setSearch} />
                                {!!search && <TouchableOpacity onPress={() => setSearch('')}><AppIcon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                            </View>
                            <FlatList
                                data={filteredEq}
                                keyExtractor={(item, i) => `${item.site_id}_${i}`}
                                contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                                ListHeaderComponent={<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(10) }}>
            <Text style={styles.secCount}>{filteredEq.length} RECORDS — {eqTab.toUpperCase()}</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#01497c', paddingHorizontal: moderateScale(10), paddingVertical: 5, borderRadius: 20}} onPress={() => setAddEqVisible(true)}>
                <AppIcon name="plus" size={12} color="#fff" />
                <Text style={{color: '#fff', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700'}}>Add Entry</Text>
            </TouchableOpacity>
        </View>}
                                renderItem={({ item }) => <EquipmentCard item={item} onLogPress={() => { setSelectedSiteId(item.site_id); setLogEntryVisible(true); }} />}
                                ListEmptyComponent={<EmptyState msg="No equipment data" />}
                            />
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        TAB: repairs — Major Repair Tracker
                    ══════════════════════════════════════════════ */}
                    {activeTab === 'repairs' && (
                        <>
                            <View style={styles.searchWrap}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
                                <TextInput style={styles.searchInput}
                                     placeholder="Search by Site ID or Name..."
                                     placeholderTextColor="#94a3b8"
                                     value={search} onChangeText={setSearch} />
                                {!!search && <TouchableOpacity onPress={() => setSearch('')}><AppIcon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                            </View>
                            <FlatList
                                data={filteredRepairs}
                                keyExtractor={(item, i) => `r_${item.ticket_code || i}`}
                                contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                                ListHeaderComponent={
                                    <View>
                                        <View style={{ flexDirection: 'row', marginBottom: verticalScale(14) }}>
                                            <KpiCard label="Total Open" value={repairMeta.total_open} color="#ef4444" />
                                            <KpiCard label="In Progress" value={repairMeta.total_in_progress} color="#f59e0b" />
                                            <KpiCard label="Resolved" value={repairMeta.resolved_this_month} color="#10b981" />
                                            <KpiCard label="Total Tickets" value={repairMeta.total} color="#3b82f6" />
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(10) }}>
            <Text style={styles.secCount}>{filteredRepairs.length} MAJOR REPAIR TICKETS</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#01497c', paddingHorizontal: moderateScale(10), paddingVertical: 5, borderRadius: 20}} onPress={() => setActiveTab('raise')}>
                <AppIcon name="plus" size={12} color="#fff" />
                <Text style={{color: '#fff', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700'}}>Raise Ticket</Text>
            </TouchableOpacity>
        </View>
                                    </View>
                                }
                                renderItem={({ item }) => <TicketCard item={item} />}
                                ListEmptyComponent={<EmptyState msg="No major repair tickets found" />}
                            />
                        </>
                    )}
                </>
            )}


            {/* --- Modals --- */}
            <AddEquipmentModal visible={addEqVisible} onClose={() => setAddEqVisible(false)} />


            <LogEntryModal visible={logEntryVisible} siteId={selectedSiteId} onClose={() => setLogEntryVisible(false)} />


            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="TTTool"
                handleLogout={async () => {
                    await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                    navigation.replace('Login');
                }}
            />
            </View>
        </SafeAreaView>
    );
}



function AddEquipmentModal({ visible, onClose }: { visible: boolean; onClose: () => void; }) {
    const [siteId, setSiteId] = useState('');
    const [serial, setSerial] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [date, setDate] = useState(new Date());
    
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    if (!visible) return null;

    return (
        <Modal visible={true} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => { setShowTypePicker(false); setShowStatusPicker(false); }}>
            <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(20)}}>
                <TouchableWithoutFeedback>
                <View style={{backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(20)}}>
                    <Text style={{fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: verticalScale(15)}}>Add Equipment History Entry</Text>
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Site ID/Name</Text>
                    <TextInput 
                        style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(15), color: '#0f172a', fontSize: responsiveFontSize(13), flexShrink: 1, }} 
                        placeholder="Enter Site ID" placeholderTextColor="#94a3b8"
                        value={siteId} onChangeText={setSiteId} onFocus={() => { setShowTypePicker(false); setShowStatusPicker(false); }}
                    />
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Equipment Type</Text>
                    <TouchableOpacity onPress={() => { setShowTypePicker(true); setShowStatusPicker(false); setShowDatePicker(false); }} style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), marginBottom: verticalScale(15)}}>
                        <Text style={{flex: 1, color: type ? '#0f172a' : '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, }}>{type || 'Select Type'}</Text>
                        <AppIcon name="chevron-down" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {showTypePicker && (
                        <View style={{position: 'absolute', top: '35%', left: 20, right: 20, backgroundColor: '#fff', elevation: 10, borderRadius: 8, zIndex: 999}}>
                            {['Battery', 'Diesel Generator', 'Alternating Current'].map(t => (
                                <TouchableOpacity key={t} style={{padding: moderateScale(15), borderBottomWidth: 1, borderBottomColor: '#f1f5f9'}} onPress={() => { setType(t); setShowTypePicker(false); }}>
                                    <Text style={{fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a'}}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Installation Date</Text>
                    <TouchableOpacity onPress={() => { setShowDatePicker(true); setShowTypePicker(false); setShowStatusPicker(false); }} style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), marginBottom: verticalScale(15)}}>
                        <Text style={{flex: 1, color: '#0f172a', fontSize: responsiveFontSize(13), flexShrink: 1, }}>{date.toLocaleDateString()}</Text>
                        <AppIcon name="calendar" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker 
                            value={date} 
                            mode="date" 
                            display="default" 
                            onChange={(e, d) => { setShowDatePicker(false); if(d) setDate(d); }} 
                        />
                    )}

                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Serial Number</Text>
                    <TextInput 
                        style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(15), color: '#0f172a', fontSize: responsiveFontSize(13), flexShrink: 1, }} 
                        placeholder="Enter Serial Number" placeholderTextColor="#94a3b8"
                        value={serial} onChangeText={setSerial} onFocus={() => { setShowTypePicker(false); setShowStatusPicker(false); }}
                    />

                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Status</Text>
                    <TouchableOpacity onPress={() => { setShowStatusPicker(true); setShowTypePicker(false); setShowDatePicker(false); }} style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), marginBottom: verticalScale(15)}}>
                        <Text style={{flex: 1, color: status ? '#0f172a' : '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, }}>{status || 'Select Status'}</Text>
                        <AppIcon name="chevron-down" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {showStatusPicker && (
                        <View style={{position: 'absolute', bottom: '15%', left: 20, right: 20, backgroundColor: '#fff', elevation: 10, borderRadius: 8, zIndex: 999}}>
                            {['Operational', 'Needs Attention', 'Critical'].map(s => (
                                <TouchableOpacity key={s} style={{padding: moderateScale(15), borderBottomWidth: 1, borderBottomColor: '#f1f5f9'}} onPress={() => { setStatus(s); setShowStatusPicker(false); }}>
                                    <Text style={{fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a'}}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: moderateScale(10), marginTop: moderateScale(10)}}>
                        <TouchableOpacity onPress={onClose} style={{padding: moderateScale(10)}}><Text style={{color: '#64748b', fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { onClose(); Alert.alert('Success', 'Equipment entry added.'); }} style={{backgroundColor: '#01497c', padding: moderateScale(10), borderRadius: 8}}><Text style={{color: '#fff', fontWeight: '700'}}>Add Entry</Text></TouchableOpacity>
                    </View>
                </View>
                </TouchableWithoutFeedback>
            </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}


function LogEntryModal({ visible, siteId, onClose }: { visible: boolean; siteId: string; onClose: () => void; }) {
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [work, setWork] = useState('');

    if (!visible) return null;

    return (
        <Modal visible={true} transparent animationType="fade">
            <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(20)}}>
                <View style={{backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(20)}}>
                    <Text style={{fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: verticalScale(15)}}>Log Maintenance Entry</Text>
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Site ID</Text>
                    <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(15), color: '#0f172a', backgroundColor: '#f1f5f9', fontSize: responsiveFontSize(13), flexShrink: 1, }} value={siteId} editable={false} />
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Maintenance Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), marginBottom: verticalScale(15)}}>
                        <Text style={{flex: 1, color: '#0f172a', fontSize: responsiveFontSize(13), flexShrink: 1, }}>{date.toLocaleDateString()}</Text>
                        <AppIcon name="calendar" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker 
                            value={date} 
                            mode="date" 
                            display="default" 
                            onChange={(e, d) => { setShowDatePicker(false); if(d) setDate(d); }} 
                        />
                    )}

                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(5)}}>Work Performed</Text>
                    <TextInput 
                        style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(15), color: '#0f172a', height: 80, textAlignVertical: 'top', fontSize: responsiveFontSize(13), flexShrink: 1, }} 
                        multiline 
                        placeholder="Describe work performed..." placeholderTextColor="#94a3b8"
                        value={work} onChangeText={setWork}
                    />

                    <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: moderateScale(10), marginTop: moderateScale(10)}}>
                        <TouchableOpacity onPress={onClose} style={{padding: moderateScale(10)}}><Text style={{color: '#64748b', fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { onClose(); Alert.alert('Success', 'Maintenance log saved.'); }} style={{backgroundColor: '#01497c', padding: moderateScale(10), borderRadius: 8}}><Text style={{color: '#fff', fontWeight: '700'}}>Save Log</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
        
function EmptyState({ msg }: { msg: string }) {
    return (
        <View style={{ alignItems: 'center', paddingTop: verticalScale(30) }}>
            <AppIcon name="inbox" size={32} color="#cbd5e1" />
            <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(14), flexShrink: 1, marginTop: verticalScale(10), fontWeight: '700' }}>{msg}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: '#01497c', fontWeight: '700', fontSize: responsiveFontSize(15), flexShrink: 1, },
    eqTabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    eqTabBtn: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#d0e4f7' },
    eqTabBtnActive: { backgroundColor: '#01497c', borderColor: '#01497c' },
    eqTabTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    eqTabTxtActive: { color: '#fff' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: moderateScale(12), marginVertical: verticalScale(8), borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), elevation: 1, gap: 8 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '700' },
    secHead: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(10) },
    secCount: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800', color: '#64748b', marginBottom: verticalScale(8), textTransform: 'uppercase', letterSpacing: 0.5 },
    myTicketsCard: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(14), marginBottom: verticalScale(14), elevation: 2 },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#5B9BD5', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(5) },
    exportTxt: { color: '#fff', fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800' },
    tblHeader: { flexDirection: 'row', backgroundColor: '#01497c', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), marginBottom: verticalScale(4) },
    th: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    tblRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderRadius: 4 },
    td: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#334155', fontWeight: '700' },
    sBadge: { paddingHorizontal: moderateScale(6), paddingVertical: verticalScale(2), borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
    sTxt: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800' },
    noData: { color: '#94a3b8', textAlign: 'center', padding: moderateScale(16), fontSize: responsiveFontSize(14), flexShrink: 1, },
});
