
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    FlatList, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import AppHeader from '../../components/AppHeader';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

// ─────────────────────────────────────────────────────────────
// TAB CONFIG  (key must match resolveTabKey mapping below)
// ─────────────────────────────────────────────────────────────
const TABS = [
    { key: 'overview', label: 'Overview', icon: 'pie-chart', api: 'getAssetHealthOverview' },
    { key: 'battery', label: 'Battery', icon: 'battery', api: 'getAssetHealthBattery' },
    { key: 'dg', label: 'DG', icon: 'zap', api: 'getAssetHealthDG' },
    { key: 'rectifier', label: 'Rectifier', icon: 'cpu', api: 'getAssetHealthRectifier' },
    { key: 'solar', label: 'Solar', icon: 'sun', api: 'getAssetHealthSolar' },
    { key: 'dg_battery', label: 'DG Battery', icon: 'battery-charging', api: 'getAssetHealthDGBattery' },
    { key: 'lightning', label: 'LA', icon: 'cloud-lightning', api: 'getAssetHealthLightning' },
];

// Sidebar param → tab key
function resolveTabKey(p?: string): string {
    if (!p) return 'battery';
    const s = p.toLowerCase().trim();
    if (s === 'overview') return 'overview';
    if (s === 'la' || s.includes('lightning')) return 'lightning';
    if (s === 'dg battery' || s === 'dg_battery') return 'dg_battery';
    if (s === 'dg') return 'dg';
    if (s === 'battery') return 'battery';
    if (s === 'rectifier') return 'rectifier';
    if (s === 'solar') return 'solar';
    return 'battery';
}

// ─────────────────────────────────────────────────────────────
// COLOR HELPERS
// ─────────────────────────────────────────────────────────────
function statusColor(s: string): string {
    const v = (s || '').toLowerCase();
    if (['critical', 'high risk', 'blown', 'missing', 'poor'].some(x => v.includes(x))) return '#ef4444';
    if (['warning', 'at risk', 'replace', 'average', 'overload', 'not n+1', 'insufficient', 'review', 'monitor'].some(x => v.includes(x))) return '#f59e0b';
    if (['good', 'healthy', 'verified', 'functional', 'acceptable', 'running', 'exceeds', 'normal'].some(x => v.includes(x))) return '#10b981';
    if (['not installed', 'stopped', 'needs check', 'unknown', 'no_dg', 'no data', 'n/a'].some(x => v.includes(x))) return '#94a3b8';
    return '#3b82f6';
}
function statusBg(s: string): string {
    const c = statusColor(s);
    const m: Record<string, string> = {
        '#ef4444': 'rgba(239,68,68,0.10)', '#f59e0b': 'rgba(245,158,11,0.10)',
        '#10b981': 'rgba(16,185,129,0.10)', '#94a3b8': 'rgba(148,163,184,0.10)',
        '#3b82f6': 'rgba(59,130,246,0.10)',
    };
    return m[c] || 'rgba(59,130,246,0.10)';
}

// ─────────────────────────────────────────────────────────────
// SHARED: SummaryCards row
// ─────────────────────────────────────────────────────────────
function SummaryRow({ items }: { items: { label: string; value: any; color: string }[] }) {
    const isSmall = items.length <= 4;
    if (isSmall) {
        return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(4), paddingHorizontal: moderateScale(2), gap: 8 }}>
                {items.map(c => (
                    <View key={c.label} style={[SRS.card, { borderTopColor: c.color, flex: 1, minWidth: 0 }]}>
                        <Text style={[SRS.val, { color: c.color }]}>{c.value ?? 0}</Text>
                        <Text style={SRS.lab}>{c.label}</Text>
                    </View>
                ))}
            </View>
        );
    }
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: verticalScale(4), paddingHorizontal: moderateScale(2) }}>
            {items.map(c => (
                <View key={c.label} style={[SRS.card, { borderTopColor: c.color }]}>
                    <Text style={[SRS.val, { color: c.color }]}>{c.value ?? 0}</Text>
                    <Text style={SRS.lab}>{c.label}</Text>
                </View>
            ))}
        </ScrollView>
    );
}
const SRS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), minWidth: 84, borderTopWidth: 3, elevation: 2, alignItems: 'center' },
    val: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800' },
    lab: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: verticalScale(2), textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────
// SHARED: Expandable SiteCard
// ─────────────────────────────────────────────────────────────
type Row = { label: string; value: any; highlight?: boolean };

function SiteCard({ site, statusField, rows, note }: {
    site: any; statusField: string; rows: Row[]; note?: string;
}) {
    const [open, setOpen] = useState(false);
    const col = statusColor(statusField);
    const bg = statusBg(statusField);

    return (
        <TouchableOpacity style={SC.card} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
            {/* Top row */}
            <View style={SC.top}>
                <View style={{ flex: 1, paddingRight: moderateScale(8) }}>
                    <Text style={SC.name} numberOfLines={1}>{site.site_name || '—'}</Text>
                    <Text style={SC.sub}>
                        Site ID: {site.site_id || site.global_id || '—'}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[SC.badge, { backgroundColor: bg, borderColor: col }]}>
                        <Text style={[SC.badgeTxt, { color: col }]}>
                            {(statusField || 'Unknown').toUpperCase()}
                        </Text>
                    </View>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>

            {/* Expanded rows */}
            {open && (
                <View style={{ marginTop: verticalScale(10) }}>
                    <View style={SC.divider} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {rows.filter(r => r.value !== undefined && r.value !== null && r.value !== '—' && String(r.value).trim() !== '').map(r => (
                            <View key={r.label} style={SC.gridItem}>
                                <Text style={SC.gridLabel}>{r.label}</Text>
                                <Text style={[SC.gridValue, r.highlight && { color: statusColor(String(r.value)) }]}>
                                    {String(r.value)}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {!!note && (
                        <View style={[SC.noteBox, { backgroundColor: bg }]}>
                            <Text style={[SC.noteTxt, { color: col }]}>{note}</Text>
                        </View>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}
const SC = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), marginBottom: verticalScale(10), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    name: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(3) },
    sub: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#334155', fontWeight: '600' },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    badgeTxt: { fontSize: responsiveFontSize(8), flexShrink: 1, fontWeight: '800', letterSpacing: 0.4 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(12) },
    gridItem: { width: '48%', marginBottom: verticalScale(12) },
    gridLabel: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '600', marginBottom: verticalScale(3) },
    gridValue: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '800' },
    noteBox: { marginTop: verticalScale(8), padding: moderateScale(10), borderRadius: 10 },
    noteTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', lineHeight: 16 },
});

function Empty({ msg }: { msg: string }) {
    return (
        <View style={{ alignItems: 'center', paddingTop: verticalScale(60) }}>
            <Icon name="search" size={38} color="#cbd5e1" />
            <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '500' }}>{msg}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────

function OverviewScreen({ data, refreshing, onRefresh }: ScreenProps) {
    const o = data?.overview;
    if (!o) return <Empty msg="No overview data available" />;
    
    return (
        <ScrollView
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: moderateScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
        >
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(20), marginBottom: moderateScale(14), elevation: 3, alignItems: 'center' }}>
                <Text style={{ fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: moderateScale(10) }}>Overall Health Score</Text>
                <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: o.health_percentage > 80 ? '#10b981' : o.health_percentage > 50 ? '#f59e0b' : '#ef4444', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: responsiveFontSize(28), flexShrink: 1, fontWeight: '900', color: '#0f172a' }}>{o.health_percentage}%</Text>
                </View>
                <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', marginTop: moderateScale(10), fontWeight: '600' }}>{o.sites_with_issues} sites have issues</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                    { label: 'Total Sites', value: o.total_sites, color: '#3b82f6', icon: 'globe' },
                    { label: 'Healthy', value: o.total_healthy, color: '#10b981', icon: 'check-circle' },
                    { label: 'Warning', value: o.total_warning, color: '#f59e0b', icon: 'alert-triangle' },
                    { label: 'Critical', value: o.total_critical, color: '#ef4444', icon: 'alert-octagon' },
                    { label: 'Overloaded', value: o.total_overloaded, color: '#dc2626', icon: 'zap-off' },
                ].map(c => (
                    <View key={c.label} style={{ width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(16), marginBottom: moderateScale(14), elevation: 2, borderLeftWidth: 4, borderLeftColor: c.color }}>
                        <Icon name={c.icon} size={20} color={c.color} style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', color: '#1e293b' }}>{c.value}</Text>
                        <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: 2 }}>{c.label}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}


interface ScreenProps {
    data: any;
    refreshing: boolean;
    onRefresh: () => void;
    searchQuery: string;
}

function BatteryScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const cats = data?.categories || {};

    const sites = useMemo(() => {
        const all = [
            ...(cats.health_critical || []),
            ...(cats.health_needs_replacement || []),
            ...(cats.health_average || []),
            ...(cats.health_good || []),
            ...(cats.health_data_insufficient || []),
        ];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(s => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [cats, searchQuery]);

    const summItems = [
        { label: 'Total', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'Healthy', value: (sum?.health_categories?.good || 0) + (sum?.health_categories?.average || 0), color: '#10b981' },
        { label: 'Insufficient', value: sum?.health_categories?.data_insufficient, color: '#94a3b8' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `bat_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="Battery Health" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.health_status || 'Unknown'}
                    note={item.backup_verification_message}
                    rows={[
                        { label: 'Battery Type', value: item.battery_type || item.Battery_Type },
                        { label: 'Make & Model', value: item.make || item.Battery_Make_and_Type || item.Make_Model_Type },
                        { label: 'Total Capacity', value: item.battery_ah || item.Total_ah ? `${item.battery_ah || item.Total_ah} Ah` : null },
                        { label: 'Bank 1', value: item.Battery_Bank_Capacity_in_AH ? `${item.Battery_Bank_Capacity_in_AH} Ah` : null },
                        { label: 'Bank 2', value: item.Battery_Bank_2_Capacity_in_AH ? `${item.Battery_Bank_2_Capacity_in_AH} Ah` : null },
                        { label: 'Bank 3', value: item.Battery_Bank_3_Capacity_in_AH ? `${item.Battery_Bank_3_Capacity_in_AH} Ah` : null },
                        { label: 'Bank 4', value: item.Battery_Bank_4_Capacity_in_AH ? `${item.Battery_Bank_4_Capacity_in_AH} Ah` : null },
                        { label: 'Configuration', value: item.configuration || item.Number_of_Battery_Banks },
                        { label: 'Parallel', value: item.parallel_config || item.Parallel },
                        { label: 'Rated Voltage', value: item.battery_voltage_v || item.Voltage_V ? `${item.battery_voltage_v || item.Voltage_V} V` : null },
                        { label: 'Current Voltage', value: item.current_voltage != null ? `${item.current_voltage} V` : null, highlight: true },
                        { label: 'Year', value: item.battery_year || item.year },
                        { label: 'Declared Backup', value: item.battery_backup || item.Backup },
                        { label: 'Backup Verification', value: item.backup_verification_status },
                        { label: 'Serial No', value: item.battery_serial_no || item.Battery_Serial_no },
                        { label: 'Model No', value: item.battery_model_no || item.Battery_Model_no },
                        { label: 'Install Date', value: item.installation_date },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No battery data"} />}
        />
    );
}

function DGScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const sites = useMemo(() => {
        const all = data?.categories?.all_sites || [];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter((s: any) => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    const summItems = [
        { label: 'Total Sites', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'High Risk', value: sum?.dg_categories?.dg_high_risk, color: '#ef4444' },
        { label: 'At Risk', value: sum?.dg_categories?.dg_at_risk, color: '#f59e0b' },
        { label: 'Overloaded (>90%)', value: sum?.dg_categories?.dg_loading_above_90, color: '#8b5cf6' },
        { label: 'Healthy', value: sum?.dg_categories?.healthy, color: '#10b981' },
        { label: 'Stopped', value: sum?.dg_categories?.stopped, color: '#64748b' },
        { label: 'Not Installed', value: sum?.dg_categories?.no_dg, color: '#94a3b8' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `dg_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="DG Health" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.status || 'Unknown'}
                    rows={[
                        { label: 'DG Make & Type', value: item.dg_make || item.dg_type_make },
                        { label: 'Model', value: item.dg_model || item.dg_model_no },
                        { label: 'Serial No', value: item.dg_serial_no },
                        { label: 'Capacity (KW)', value: item.rated_capacity_kva || item.dg_rating_kw },
                        { label: 'Controller Type', value: item.dg_controller },
                        { label: 'Software Version', value: item.dg_software },
                        { label: 'Phase', value: item.dg_phase || item.DG_Phase_Available },
                        { label: 'AMF Units', value: item.amf_units || item.Number_of_AMF_Units },
                        { label: 'Install Date', value: item.installation_date },
                        { label: 'Today\'s Hours', value: item.today_dg_hours != null ? `${item.today_dg_hours} h` : null },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No DG data"} />}
        />
    );
}

function RectifierScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const cats = data?.categories || {};

    const sites = useMemo(() => {
        const all = [
            ...(cats.has_faults || []),
            ...(cats.not_n_plus_1 || []),
            ...(cats.insufficient_capacity || []),
            ...(cats.healthy || []),
            ...(cats.no_rectifier || []),
        ];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(s => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [cats, searchQuery]);

    const summItems = [
        { label: 'Total', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'Not N+1', value: sum?.rectifier_categories?.not_n_plus_1, color: '#f59e0b' },
        { label: 'Has Faults', value: sum?.rectifier_categories?.has_faults, color: '#ef4444' },
        { label: 'Not Installed', value: sum?.rectifier_categories?.no_rectifier, color: '#94a3b8' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `rect_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="Rectifier Health" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.status || 'Unknown'}
                    rows={[
                        { label: 'Total Rect', value: item.total_rectifiers },
                        { label: 'Working', value: item.working_rectifiers },
                        { label: 'Faulty', value: item.faulty_rectifiers },
                        { label: 'Capacity (A)', value: item.rectifier_capacity_amp },
                        { label: 'N+1 Status', value: item.is_n_plus_1 === true ? 'Yes' : item.is_n_plus_1 === false ? 'No' : item.is_n_plus_1 },
                        { label: 'Current Load', value: item.current_load != null ? `${item.current_load} A` : null },
                        { label: 'Sufficient Capacity', value: item.sufficient_capacity === true ? 'Yes' : item.sufficient_capacity === false ? 'No' : item.sufficient_capacity },
                        { label: 'Remarks', value: item.remarks },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No rectifier data"} />}
        />
    );
}

function SolarScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const cats = data?.categories || {};

    const sites = useMemo(() => {
        const all = [
            ...(cats.performance_poor || []),
            ...(cats.performance_average || []),
            ...(cats.performance_good || []),
            ...(cats.not_installed || []),
        ];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(s => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [cats, searchQuery]);

    const summItems = [
        { label: 'Total Sites', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'Average', value: sum?.solar_categories?.performance_average, color: '#f59e0b' },
        { label: 'Poor', value: sum?.solar_categories?.performance_poor, color: '#ef4444' },
        { label: 'Not Installed', value: sum?.solar_categories?.not_installed, color: '#94a3b8' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `sol_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="Solar Health" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.performance_status || 'Unknown'}
                    rows={[
                        { label: 'Capacity (KW)', value: item.solar_capacity_kw },
                        { label: 'Panel Count', value: item.panel_count },
                        { label: 'MPPT Count', value: item.mppt_count },
                        { label: 'Faulty MPPT', value: item.faulty_mppt_count },
                        { label: 'Expected CUF', value: item.expected_cuf },
                        { label: 'Actual CUF', value: item.actual_cuf },
                        { label: 'Install Date', value: item.installation_date },
                        { label: 'Last Cleaning', value: item.last_cleaning_date || '-' },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No solar data"} />}
        />
    );
}

function DGBatteryScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const cats = data?.categories || {};

    const sites = useMemo(() => {
        const all = [
            ...(cats.battery_critical || []),
            ...(cats.battery_warning || []),
            ...(cats.battery_good || []),
            ...(cats.battery_missing || []),
        ];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(s => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [cats, searchQuery]);

    const summItems = [
        { label: 'Total', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'Good', value: sum?.dg_battery_categories?.battery_good, color: '#10b981' },
        { label: 'Critical', value: sum?.dg_battery_categories?.battery_critical, color: '#ef4444' },
        { label: 'Missing', value: sum?.dg_battery_categories?.battery_missing, color: '#94a3b8' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `dgb_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="DG Battery Health" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.health_status || 'Unknown'}
                    rows={[
                        { label: 'DG Installed', value: item.dg_installed ? 'Yes' : 'No' },
                        { label: 'Battery Present', value: item.battery_present ? 'Yes' : 'No' },
                        { label: 'Voltage', value: item.battery_voltage != null ? `${item.battery_voltage} V` : '-' },
                        { label: 'Make', value: item.battery_make || item.make },
                        { label: 'Install Date', value: item.installation_date || item.install_date },
                        { label: 'Active Mains Fail', value: item.active_mains_fail ? 'Yes' : 'No' },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No DG battery data"} />}
        />
    );
}

function LightningScreen({ data, refreshing, onRefresh, searchQuery }: ScreenProps) {
    const sum = data?.summary;
    const sites = useMemo(() => {
        const all = data?.categories?.la_needs_check || [];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter((s: any) => 
            (s.global_id || '').toLowerCase().includes(q) || 
            (s.site_id || '').toLowerCase().includes(q) || 
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    const summItems = [
        { label: 'Total', value: sum?.total_sites, color: '#3b82f6' },
        { label: 'Needs Check', value: sum?.la_categories?.la_needs_check, color: '#f59e0b' },
        { label: 'Missing', value: sum?.la_categories?.la_missing, color: '#ef4444' },
        { label: 'Blown', value: sum?.la_categories?.la_blown, color: '#ef4444' },
        { label: 'Functional', value: sum?.la_categories?.la_functional, color: '#10b981' },
    ];

    return (
        <FlatList
            data={sites}
            keyExtractor={(item, i) => `la_${item.site_id || i}`}
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
            ListHeaderComponent={
                <View style={{ marginBottom: verticalScale(14) }}>
                    <SectionHeader label="Lightning Arrester" total={sites.length} />
                    <SummaryRow items={summItems} />
                </View>
            }
            renderItem={({ item }) => (
                <SiteCard
                    site={item}
                    statusField={item.status || 'Needs Check'}
                    rows={[
                        { label: 'LA Present', value: item.la_present },
                        { label: 'Count', value: item.la_count },
                        { label: 'Last Inspection', value: item.last_inspection_date || '-' },
                        { label: 'Days Since Inspection', value: item.days_since_inspection || '-' },
                        { label: 'Remarks', value: item.remarks },
                        { label: 'State', value: item.state_name },
                        { label: 'District', value: item.district_name },
                        { label: 'Cluster', value: item.cluster_name }
                    ]}
                />
            )}
            ListEmptyComponent={<Empty msg={searchQuery ? "No sites match your search" : "No lightning arrester data"} />}
        />
    );
}

function SectionHeader({ label, total }: { label: string; total?: number }) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
            <Text style={{ fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#0f172a' }}>{label}</Text>
            {total != null && (
                <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(3), borderRadius: 8 }}>
                    <Text style={{ fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', color: '#64748b' }}>{total} Sites</Text>
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AssetHealthScreen({ navigation, route }: any) {
    const initialTab = resolveTabKey(route?.params?.tab);

    const [activeTab, setActiveTab] = useState(initialTab);
    const [tabData, setTabData] = useState<Record<string, any>>({});
    const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [searchQuery, setSearchQuery] = useState('');
    const { globalFilters, setGlobalFilters } = useGlobalFilter();
    const [filterVisible, setFilterVisible] = useState(false);

    useEffect(() => {
        const newTab = resolveTabKey(route?.params?.tab);
        if (newTab !== activeTab) {
            setActiveTab(newTab);
            setSearchQuery('');
        }
    }, [route?.params?.tab]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchTab = useCallback(async (tabKey: string, isRefresh = false) => {
        const tab = TABS.find(t => t.key === tabKey);
        if (!tab) return;
        setTabLoading(prev => ({ ...prev, [tabKey]: true }));
        try {
            const fn = (api as any)[tab.api];
            if (typeof fn === 'function') {
                const res = await fn(globalFilters);
                if (res?.status === 'success' || res?.overview || res?.categories || res?.summary) {
                    setTabData(prev => ({ ...prev, [tabKey]: res }));
                }
            }
        } catch (e) {
            console.log(`AssetHealth [${tabKey}] error:`, e);
        } finally {
            setTabLoading(prev => ({ ...prev, [tabKey]: false }));
            if (isRefresh) setRefreshing(false);
        }
    }, [globalFilters]);

    useEffect(() => {
        if (!tabData[activeTab] && !tabLoading[activeTab]) {
            fetchTab(activeTab);
        }
    }, [activeTab]);

    useEffect(() => {
        setTabData({});
        fetchTab(activeTab);
    }, [JSON.stringify(globalFilters)]);

    const onRefresh = () => {
        setRefreshing(true);
        setTabData(prev => ({ ...prev, [activeTab]: null }));
        fetchTab(activeTab, true);
    };

    const isLoading = tabLoading[activeTab];
    const currData = tabData[activeTab];
    const currTab = TABS.find(t => t.key === activeTab)!;

    function renderScreen() {
        if (isLoading && !currData) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(80) }}>
                    <ActivityIndicator size="large" color="#1e3c72" />
                    <Text style={{ marginTop: verticalScale(12), color: '#1e3c72', fontWeight: '600', fontSize: responsiveFontSize(13), flexShrink: 1, }}>
                        Loading {currTab?.label}...
                    </Text>
                </View>
            );
        }

        const props: ScreenProps = { data: currData, refreshing, onRefresh, searchQuery };
        switch (activeTab) {
            case 'overview': return <OverviewScreen {...props} />;
            case 'battery': return <BatteryScreen {...props} />;
            case 'dg': return <DGScreen {...props} />;
            case 'rectifier': return <RectifierScreen {...props} />;
            case 'solar': return <SolarScreen {...props} />;
            case 'dg_battery': return <DGBatteryScreen {...props} />;
            case 'lightning': return <LightningScreen {...props} />;
            default: return null;
        }
    }

    return (
        <SafeAreaView style={MS.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="ASSET HEALTH"
                    subtitle={currTab?.label}
                    leftAction="menu"
                    onLeftPress={() => setSidebarVisible(true)}
                    rightActions={[
                        
                    ]}
                />

                

                <View style={MS.tabBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), gap: 7 }}>
                        {TABS.map(tab => {
                            const active = activeTab === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[MS.tabBtn, active && MS.tabBtnOn]}
                                    onPress={() => {
                                        setActiveTab(tab.key);
                                        setSearchQuery('');
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Icon name={tab.icon} size={12} color={active ? '#1e3c72' : '#64748b'} />
                                    <Text style={[MS.tabTxt, active && MS.tabTxtOn]}>{tab.label}</Text>
                                    {tabLoading[tab.key] && (
                                        <View style={{ width: moderateScale(5), height: verticalScale(5), borderRadius: 3, backgroundColor: '#ef4444', marginLeft: moderateScale(2) }} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Search Bar */}
                <View style={MS.searchContainer}>
                    <Icon name="search" size={16} color="#64748b" style={MS.searchIcon} />
                    <TextInput
                        style={MS.searchInput}
                        placeholder={`Search Global ID or Name...`}
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="x" size={16} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    {renderScreen()}
                </View>

                
                <Sidebar
                    isVisible={isSidebarVisible}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                    fullname={fullname}
                    activeRoute="AssetHealth"
                    handleLogout={async () => {
                        await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                        navigation.replace('Login');
                    }}
                />
            </View>
        </SafeAreaView>
    );
}

const MS = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: moderateScale(11), paddingVertical: verticalScale(7), borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    tabBtnOn: { backgroundColor: '#e8f0fe', borderColor: '#1e3c72' },
    tabTxt: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    tabTxtOn: { color: '#1e3c72' },
    searchContainer: { 
        backgroundColor: '#fff', 
        paddingHorizontal: moderateScale(14), 
        paddingVertical: verticalScale(6), 
        flexDirection: 'row', 
        alignItems: 'center',
        marginHorizontal: moderateScale(14),
        marginVertical: verticalScale(10),
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    searchIcon: { marginRight: moderateScale(10) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', height: verticalScale(38), padding: moderateScale(0), fontWeight: '500' },
});