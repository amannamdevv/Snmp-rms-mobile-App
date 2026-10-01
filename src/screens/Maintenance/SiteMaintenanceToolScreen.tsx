import { useGlobalFilter } from '../../context/FilterContext';
/**
 * SiteMaintenanceToolScreen.tsx
 *
 * Handles: Infrastructure Upgrade, SMPS, DCEM Calibration tabs
 * API: GET /api/tool/
 * Same API as TTTool — uses equipment + infra data
 *
 * route.params.initialTab: 'infra' | 'smps' | 'dcem'
 */

import React, { useState, useEffect, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { api } from '../../api';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Alert } from 'react-native';

type TabKey = 'infra' | 'smps' | 'dcem';

const TAB_INFO: Record<TabKey, { label: string; icon: string; color: string }> = {
    infra: { label: 'Infrastructure Upgrade', icon: 'layers', color: '#2a6f97' },
    smps: { label: 'SMPS', icon: 'zap', color: '#01497c' },
    dcem: { label: 'DCEM Calibration', icon: 'sliders', color: '#468faf' },
};

// ─── Status helpers ───────────────────────────────────────────
function equipColor(cls: string): string {
    if (cls === 'operational') return '#10b981';
    if (cls === 'attention') return '#f59e0b';
    if (cls === 'critical') return '#ef4444';
    return '#94a3b8';
}

function daysRemainingColor(days: number): string {
    if (days < 0) return '#ef4444';
    if (days < 30) return '#f59e0b';
    return '#10b981';
}

// ─── Equipment / SMPS Card ────────────────────────────────────
function EquipCard({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    const col = equipColor(item.status_class || '');

    return (
        <TouchableOpacity style={EC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={EC.row}>
                <View style={{ flex: 1 }}>
                    <Text style={EC.site} numberOfLines={1}>Global ID: {item.global_id || item.site_id || '—'}</Text>
                    <Text style={EC.type}>{item.equipment_type} (SID: {item.site_id})</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[EC.badge, { backgroundColor: `${col}15`, borderColor: col }]}>
                        <View style={[EC.dot, { backgroundColor: col }]} />
                        <Text style={[EC.badgeTxt, { color: col }]}>{item.status_label || '—'}</Text>
                    </View>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>
            {open && (
                <View style={EC.detail}>
                    <View style={EC.div} />
                    {[
                        { l: 'Installation Date', v: item.installation_date || '—' },
                        { l: 'Last Maintenance', v: item.last_maintenance || '—' },
                        { l: 'Equipment Type', v: item.equipment_type || '—' },
                        { l: 'Status', v: item.status_label || '—' },
                    ].map(r => (
                        <View key={r.l} style={EC.dRow}>
                            <Text style={EC.dl}>{r.l}</Text>
                            <Text style={EC.dv}>{r.v}</Text>
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
    dRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    dl: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '700' },
    dv: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '700' },
});

// ─── DCEM / Calibration Card ──────────────────────────────────
function DCEMCard({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    // Simulate days remaining from installation date
    const installDate = item.installation_date ? new Date(item.installation_date) : null;
    const nextDue = installDate ? new Date(installDate.getTime() + 365 * 24 * 60 * 60 * 1000) : null;
    const daysLeft = nextDue ? Math.floor((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const dCol = daysLeft !== null ? daysRemainingColor(daysLeft) : '#94a3b8';
    const col = equipColor(item.status_class || '');

    return (
        <TouchableOpacity style={EC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            <View style={EC.row}>
                <View style={{ flex: 1 }}>
                    <Text style={EC.site} numberOfLines={1}>Global ID: {item.global_id || item.site_id || '—'}</Text>
                    <Text style={EC.type}>{item.equipment_type} (SID: {item.site_id})</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {daysLeft !== null && (
                        <View style={[EC.badge, { backgroundColor: `${dCol}15`, borderColor: dCol }]}>
                            <Text style={[EC.badgeTxt, { color: dCol }]}>
                                {daysLeft < 0 ? 'Overdue' : `${daysLeft}d remaining`}
                            </Text>
                        </View>
                    )}
                    <View style={[EC.badge, { backgroundColor: `${col}15`, borderColor: col }]}>
                        <View style={[EC.dot, { backgroundColor: col }]} />
                        <Text style={[EC.badgeTxt, { color: col }]}>{item.status_label || '—'}</Text>
                    </View>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>
            {open && (
                <View style={EC.detail}>
                    <View style={EC.div} />
                    {[
                        { l: 'Installation Date', v: item.installation_date || '—' },
                        { l: 'Next Due', v: nextDue ? nextDue.toISOString().split('T')[0] : '—' },
                        { l: 'Days Remaining', v: daysLeft !== null ? (daysLeft < 0 ? 'Overdue by ' + Math.abs(daysLeft) + 'd' : daysLeft + ' days') : '—' },
                        { l: 'Status', v: item.status_label || '—' },
                    ].map(r => (
                        <View key={r.l} style={EC.dRow}>
                            <Text style={EC.dl}>{r.l}</Text>
                            <Text style={[EC.dv, r.l === 'Days Remaining' && { color: dCol }]}>{r.v}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}

// ─── Stat Summary Card ────────────────────────────────────────
function StatRow({ items }: { items: { label: string; value: any; color: string }[] }) {
    return (
        <View style={{ flexDirection: 'row', marginBottom: verticalScale(14), gap: 6 }}>
            {items.map(item => (
                <View key={item.label} style={[SS.card, { borderTopColor: item.color }]}>
                    <Text style={[SS.val, { color: item.color }]}>{item.value ?? 0}</Text>
                    <Text style={SS.lab}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
}
const SS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), flex: 1, borderTopWidth: 3, elevation: 2, alignItems: 'center' },
    val: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(3) },
    lab: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '700', textAlign: 'center' },
});

// --- Helper to convert JSON array to CSV string ---
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

// ─── MAIN ─────────────────────────────────────────────────────
export default function SiteMaintenanceToolScreen({ navigation, route }: any) {
  const { globalFilters } = useGlobalFilter();


    const initialTab: TabKey = (route?.params?.initialTab as TabKey) || 'infra';

    const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
    const [toolData, setToolData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [addSmpsVisible, setAddSmpsVisible] = useState(false);
    const [scheduleDcemVisible, setScheduleDcemVisible] = useState(false);
    const [addInfraVisible, setAddInfraVisible] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    // Update tab when navigated from sidebar
    useEffect(() => {
        const t = (route?.params?.initialTab as TabKey) || 'infra';
        setActiveTab(t);
        setSearch('');
    }, [route?.params?.initialTab]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
        fetchData();
    }, [activeTab]);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const res = await (api as any).getToolData({ section: activeTab, page: 1, rep_page: 1 });
            if (res) setToolData(res);
        } catch (e) {
            console.log('SiteMaintenance fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    // Data — all equipment types
    const battery: any[] = toolData?.equipment?.battery || [];
    const dg: any[] = toolData?.equipment?.dg || [];
    const ac: any[] = toolData?.equipment?.ac || [];
    const allEquip = [...battery, ...dg, ...ac];

    // Stats
    const operational = allEquip.filter(e => e.status_class === 'operational').length;
    const attention = allEquip.filter(e => e.status_class === 'attention').length;
    const critical = allEquip.filter(e => e.status_class === 'critical').length;

    // Search filter
    const filtered = allEquip.filter(r => {
        const q = search.toLowerCase();
        return (
            (r.global_id || '').toLowerCase().includes(q) ||
            (r.site_id || '').toLowerCase().includes(q) ||
            (r.site_name || '').toLowerCase().includes(q) ||
            (r.imei || '').toLowerCase().includes(q) ||
            (r.equipment_type || '').toLowerCase().includes(q)
        );
    });

    // Share
    const handleShare = async () => {
        if (!filtered.length) return;
        setExporting(true);
        try {
            const csvString = convertToCSV(filtered);
            const fileName = `Maintenance_${activeTab}_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: `${TAB_INFO[activeTab].label} Export`,
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

    const tabColor = TAB_INFO[activeTab].color;

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>

            {/* Header */}
            <AppHeader
                title="SITE MAINTENANCE TOOL"
                subtitle={TAB_INFO[activeTab].label}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                hideGlobalFilter={true}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleShare }
                ]}
            />

            {/* Quick Navigation Tab Bar */}
            <MaintenanceTopTabs
                activeKey={activeTab}
                onTabPress={(screen, tab) => {
                    if (screen === 'SiteMaintenanceTool') {
                        setActiveTab(tab as TabKey);
                        setSearch('');
                    } else {
                        navigation.navigate(screen, { initialTab: tab });
                    }
                }}
            />

            {loading && !toolData ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#01497c" />
                    <Text style={styles.loaderTxt}>Loading data...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, i) => `${item.site_id}_${item.equipment_type}_${i}`}
                    contentContainerStyle={{ padding: moderateScale(12), paddingBottom: verticalScale(30) }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                    ListHeaderComponent={
                        <View>
                            {/* Stats */}
                            <StatRow items={[
                                { label: 'Operational', value: operational, color: '#10b981' },
                                { label: 'Needs Attention', value: attention, color: '#f59e0b' },
                                { label: 'Critical', value: critical, color: '#ef4444' },
                                { label: 'Total Sites', value: allEquip.length, color: '#3b82f6' },
                            ]} />

                            {/* Search */}
                             <View style={styles.searchWrap}>
                                <AppIcon name="search" size={14} color="#94a3b8" />
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

                            {/* Section header */}
                            <View style={styles.secRow}>
                                <Text style={styles.secTitle}>
                                    {TAB_INFO[activeTab].label} ({filtered.length})
                                </Text>

                            </View>
                        </View>
                    }
                    renderItem={({ item }) =>
                        activeTab === 'dcem'
                            ? <DCEMCard item={item} />
                            : <EquipCard item={item} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                             <AppIcon name="inbox" size={36} color="#cbd5e1" />
                             <Text style={styles.emptyTxt}>
                                {search ? 'No items match your search' : 'No data available'}
                            </Text>
                        </View>
                    }
                />
            )}


            {/* --- Modals --- */}
            {addSmpsVisible && <Modal visible={true} transparent animationType="fade">
                <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(20)}}>
                    <View style={{backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(20)}}>
                        <Text style={{fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: moderateScale(15)}}>Add SMPS Details</Text>
                        
                        <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Site ID</Text>
                        <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} placeholder="Enter Site ID" placeholderTextColor="#64748b" />
                        
                        <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Current Model</Text>
                        <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} placeholder="e.g. Model X200" placeholderTextColor="#64748b" />

                        <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Capacity</Text>
                        <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} placeholder="e.g. 200A" placeholderTextColor="#64748b" />

                        <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: moderateScale(10), marginTop: moderateScale(10)}}>
                            <TouchableOpacity onPress={() => setAddSmpsVisible(false)} style={{padding: moderateScale(10)}}><Text style={{color: '#64748b', fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => { setAddSmpsVisible(false); Alert.alert('Success', 'SMPS details added.'); }} style={{backgroundColor: '#01497c', padding: moderateScale(10), borderRadius: 8}}><Text style={{color: '#fff', fontWeight: '700'}}>Add SMPS</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>}

            <ScheduleDcemModal visible={scheduleDcemVisible} onClose={() => setScheduleDcemVisible(false)} />


            {addInfraVisible && <Modal visible={true} transparent animationType="fade">
                <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(20)}}>
                    <View style={{backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(20)}}>
                        <Text style={{fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: moderateScale(15)}}>Add Infrastructure Entry</Text>
                        
                        <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Site ID</Text>
                        <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} placeholder="Enter Site ID" placeholderTextColor="#64748b" />
                        
                        <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Recommended Upgrade</Text>
                        <TextInput style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} placeholder="Details..." placeholderTextColor="#64748b" />

                        <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: moderateScale(10), marginTop: moderateScale(10)}}>
                            <TouchableOpacity onPress={() => setAddInfraVisible(false)} style={{padding: moderateScale(10)}}><Text style={{color: '#64748b', fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => { setAddInfraVisible(false); Alert.alert('Success', 'Infrastructure entry added.'); }} style={{backgroundColor: '#01497c', padding: moderateScale(10), borderRadius: 8}}><Text style={{color: '#fff', fontWeight: '700'}}>Save Entry</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>}

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="SiteMaintenanceTool"
                handleLogout={async () => {
                    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
                    await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                    navigation.replace('Login');
                }}
            />
            </View>
        </SafeAreaView>
    );
}


function ScheduleDcemModal({ visible, onClose }: { visible: boolean; onClose: () => void; }) {
    const [siteId, setSiteId] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    if (!visible) return null;

    return (
        <Modal visible={true} transparent animationType="fade">
            <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(20)}}>
                <View style={{backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(20)}}>
                    <Text style={{fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#01497c', marginBottom: moderateScale(15)}}>Schedule Calibration</Text>
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Site ID</Text>
                    <TextInput 
                        style={{borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: moderateScale(10), marginBottom: moderateScale(15), color: '#0f172a'}} 
                        placeholder="Enter Site ID" placeholderTextColor="#94a3b8"
                        value={siteId} onChangeText={setSiteId}
                    />
                    
                    <Text style={{fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: 5}}>Calibration Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginBottom: moderateScale(15)}}>
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

                    <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: moderateScale(10), marginTop: moderateScale(10)}}>
                        <TouchableOpacity onPress={onClose} style={{padding: moderateScale(10)}}><Text style={{color: '#64748b', fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { onClose(); Alert.alert('Success', 'Calibration scheduled.'); }} style={{backgroundColor: '#01497c', padding: moderateScale(10), borderRadius: 8}}><Text style={{color: '#fff', fontWeight: '700'}}>Schedule</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: '#01497c', fontWeight: '700', fontSize: responsiveFontSize(15), flexShrink: 1, },
    tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 52 },
    tabScroll: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), gap: 8, alignItems: 'center' },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8), borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    tabTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(10), elevation: 1, gap: 8 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '700' },
    secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) },
    secTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6) },
    exportTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13), flexShrink: 1, },
    emptyBox: { alignItems: 'center', paddingTop: verticalScale(40) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(15), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '700', textAlign: 'center' },
});