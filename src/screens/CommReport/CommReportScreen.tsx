import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl, Alert, Platform,
    TextInput, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'CommReport'>;

/**
 * Premium Mobile Communication Report Screen
 * Optimized for dynamic data analysis and premium CSV export.
 * UI matched to Home/Site Status themes.
 */
export default function CommReportScreen({ navigation }: Props) {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sites, setSites] = useState<any[]>([]);
    const [commData, setCommData] = useState<any[]>([]);
    
    // Server-reported totals
    const [serverKpi, setServerKpi] = useState<any>({ total: 0, active: 0, nonActive: 0 });

    // Box counts for the device status row
    const [deviceCounts, setDeviceCounts] = useState<any>({ smps: 0, amf: 0, both: 0, dcem: 0, any: 0 });

    const [expandedImei, setExpandedImei] = useState<string | null>(null);
    const [activeFilters, setActiveFilters] = useState<any>(globalFilters)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [commFilter, setCommFilter] = useState<string | null>(null);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const loadUser = async () => {
            const name = await AsyncStorage.getItem('user_fullname');
            if (name) setFullname(name);
        };
        loadUser();
        fetchData(activeFilters);
    }, [activeFilters]);

    const fetchData = async (currentFilters = {}) => {
        setLoading(true);
        try {
            const res = await api.getSiteStatus(currentFilters, 1, 1000);
            const rawSites = res.sites || [];
            const rawComm = res.communication || [];
            setSites(rawSites);
            setCommData(rawComm);
            
            const apiKpi = res.unfiltered_kpi || res.site_kpi || res.kpi || {};
            setServerKpi({
                total: apiKpi.total_sites || apiKpi.total || rawSites.length || 0,
                active: apiKpi.active_sites || apiKpi.active || 0,
                nonActive: apiKpi.non_active_sites || apiKpi.non_active || 0
            });

            const cutoff = new Date(new Date().getTime() - 30 * 60 * 1000);
            let smps = 0, amf = 0, both = 0, dcem = 0, any = 0;

            rawSites.forEach((s: any) => {
                const d = rawComm.find((c: any) => c.imei === s.imei);
                if (!d) {
                    any++; smps++; amf++; both++; dcem++; 
                    return;
                }
                const sOk = d.SMPS_LAST_COM && new Date(d.SMPS_LAST_COM) >= cutoff;
                const aOk = d.AMF_LAST_COM && new Date(d.AMF_LAST_COM) >= cutoff;
                const dOk = d.DCEM_Last_Com && new Date(d.DCEM_Last_Com) >= cutoff;

                if (!sOk) smps++;
                if (!aOk) amf++;
                if (!sOk && !aOk) both++;
                if (!dOk) dcem++;
                if (!sOk || !aOk || !dOk) any++;
            });

            const apiStats = res.comm_stats || {};
            setDeviceCounts({
                smps: apiStats.smps_not_comm_30min || smps,
                amf: apiStats.amf_not_comm_30min || amf,
                both: apiStats.both_smps_amf_not_comm || both,
                dcem: apiStats.dcem_not_comm_30min || dcem,
                any: apiStats.any_device_not_comm || any
            });

        } catch (e) {
            console.log("Fetch Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleExport = async () => {
        if (displayItems.length === 0) {
            return Alert.alert("No Data", "Filter results are empty.");
        }
        setExporting(true);
        try {
            const header = "Global ID,Site ID,IMEI,Site Name,Status,SMPS Last Comm,AMF Last Comm,DCEM Last Comm,Remarks\n";
            const rowData = displayItems.map(s => {
                const c = commData.find(d => d.imei === s.imei);
                return `"${s.global_id || ''}","${s.site_id}","${s.imei}","${s.site_name}","${s.site_status}","${c?.SMPS_LAST_COM||'-'}","${c?.AMF_LAST_COM||'-'}","${c?.DCEM_Last_Com||'-'}","${(c?.Remarks || '').replace(/"/g, '""')}"`;
            }).join("\n");

            const csvContent = header + rowData;
            const fName = `CommReport_${Date.now()}.csv`;
            const path = `${RNFS.CachesDirectoryPath}/${fName}`;
            await RNFS.writeFile(path, csvContent, 'utf8');
            await Share.open({ title: 'Export Report', url: `file://${path}`, type: 'text/csv' });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Failed to share report.");
            }
        } finally {
            setExporting(false);
        }
    };

    const currentCommGroup = useMemo(() => {
        if (commFilter === null) return sites;
        const limit = new Date(new Date().getTime() - 30 * 60 * 1000);
        return sites.filter(s => {
            const d = commData.find(c => c.imei === s.imei);
            if (!d) return true;
            const sOk = d.SMPS_LAST_COM && new Date(d.SMPS_LAST_COM) >= limit;
            const aOk = d.AMF_LAST_COM && new Date(d.AMF_LAST_COM) >= limit;
            const dOk = d.DCEM_Last_Com && new Date(d.DCEM_Last_Com) >= limit;
            if (commFilter === 'smps') return !sOk;
            if (commFilter === 'amf') return !aOk;
            if (commFilter === 'both') return !sOk && !aOk;
            if (commFilter === 'dcem') return !dOk;
            if (commFilter === 'any') return !sOk || !aOk || !dOk;
            return true;
        });
    }, [commFilter, sites, commData]);

    const liveKpiStats = useMemo(() => {
        const total = currentCommGroup.length;
        const active = currentCommGroup.filter(s => s.site_status === 'Active').length;
        const nonActive = total - active;
        return { total, active, nonActive };
    }, [currentCommGroup]);

    const displayItems = useMemo(() => {
        let list = currentCommGroup;
        if (statusFilter) {
            list = list.filter(s =>
                statusFilter === 'active' ? s.site_status === 'Active' : s.site_status !== 'Active'
            );
        }
        if (search) {
            const low = search.toLowerCase();
            list = list.filter(s =>
                s.global_id?.toLowerCase().includes(low) ||
                s.site_id?.toLowerCase().includes(low) ||
                s.site_name?.toLowerCase().includes(low) ||
                s.imei?.includes(search)
            );
        }
        return list;
    }, [currentCommGroup, statusFilter, search]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(activeFilters);
    }, [activeFilters]);

    const checkTime = (time: string | undefined) => {
        if (!time) return { ok: false, label: 'Missing' };
        const diff = (new Date().getTime() - new Date(time).getTime()) / 60000;
        return diff <= 30 ? { ok: true, label: 'OK' } : { ok: false, label: 'Off' };
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="Comm Report"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    { icon: 'filter', onPress: () => setFilterModalVisible(true) },
                ]}
            />

            {/* Standardized White KPIs matched to Home/SiteStatus */}
            <View style={styles.kpiContainer}>
                <TouchableOpacity style={[styles.kpiCard, statusFilter === null && styles.kpiActive]} onPress={() => setStatusFilter(null)}>
                    <Text style={styles.kpiValue}>{liveKpiStats.total}</Text>
                    <Text style={styles.kpiLabel}>Total</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.kpiCard, statusFilter === 'active' && styles.kpiActive]} onPress={() => setStatusFilter('active')}>
                    <Text style={[styles.kpiValue, { color: '#10b981' }]}>{liveKpiStats.active}</Text>
                    <Text style={styles.kpiLabel}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.kpiCard, statusFilter === 'down' && styles.kpiActive]} onPress={() => setStatusFilter('down')}>
                    <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{liveKpiStats.nonActive}</Text>
                    <Text style={styles.kpiLabel}>Non-Active</Text>
                </TouchableOpacity>
            </View>

            <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}>
                {/* Search Bar */}
                <View style={styles.searchWrap}>
                    <AppIcon name="search" size={14} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Global ID or Name..."
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

                <View style={styles.secTitle}><Text style={styles.secTitleText}>Device Comm Issue Analysis (30m)</Text></View>
                <View style={styles.grid}>
                    <Box label="SMPS ISSUES" count={deviceCounts.smps} color="#eb3349" icon="server" active={commFilter === 'smps'} onPress={() => {setCommFilter(commFilter === 'smps' ? null : 'smps'); setExpandedImei(null);}} />
                    <Box label="AMF ISSUES" count={deviceCounts.amf} color="#fd7e14" icon="cpu" active={commFilter === 'amf'} onPress={() => {setCommFilter(commFilter === 'amf' ? null : 'amf'); setExpandedImei(null);}} />
                    <Box label="BOTH ISSUES" count={deviceCounts.both} color="#6f42c1" icon="shield-off" active={commFilter === 'both'} onPress={() => {setCommFilter(commFilter === 'both' ? null : 'both'); setExpandedImei(null);}} />
                    <Box label="DCEM ISSUES" count={deviceCounts.dcem} color="#0ea5e9" icon="database" active={commFilter === 'dcem'} onPress={() => {setCommFilter(commFilter === 'dcem' ? null : 'dcem'); setExpandedImei(null);}} />
                    <Box label="ALL SITE" count={deviceCounts.any} color="#6c757d" icon="globe" active={commFilter === 'any'} onPress={() => {setCommFilter(commFilter === 'any' ? null : 'any'); setExpandedImei(null);}} />
                </View>

                <View style={styles.listLabel}><Text style={styles.listLabelText}>SITE RECORDS ({displayItems.length})</Text></View>

                {loading && !refreshing ? <ActivityIndicator size="large" color="#1e3c72" style={{ marginTop: verticalScale(40) }} /> : (
                    <FlatList
                        data={displayItems}
                        renderItem={({ item }) => {
                            const c = commData.find(d => d.imei === item.imei);
                            const open = expandedImei === item.imei;
                            const sS = checkTime(c?.SMPS_LAST_COM);
                            const aS = checkTime(c?.AMF_LAST_COM);
                            const dS = checkTime(c?.DCEM_Last_Com);
                            return (
                                <View style={styles.card}>
                                    <TouchableOpacity style={styles.cardInfo} onPress={() => setExpandedImei(open ? null : item.imei)}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardId}>Global ID: {item.global_id || item.site_id}</Text>
                                            <Text style={styles.cardName}>{item.site_name}</Text>
                                            <Text style={styles.cardImei}>{item.imei}</Text>
                                        </View>
                                        <View style={styles.cardEnd}>
                                            <View style={[styles.pill, item.site_status === 'Active' ? styles.activePill : styles.downPill]}>
                                               <Text style={styles.pillTxt}>{item.site_status}</Text>
                                            </View>
                                            <AppIcon name={open ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
                                        </View>
                                    </TouchableOpacity>
                                    {open && (
                                        <View style={styles.expanded}>
                                            <View style={styles.unitRow}>
                                                <Unit label="SMPS" ok={sS.ok} l={sS.label} m={c?.SMPS_Make} t={c?.SMPS_LAST_COM} />
                                                <Unit label="AMF" ok={aS.ok} l={aS.label} m={c?.AMF_Make} t={c?.AMF_LAST_COM} />
                                            </View>
                                            <View style={styles.unitRow}>
                                                <Unit label="DCEM" ok={dS.ok} l={dS.label} m={c?.DCEM_Make} t={c?.DCEM_Last_Com} />
                                            </View>
                                            {c?.Remarks && <View style={styles.note}><Text style={styles.noteTitle}>NOTE</Text><Text style={styles.noteText}>{c.Remarks}</Text></View>}
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}>
                                                <Text style={styles.actionBtnText}>Full Analysis</Text>
                                                <AppIcon name="activity" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                        keyExtractor={item => item.imei}
                        scrollEnabled={false}
                        ListEmptyComponent={<View style={styles.empty}><AppIcon name="info" size={40} color="#cbd5e1" /><Text style={styles.emptyText}>Nothing to show</Text></View>}
                    />
                )}
                <View style={{ height: verticalScale(40) }} />
            </ScrollView>
            <GlobalFilterBanner />
      <FilterModal visible={filterModalVisible} onClose={() => setFilterModalVisible(false)} onApply={f => { setActiveFilters(f); setFilterModalVisible(false); }} initialFilters={activeFilters} />
            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                handleLogout={async () => {
                    await AsyncStorage.removeItem('user_fullname');
                    await logoutApi();
                    navigation.replace('Login');
                }}
                activeRoute="CommReport"
            />
            </View>
        </SafeAreaView>
    );
}

const Box = ({ label, count, color, icon, active, onPress }: any) => (
    <TouchableOpacity style={[styles.boxWrap, active && { borderColor: color, backgroundColor: '#fff', elevation: 4 }]} onPress={onPress}>
        <View style={[styles.boxIcoWrap, { backgroundColor: color }]}><AppIcon name={icon} size={11} color="#fff" /></View>
        <Text style={styles.boxN}>{count}</Text>
        <Text style={styles.boxL}>{label}</Text>
    </TouchableOpacity>
);

const Unit = ({ label, ok, l, m, t }: any) => (
    <View style={styles.unit}>
        <View style={styles.unitH}>
            <Text style={styles.unitLabel}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppIcon name={ok ? 'check-circle' : 'alert-circle'} size={10} color={ok ? '#11998e' : '#ef4444'} />
                <Text style={[styles.unitStat, { color: ok ? '#11998e' : '#ef4444' }]}>{l}</Text>
            </View>
        </View>
        <Text style={styles.unitV}>Make: {m || '-'}</Text>
        <Text style={styles.unitV}>Last: {t || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#c5d4eeff' },
    backBtn: { padding: moderateScale(4) },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { padding: moderateScale(8), marginLeft: moderateScale(10) },

    kpiContainer: { flexDirection: 'row', padding: moderateScale(16), gap: moderateScale(10) },
    kpiCard: { flex: 1, backgroundColor: '#fff', padding: moderateScale(16), borderRadius: 12, alignItems: 'center', elevation: 2 },
    kpiActive: { borderWidth: 2, borderColor: '#1e3c72' },
    kpiValue: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
    kpiLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#666', marginTop: verticalScale(4) },

    searchWrap: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        marginHorizontal: moderateScale(16), marginVertical: verticalScale(8), borderRadius: 10,
        paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), elevation: 1, gap: 8,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a', fontWeight: '500', padding: moderateScale(0) },

    secTitle: { padding: moderateScale(16), paddingBottom: verticalScale(8) },
    secTitleText: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: moderateScale(16), gap: moderateScale(10), marginBottom: verticalScale(15) },
    boxWrap: { width: '31%', backgroundColor: '#fcfdfe', borderRadius: 12, padding: moderateScale(10), alignItems: 'center', elevation: 1, borderWidth: 1.5, borderColor: '#e2e8f0' },
    boxIcoWrap: { width: moderateScale(22), height: verticalScale(22), borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(4) },
    boxN: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1e293b' },
    boxL: { fontSize: responsiveFontSize(7), flexShrink: 1, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
    listLabel: { backgroundColor: '#e2e8f0', padding: moderateScale(10), paddingHorizontal: moderateScale(16) },
    listLabelText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },

    card: { backgroundColor: '#fff', marginHorizontal: moderateScale(16), marginTop: verticalScale(12), borderRadius: 16, elevation: 2, overflow: 'hidden' },
    cardInfo: { padding: moderateScale(16), flexDirection: 'row', alignItems: 'center' },
    cardId: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
    cardName: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#475569', fontWeight: '500' },
    cardImei: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8' },
    cardEnd: { alignItems: 'flex-end', gap: 6 },
    pill: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(4), borderRadius: 12 },
    activePill: { backgroundColor: '#d1fae5' },
    downPill: { backgroundColor: '#fee2e2' },
    pillTxt: { color: '#333', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '600' },

    expanded: { padding: moderateScale(16), paddingTop: verticalScale(0), backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    unitRow: { flexDirection: 'row', gap: moderateScale(10), marginTop: verticalScale(10) },
    unit: { flex: 1, backgroundColor: '#fff', padding: moderateScale(12), borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    unitH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) },
    unitLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#1e293b' },
    unitStat: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800' },
    unitV: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b' },
    note: { marginTop: verticalScale(12), padding: moderateScale(12), backgroundColor: '#fffbe6', borderRadius: 10, borderWidth: 1, borderColor: '#ffe58f' },
    noteTitle: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800', color: '#856404', marginBottom: verticalScale(2) },
    noteText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#92400e' },
    actionBtn: { marginTop: verticalScale(16), backgroundColor: '#1e3c72', padding: moderateScale(14), borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { color: '#fff', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', marginRight: moderateScale(8) },
    empty: { alignItems: 'center', padding: moderateScale(60) },
    emptyText: { marginTop: verticalScale(12), color: '#94a3b8', fontWeight: '600' }
});