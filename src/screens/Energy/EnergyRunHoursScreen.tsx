/**
 * EnergyRunHoursScreen.tsx
 *
 * API: GET /api/energy/run-hours/
 * Params: date_from, date_to, state_id, district_id, cluster_id, energy_type, site_id, etc.
 *
 * Response:
 * {
 *   status, total_active_sites, is_single_day, from_date, to_date,
 *   summary: { avg_eb, avg_dg, avg_bb, total_sites },
 *   eb_categories:         [{ name, count, color, percentage }],
 *   battery_categories:    [{ name, count, color, percentage }],
 *   dg_categories:         [{ name, count, color, percentage }],
 *   mains_fail_categories: [{ name, count, color, percentage }]
 * }
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    Modal, TextInput, Alert, Share, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../api';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

// ─── Helpers ─────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgoStr(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
function yesterdayStr() { return daysAgoStr(1); }

// ─── Mini horizontal bar ──────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <View style={{ height: verticalScale(6), backgroundColor: '#f1f5f9', borderRadius: 3, marginTop: verticalScale(4) }}>
            <View style={{ height: verticalScale(6), width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
        </View>
    );
}

// ─── Category Card ────────────────────────────────────────────
function CategoryCard({ cat, maxCount, onPress }: {
    cat: any; maxCount: number; onPress: () => void;
}) {
    const color = cat.color || '#3b82f6';
    return (
        <TouchableOpacity
            style={[CCS.card, { borderLeftColor: color }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={CCS.row}>
                <Text style={CCS.name} numberOfLines={2}>{cat.name}</Text>
                <Text style={[CCS.count, { color }]}>{cat.count}</Text>
            </View>
            {cat.percentage != null && (
                <Text style={CCS.pct}>{cat.percentage}% of total sites</Text>
            )}
            <HBar value={cat.count} max={maxCount} color={color} />
        </TouchableOpacity>
    );
}
const CCS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), borderLeftWidth: 4, elevation: 2, marginBottom: verticalScale(10), shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: verticalScale(4) },
    name: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: moderateScale(8) },
    count: { fontSize: responsiveFontSize(26), flexShrink: 1, fontWeight: '800' },
    pct: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', marginBottom: verticalScale(4) },
});

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={[KCS.card, { borderTopColor: color }]}>
            <Text style={[KCS.val, { color }]}>{value}</Text>
            <Text style={KCS.lab}>{label}</Text>
        </View>
    );
}
const KCS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), flexGrow: 1, minWidth: '30%', borderTopWidth: 4, elevation: 3, alignItems: 'center', marginHorizontal: moderateScale(4), marginBottom: verticalScale(8) },
    val: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(2) },
    lab: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
});

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, icon, iconColor, children }: {
    title: string; icon: string; iconColor: string; children?: React.ReactNode;
}) {
    return (
        <View style={SEC.wrap}>
            <View style={SEC.header}>
                <AppIcon name={icon} size={16} color={iconColor} />
                <Text style={SEC.title}>{title}</Text>
            </View>
            {children}
        </View>
    );
}
const SEC = StyleSheet.create({
    wrap: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: verticalScale(14) },
    title: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Date quick buttons ───────────────────────────────────────
const DATE_PRESETS = [
    { label: 'Yesterday', from: yesterdayStr(), to: yesterdayStr() },
    { label: 'Today', from: todayStr(), to: todayStr() },
    { label: 'Week', from: daysAgoStr(7), to: todayStr() },
    { label: 'Month', from: daysAgoStr(30), to: todayStr() },
];

// FilterDrawer removed in favor of global FilterModal

// ─── MAIN ─────────────────────────────────────────────────────
export default function EnergyRunHoursScreen({ navigation }: any) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [activeSection, setActiveSection] = useState<'all' | 'eb' | 'battery' | 'dg' | 'solar'>('all');
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    const scrollRef = useRef<ScrollView>(null);
    const sectionRefs: Record<string, number> = {};

    const { globalFilters, setGlobalFilters, isReady } = useGlobalFilter();

    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
        fetchData();
    }, []);

    const fetchData = useCallback(async (isRefresh = false, customFilters?: any) => {
        if (!isRefresh) setLoading(true);
        const params = customFilters || globalFilters;

        try {
            const res = await (api as any).getEnergyRunHours(
                Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))
            );
            if (res?.status === 'success') setData(res);
        } catch (e) {
            console.log('Energy run hours error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [globalFilters]);


    const onRefresh = () => { setRefreshing(true); fetchData(true); };
    const onApply = () => { setData(null); fetchData(false); };

    // Share/Download summary
    const handleExport = async () => {
        if (!data) return;
        setExporting(true);
        const { summary, from_date, to_date } = data;
        const csvContent = [
            `"ENERGY RUN HOURS REPORT (${from_date}${from_date !== to_date ? ` to ${to_date}` : ''})"`,
            '',
            'KPI,VALUE',
            `"Avg EB Hours","${summary?.avg_eb || 0}h"`,
            `"Avg DG Hours","${summary?.avg_dg || 0}h"`,
            `"Avg Battery Hours","${summary?.avg_bb || 0}h"`,
            `"Total Sites","${summary?.total_sites || 0}"`,
            '',
            'ESTIMATED MONTHLY COST,AMOUNT',
            `"Estimated SEB Bill","₹${Math.round((parseFloat(summary?.avg_eb) || 0) * 30 * 8 * (parseInt(summary?.total_sites) || 0)).toLocaleString('en-IN')}"`,
            `"Estimated Diesel Cost","₹${Math.round((parseFloat(summary?.avg_dg) || 0) * 30 * 3 * 95 * (parseInt(summary?.total_sites) || 0)).toLocaleString('en-IN')}"`,
            `"Total Estimated Cost","₹${(Math.round((parseFloat(summary?.avg_eb) || 0) * 30 * 8 * (parseInt(summary?.total_sites) || 0)) + Math.round((parseFloat(summary?.avg_dg) || 0) * 30 * 3 * 95 * (parseInt(summary?.total_sites) || 0))).toLocaleString('en-IN')}"`,
        ].join('\n');

        const path = `${RNFS.TemporaryDirectoryPath}/energy_run_hours_${from_date}_to_${to_date}_${Date.now()}.csv`;
        
        try {
            await RNFS.writeFile(path, csvContent, 'utf8');
            await RNShare.open({
                url: `file://${path}`,
                type: 'text/csv',
                filename: 'Energy_Run_Hours_Report',
                title: 'Share Energy Report'
            });
        } catch (e: any) {
            console.log('Export error:', e);
            if (e?.message !== 'User did not share') {
                try { await Share.share({ message: csvContent, title: 'Energy Report' }); } catch (err) { }
            }
        } finally {
            setExporting(false);
        }
    };

    const summary = data?.summary || {};
    const ebCategories = data?.eb_categories || [];
    const batteryCategories = data?.battery_categories || [];
    const dgCategories = data?.dg_categories || [];
    const mainsCategories = data?.mains_fail_categories || [];
    const solarCategories = data?.solar_categories || [];
    const slrebCategories = data?.slreb_categories || [];
    const slrbtCategories = data?.slrbt_categories || [];
    const slrdgCategories = data?.slrdg_categories || [];

    const maxEB = Math.max(...ebCategories.map((c: any) => c.count), 1);
    const maxBat = Math.max(...batteryCategories.map((c: any) => c.count), 1);
    const maxDG = Math.max(...dgCategories.map((c: any) => c.count), 1);
    const maxMains = Math.max(...mainsCategories.map((c: any) => c.count), 1);
    const maxSolar = Math.max(...solarCategories.map((c: any) => c.count), 1);

    const avgEB = parseFloat(summary.avg_eb) || 0;
    const avgDG = parseFloat(summary.avg_dg) || 0;
    const avgSolar = parseFloat(summary.avg_solar) || 0;
    const totalS = parseInt(summary.total_sites) || 0;
    const sebCost = Math.round(avgEB * 30 * 8 * totalS);
    const dieselCost = Math.round(avgDG * 30 * 3 * 95 * totalS);
    const totalCost = sebCost + dieselCost;
    const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

    const filteredEB = React.useMemo(() => 
        ebCategories.filter((c: any) => 
            !c.name.includes('DG') && !c.name.includes('Zero') &&
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [ebCategories, searchQuery]);

    const filteredBattery = React.useMemo(() => 
        batteryCategories.filter((c: any) => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [batteryCategories, searchQuery]);

    const filteredDG = React.useMemo(() => 
        dgCategories.filter((c: any) => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [dgCategories, searchQuery]);

    const filteredZeroDG = React.useMemo(() => 
        ebCategories.filter((c: any) => 
            c.name.includes('Zero DG') &&
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [ebCategories, searchQuery]);

    const filteredMains = React.useMemo(() => 
        mainsCategories.filter((c: any) => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [mainsCategories, searchQuery]);

    const filteredSolar = React.useMemo(() => 
        solarCategories.filter((c: any) => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [solarCategories, searchQuery]);

    const dateLabel = data?.is_single_day
        ? `${data?.from_date}`
        : `${data?.from_date} → ${data?.to_date}`;

    const goToDetails = (category: string) => {
        navigation.navigate('EnergyRunHoursDetails', {
            ...globalFilters,
            category,
            date_from: data?.from_date || globalFilters.date_from,
            date_to: data?.to_date || globalFilters.date_to,
        });
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="Energy Run Hours"
                subtitle={data ? dateLabel : 'Loading...'}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    { icon: 'sliders', onPress: () => setFilterVisible(true) },
                ]}
            />
            
            <GlobalFilterBanner />

            {/* Section Filter Tabs */}
            <View style={styles.tabBar}>
                {([
                    { key: 'all', label: `All Sites (${summary.total_sites || '—'})` },
                    { key: 'eb', label: 'EB Analysis' },
                    { key: 'battery', label: 'Battery Analysis' },
                    { key: 'dg', label: 'DG Analysis' },
                    { key: 'solar', label: '☀ Solar Analysis' },
                ] as const).map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[styles.tabBtn, activeSection === t.key && styles.tabBtnActive]}
                        onPress={() => {
                            setActiveSection(t.key);
                            setSearchQuery('');
                        }}
                    >
                        <Text style={[styles.tabTxt, activeSection === t.key && styles.tabTxtActive]}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search categories..."
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
            </View>

            {/* Main Content */}
            <ScrollView
                ref={scrollRef}
                style={{ flex: 1, backgroundColor: '#c5d4ee' }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                    {/* Summary KPI row */}
                    {(activeSection === 'all') && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: verticalScale(16) }}>
                            <KpiCard label="Avg EB Hours" value={`${summary.avg_eb || 0}h`} color="#01497c" />
                            <KpiCard label="Avg DG Hours" value={`${summary.avg_dg || 0}h`} color="#2a6f97" />
                            <KpiCard label="Avg BB Hours" value={`${summary.avg_bb || 0}h`} color="#468faf" />
                            <KpiCard label="Avg Solar Hours" value={`${summary.avg_solar || 0}h`} color="#f97316" />
                            <KpiCard label="Total Sites" value={String(summary.total_sites || 0)} color="#89C2D9" />
                        </View>
                    )}

                    {/* EB Section */}
                    {(activeSection === 'all' || activeSection === 'eb') && filteredEB.length > 0 && (
                        <Section title="EB Run Hours Distribution" icon="zap" iconColor="#01497c">
                            {filteredEB.map((cat: any, i: number) => (
                                <CategoryCard key={i} cat={cat} maxCount={maxEB}
                                    onPress={() => goToDetails(cat.name)} />
                            ))}
                        </Section>
                    )}

                    {/* Battery Section */}
                    {(activeSection === 'all' || activeSection === 'battery') && filteredBattery.length > 0 && (
                        <Section title="Battery Run Hours Analysis" icon="battery" iconColor="#468faf">
                            {filteredBattery.map((cat: any, i: number) => (
                                <CategoryCard key={i} cat={cat} maxCount={maxBat}
                                    onPress={() => goToDetails(cat.name)} />
                            ))}
                        </Section>
                    )}

                    {/* DG Section */}
                    {(activeSection === 'all' || activeSection === 'dg') && (
                        <>
                            {filteredDG.length > 0 && (
                                <Section title="DG Run Hours" icon="truck" iconColor="#2a6f97">
                                    {filteredDG.map((cat: any, i: number) => (
                                        <CategoryCard key={i} cat={cat} maxCount={maxDG}
                                            onPress={() => goToDetails(cat.name)} />
                                    ))}
                                    {/* Zero DG */}
                                    {filteredZeroDG.map((cat: any, i: number) => (
                                        <CategoryCard key={`zdg_${i}`} cat={cat} maxCount={maxDG}
                                            onPress={() => goToDetails(cat.name)} />
                                    ))}
                                </Section>
                            )}

                            {filteredMains.length > 0 && (
                                <Section title="Mains Failure Duration" icon="alert-triangle" iconColor="#012a4a">
                                    {filteredMains.map((cat: any, i: number) => (
                                        <CategoryCard key={i} cat={cat} maxCount={maxMains}
                                            onPress={() => goToDetails(cat.name)} />
                                    ))}
                                </Section>
                            )}
                        </>
                    )}

                    {/* Solar Section */}
                    {(activeSection === 'all' || activeSection === 'solar') && (
                        <View style={{ backgroundColor: '#fff7ed', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), borderWidth: 1, borderColor: '#fdba74' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: verticalScale(14) }}>
                                <AppIcon name="sun" size={16} color="#ea580c" />
                                <Text style={{ fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#9a3412', textTransform: 'uppercase' }}>Solar Run Hours Analysis</Text>
                                <Text style={{ fontSize: responsiveFontSize(10), flexShrink: 1, color: '#c2410c' }}>(Sites running with Solar assistance)</Text>
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: moderateScale(16) }}>
                                {[
                                    { label: 'SLREB (Solar + EB)', count: slrebCategories.reduce((a:any, c:any) => a + c.count, 0), color: '#fb923c' },
                                    { label: 'SLRBT (Solar + Battery)', count: slrbtCategories.reduce((a:any, c:any) => a + c.count, 0), color: '#a3e635' },
                                    { label: 'SLRDG (Solar + DG)', count: slrdgCategories.reduce((a:any, c:any) => a + c.count, 0), color: '#ef4444' }
                                ].map((sc, i) => (
                                    <View key={i} style={{ width: '31%', backgroundColor: '#fff', borderRadius: 8, padding: moderateScale(10), borderLeftWidth: 3, borderLeftColor: sc.color, elevation: 1 }}>
                                        <Text style={{ fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1e293b' }}>{sc.count}</Text>
                                        <Text style={{ fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', marginTop: 4 }}>{sc.label}</Text>
                                    </View>
                                ))}
                            </View>

                            {filteredSolar.length > 0 && (
                                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(16) }}>
                                    <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#334155', marginBottom: moderateScale(12) }}>Solar Hours Distribution</Text>
                                    {filteredSolar.map((cat: any, i: number) => (
                                        <CategoryCard key={i} cat={{...cat, color: '#f97316'}} maxCount={maxSolar} onPress={() => goToDetails(cat.name)} />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Cost Estimation */}
                    {activeSection === 'all' && (
                        <View style={styles.costCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: verticalScale(16) }}>
                                <Text style={styles.costTitle}>Monthly Cost Estimation</Text>
                            </View>
                            <View style={styles.costRow}>
                                <View style={styles.costItem}>
                                    <Text style={styles.costVal}>{fmtINR(sebCost)}</Text>
                                    <Text style={styles.costLab}>Estimated SEB Bill</Text>
                                </View>
                                <View style={styles.costItem}>
                                    <Text style={styles.costVal}>{fmtINR(dieselCost)}</Text>
                                    <Text style={styles.costLab}>Estimated Diesel Cost</Text>
                                </View>
                                <View style={styles.costItem}>
                                    <Text style={[styles.costVal, { fontSize: responsiveFontSize(16), flexShrink: 1, }]}>{fmtINR(totalCost)}</Text>
                                    <Text style={styles.costLab}>Total Estimated Cost</Text>
                                </View>
                            </View>
                            <Text style={styles.costNote}>
                                *Based on ₹8/kWh EB rate, ₹95/ltr diesel, 3L/hr DG consumption
                            </Text>
                        </View>
                    )}

                    {/* No data */}
                    {(!data || (searchQuery && filteredEB.length === 0 && filteredBattery.length === 0 && filteredDG.length === 0 && filteredMains.length === 0)) && (
                        <View style={styles.emptyBox}>
                            <AppIcon name={searchQuery ? "search" : "zap-off"} size={40} color="#cbd5e1" />
                            <Text style={styles.emptyTxt}>{searchQuery ? `No categories match "${searchQuery}"` : "No data available"}</Text>
                            {!searchQuery && (
                                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
                                    <Text style={styles.retryTxt}>Retry</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>


            {/* Filter Modal */}
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                initialFilters={globalFilters}
                onApply={(f) => {
                    setGlobalFilters(f);
                    setFilterVisible(false);
                    setData(null);
                    fetchData(false, f);
                }}
            />

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="EnergyRunHours"
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
    scrollContent: {
        padding: moderateScale(16),
        maxWidth: 650,
        alignSelf: 'center',
        width: '100%',
        paddingBottom: verticalScale(30),
    },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: '#01497c', fontWeight: '600', fontSize: responsiveFontSize(13), flexShrink: 1, },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(11) },
    tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#01497c' },
    tabTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    tabTxtActive: { color: '#01497c' },
    searchContainer: { padding: moderateScale(16), paddingBottom: verticalScale(0) },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: moderateScale(12), height: verticalScale(45), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: verticalScale(2) }, shadowOpacity: 0.1, shadowRadius: 4 },
    searchIcon: { marginRight: moderateScale(8) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', paddingVertical: verticalScale(0) },
    costCard: { backgroundColor: '#01497c', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14) },
    costTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#fff', flex: 1 },
    costRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: moderateScale(10) },
    costItem: { alignItems: 'center', minWidth: (SW - 60) / 3 },
    costVal: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#fff', marginBottom: verticalScale(4) },
    costLab: { fontSize: responsiveFontSize(9), flexShrink: 1, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textAlign: 'center' },
    costNote: { fontSize: responsiveFontSize(9), flexShrink: 1, color: 'rgba(255,255,255,0.6)', marginTop: verticalScale(10), textAlign: 'center' },
    downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(5) },
    downloadTxt: { color: '#fff', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800' },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(60) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(14), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '500' },
    retryBtn: { marginTop: verticalScale(16), backgroundColor: '#01497c', borderRadius: 10, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(10) },
    retryTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13), flexShrink: 1, },
});