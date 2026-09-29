
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    FlatList, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// TAB CONFIG  (key must match resolveTabKey mapping below)
// ─────────────────────────────────────────────────────────────
const TABS = [
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
    val: { fontSize: responsiveFontSize(22), fontWeight: '800' },
    lab: { fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '700', marginTop: verticalScale(2), textAlign: 'center' },
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
                        Global ID: {site.global_id || site.site_id || '—'}{site.state_name ? `  ·  ${site.state_name}` : ''}
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
                    {rows.filter(r => r.value !== undefined && r.value !== null && r.value !== '—' && String(r.value).trim() !== '').map(r => (
                        <View key={r.label} style={SC.row}>
                            <Text style={SC.rowL}>{r.label}</Text>
                            <Text style={[SC.rowV, r.highlight && { color: statusColor(String(r.value)), fontWeight: '800' }]}>
                                {String(r.value)}
                            </Text>
                        </View>
                    ))}
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
    name: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    sub: { fontSize: responsiveFontSize(10), color: '#64748b' },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    badgeTxt: { fontSize: responsiveFontSize(8), fontWeight: '800', letterSpacing: 0.4 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(10) },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: verticalScale(5), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    rowL: { fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '600' },
    rowV: { fontSize: responsiveFontSize(11), color: '#1e293b', fontWeight: '700', maxWidth: '58%', textAlign: 'right' },
    noteBox: { marginTop: verticalScale(10), padding: moderateScale(10), borderRadius: 10 },
    noteTxt: { fontSize: responsiveFontSize(11), fontWeight: '600', lineHeight: 16 },
});

function Empty({ msg }: { msg: string }) {
    return (
        <View style={{ alignItems: 'center', paddingTop: verticalScale(60) }}>
            <Icon name="search" size={38} color="#cbd5e1" />
            <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(13), marginTop: verticalScale(12), fontWeight: '500' }}>{msg}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────

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
        { label: 'Good', value: sum?.health_categories?.good, color: '#10b981' },
        { label: 'Average', value: sum?.health_categories?.average, color: '#f59e0b' },
        { label: 'Needs Repl.', value: sum?.health_categories?.needs_replacement, color: '#ef4444' },
        { label: 'Critical', value: sum?.health_categories?.critical, color: '#dc2626' },
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
                        { label: 'Health Status', value: item.health_status },
                        { label: 'Voltage', value: item.current_voltage != null ? `${item.current_voltage} V` : null },
                        { label: 'Current', value: item.current_current != null ? `${item.current_current} A` : null },
                        { label: 'Capacity', value: item.battery_ah ? `${item.battery_ah} Ah` : null },
                        { label: 'Configuration', value: item.configuration },
                        { label: 'Battery Type', value: item.battery_type },
                        { label: 'Make', value: item.make },
                        { label: 'Declared Backup', value: item.battery_backup },
                        { label: 'Backup Verify', value: item.backup_verification_status, highlight: true },
                        { label: 'Longest Session', value: item.longest_session_minutes != null ? `${item.longest_session_minutes} min` : null },
                        { label: 'Avg Session', value: item.avg_session_minutes != null ? `${item.avg_session_minutes} min` : null },
                        { label: 'Sessions (30d)', value: item.total_sessions_analyzed },
                        { label: 'Serial No.', value: item.battery_serial_no },
                        { label: 'Model No.', value: item.battery_model_no },
                        { label: 'Voltage Rating', value: item.battery_voltage_v },
                        { label: 'Parallel Config', value: item.parallel_config },
                        { label: 'Year', value: item.battery_year },
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
        { label: 'Has DG', value: sum?.total_dg_sites, color: '#3b82f6' },
        { label: 'High Risk', value: sum?.dg_categories?.dg_high_risk, color: '#ef4444' },
        { label: 'At Risk', value: sum?.dg_categories?.dg_at_risk, color: '#f59e0b' },
        { label: '>90% Load', value: sum?.dg_categories?.dg_loading_above_90, color: '#8b5cf6' },
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
                        { label: 'Status', value: item.status },
                        { label: 'Today DG Hours', value: item.today_dg_hours != null ? `${item.today_dg_hours} h` : null },
                        { label: 'Loading %', value: item.loading_percent != null ? `${item.loading_percent}%` : null, highlight: true },
                        { label: 'Make', value: item.dg_make },
                        { label: 'Model', value: item.dg_model },
                        { label: 'Capacity (KVA)', value: item.rated_capacity_kva },
                        { label: 'Phase', value: item.dg_phase },
                        { label: 'Controller', value: item.dg_controller },
                        { label: 'Software', value: item.dg_software },
                        { label: 'Serial No.', value: item.dg_serial_no },
                        { label: 'AMF Units', value: item.amf_units },
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
        { label: 'Healthy', value: sum?.rectifier_categories?.healthy, color: '#10b981' },
        { label: 'Not N+1', value: sum?.rectifier_categories?.not_n_plus_1, color: '#f59e0b' },
        { label: 'Has Faults', value: sum?.rectifier_categories?.has_faults, color: '#ef4444' },
        { label: 'Insufficient', value: sum?.rectifier_categories?.insufficient_capacity, color: '#f59e0b' },
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
                        { label: 'Status', value: item.status },
                        { label: 'N+1 Ready', value: item.is_n_plus_1 === true ? 'Yes' : item.is_n_plus_1 === false ? 'No' : null, highlight: true },
                        { label: 'Sufficient Cap.', value: item.sufficient_capacity === true ? 'Yes' : item.sufficient_capacity === false ? 'No' : null },
                        { label: 'Current Load', value: item.current_load != null ? `${item.current_load} A` : null },
                        { label: 'Capacity', value: item.rectifier_capacity_amp },
                        { label: 'Total Units', value: item.total_rectifiers },
                        { label: 'Working Units', value: item.working_rectifiers },
                        { label: 'Faulty Units', value: item.faulty_rectifiers },
                        { label: 'Remarks', value: item.remarks },
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
        { label: 'Solar Sites', value: sum?.total_solar_sites, color: '#3b82f6' },
        { label: 'Good', value: sum?.solar_categories?.performance_good, color: '#10b981' },
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
                        { label: 'Performance', value: item.performance_status, highlight: true },
                        { label: 'Actual CUF', value: item.actual_cuf != null ? `${item.actual_cuf}%` : null },
                        { label: 'Expected CUF', value: item.expected_cuf != null ? `${item.expected_cuf}%` : null },
                        { label: 'Capacity (kW)', value: item.solar_capacity_kw },
                        { label: 'Panel Count', value: item.panel_count },
                        { label: 'MPPT Count', value: item.mppt_count },
                        { label: 'Faulty MPPT', value: item.faulty_mppt_count != null ? String(item.faulty_mppt_count) : null },
                        { label: 'State', value: item.state_name },
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
        { label: 'Warning', value: sum?.dg_battery_categories?.battery_warning, color: '#f59e0b' },
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
                        { label: 'Health Status', value: item.health_status, highlight: true },
                        { label: 'Voltage', value: item.battery_voltage != null ? `${item.battery_voltage} V` : null },
                        { label: 'DG Installed', value: item.dg_installed === true ? 'Yes' : item.dg_installed === false ? 'No' : null },
                        { label: 'Battery Present', value: item.battery_present === true ? 'Yes' : item.battery_present === false ? 'No' : null },
                        { label: 'Make', value: item.battery_make },
                        { label: 'Last Checked', value: item.last_checked },
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
        { label: 'Overdue', value: sum?.la_categories?.inspection_overdue, color: '#8b5cf6' },
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
                        { label: 'Status', value: item.status },
                        { label: 'LA Present', value: item.la_present },
                        { label: 'LA Count', value: item.la_count },
                        { label: 'Last Inspection', value: item.last_inspection_date || 'Never' },
                        { label: 'Days Since', value: item.days_since_inspection != null ? `${item.days_since_inspection} days` : null },
                        { label: 'Remarks', value: item.remarks },
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
            <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a' }}>{label}</Text>
            {total != null && (
                <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(3), borderRadius: 8 }}>
                    <Text style={{ fontSize: responsiveFontSize(10), fontWeight: '700', color: '#64748b' }}>{total} Sites</Text>
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
                const res = await fn();
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
    }, []);

    useEffect(() => {
        if (!tabData[activeTab] && !tabLoading[activeTab]) {
            fetchTab(activeTab);
        }
    }, [activeTab]);

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
                    <Text style={{ marginTop: verticalScale(12), color: '#1e3c72', fontWeight: '600', fontSize: responsiveFontSize(13) }}>
                        Loading {currTab?.label}...
                    </Text>
                </View>
            );
        }

        const props: ScreenProps = { data: currData, refreshing, onRefresh, searchQuery };
        switch (activeTab) {
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
    tabTxt: { fontSize: responsiveFontSize(10), fontWeight: '700', color: '#64748b' },
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
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), color: '#1e293b', height: verticalScale(38), padding: moderateScale(0), fontWeight: '500' },
});