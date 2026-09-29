/**
 * GridBillingScreen.tsx
 * API: GET /api/grid-analytics/
 * Params: date_from, date_to, site_id, state_id, dist_id, technology
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    Modal, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';

const { width: SW } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (v: any, d = 1) => (parseFloat(v) || 0).toFixed(d);

function todayStr() {
    return new Date().toISOString().split('T')[0];
}
function daysAgoStr(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}

// ─── Mini bar component (replaces Chart.js bars) ─────────────
function TrendBar({ values, labels, colors }: { values: number[]; labels: string[]; colors: string[] }) {
    if (!values.length) return <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>;
    
    return (
        <BarChart
            data={{
                labels: labels.map(l => l.length > 5 ? l.substring(0, 5) + '..' : l),
                datasets: [{ data: values }]
            }}
            width={SW - 60}
            height={200}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(93, 163, 250, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                style: { borderRadius: 16 },
            }}
            verticalLabelRotation={30}
            style={{ marginVertical: verticalScale(8), borderRadius: 16 }}
        />
    );
}

// ─── Mini line chart (SVG-like with View) ────────────────────
function TrendLine({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
    if (!values.length) return <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>;
    
    return (
        <LineChart
            data={{
                labels: labels,
                datasets: [{ data: values }]
            }}
            width={SW - 60}
            height={180}
            chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(93, 163, 250, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: color }
            }}
            bezier
            style={{ marginVertical: verticalScale(8), borderRadius: 16 }}
        />
    );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
    return (
        <View style={[KS.card, { borderTopColor: color }]}>
            <View style={[KS.iconBox, { backgroundColor: `${color}18` }]}>
                <AppIcon name={icon} size={20} color={color} />
            </View>
            <Text style={[KS.val, { color }]}>{value}</Text>
            <Text style={KS.lab}>{label}</Text>
        </View>
    );
}
const KS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14), flex: 1, borderTopWidth: 3, elevation: 2, alignItems: 'center', marginHorizontal: moderateScale(4) },
    iconBox: { width: moderateScale(36), height: verticalScale(36), borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(8) },
    val: { fontSize: responsiveFontSize(22), fontWeight: '800', marginBottom: verticalScale(4) },
    lab: { fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '700', textAlign: 'center' },
});

// ─── Section Card wrapper ─────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={SCS.card}>
            <Text style={SCS.title}>{title}</Text>
            {children}
        </View>
    );
}
const SCS = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    title: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Alert badge ──────────────────────────────────────────────
function AbnCard({ item, type }: { item: any; type: 'spike' | 'offhours' | 'weekly' }) {
    const isSpike = item.direction === 'spike';
    const colorMap = { spike: '#ef4444', offhours: '#8b5cf6', weekly: isSpike ? '#ef4444' : '#3b82f6' };
    const bgMap = { spike: 'rgba(239,68,68,0.06)', offhours: 'rgba(139,92,246,0.06)', weekly: isSpike ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)' };
    const color = colorMap[type];
    const bg = bgMap[type];

    return (
        <View style={[ACS.card, { backgroundColor: bg, borderLeftColor: color }]}>
            <View style={{ flex: 1 }}>
                <Text style={ACS.name}>{item.site_name}</Text>
                <Text style={ACS.id}>{item.global_id || item.site_id}</Text>
                {type === 'spike' && (
                    <Text style={ACS.stats}>Period avg: <Text style={{ fontWeight: '800' }}>{item.period_avg} kWh</Text>  Today: <Text style={{ fontWeight: '800' }}>{item.today_avg} kWh</Text></Text>
                )}
                {type === 'offhours' && (
                    <Text style={ACS.stats}>Off-hours avg: <Text style={{ fontWeight: '800' }}>{item.offhours_avg} kWh</Text>  Records: <Text style={{ fontWeight: '800' }}>{item.records}</Text></Text>
                )}
                {type === 'weekly' && (
                    <Text style={ACS.stats}>This week: <Text style={{ fontWeight: '800' }}>{item.this_week_avg} kWh</Text>  Last: <Text style={{ fontWeight: '800' }}>{item.last_week_avg} kWh</Text></Text>
                )}
            </View>
            <View style={[ACS.badge, { backgroundColor: color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    {type !== 'offhours' && <AppIcon name={isSpike ? 'trending-up' : 'trending-down'} size={10} color="#fff" />}
                    <Text style={ACS.badgeTxt}>
                        {type === 'offhours' ? 'OFF-HRS' : `${Math.abs(item.deviation_pct)}%`}
                    </Text>
                </View>
            </View>
        </View>
    );
}
const ACS = StyleSheet.create({
    card: { borderLeftWidth: 4, borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(8), flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    id: { fontSize: responsiveFontSize(9), color: '#64748b', marginBottom: verticalScale(3) },
    stats: { fontSize: responsiveFontSize(10), color: '#64748b' },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 8 },
    badgeTxt: { fontSize: responsiveFontSize(9), color: '#fff', fontWeight: '800' },
});

// ─── Phase badge ──────────────────────────────────────────────
function PhaseBadge({ count, phase }: { count: number; phase: 'R' | 'Y' | 'B' }) {
    const colors = { R: '#e63946', Y: '#f4a261', B: '#457b9d' };
    if (!count) return <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(11) }}>0</Text>;
    return (
        <View style={{ backgroundColor: colors[phase], borderRadius: 10, paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2) }}>
            <Text style={{ color: '#fff', fontSize: responsiveFontSize(10), fontWeight: '800' }}>{count}</Text>
        </View>
    );
}

// ─── Dropdown Picker ─────────────────────────────────────────
function DropPicker({ label, value, options, onChange, placeholder }: {
    label: string; value: string;
    options: { label: string; value: string }[];
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value);

    return (
        <View style={DP.wrap}>
            <Text style={DP.label}>{label}</Text>
            <TouchableOpacity style={DP.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
                <Text style={[DP.triggerTxt, !selected && { color: '#94a3b8' }]} numberOfLines={1}>
                    {selected ? selected.label : (placeholder || 'All')}
                </Text>
                <AppIcon name="chevron-down" size={12} color="#64748b" />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade">
                <TouchableOpacity style={DP.backdrop} onPress={() => setOpen(false)} activeOpacity={1}>
                    <View style={DP.modal}>
                        <Text style={DP.modalTitle}>{label}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            <TouchableOpacity style={DP.option} onPress={() => { onChange(''); setOpen(false); }}>
                                <Text style={[DP.optTxt, !value && { color: '#3b82f6', fontWeight: '800' }]}>{placeholder || 'All'}</Text>
                            </TouchableOpacity>
                            {options.map(o => (
                                <TouchableOpacity key={o.value} style={DP.option} onPress={() => { onChange(o.value); setOpen(false); }}>
                                    <Text style={[DP.optTxt, value === o.value && { color: '#3b82f6', fontWeight: '800' }]}>{o.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
const DP = StyleSheet.create({
    wrap: { flex: 1 },
    label: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#5da3fa', marginBottom: verticalScale(4), textTransform: 'uppercase', letterSpacing: 0.5 },
    trigger: { backgroundColor: '#f5faff', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), borderWidth: 1.5, borderColor: '#d0e4f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    triggerTxt: { fontSize: responsiveFontSize(11), color: '#1c3d5a', fontWeight: '600', flex: 1, marginRight: moderateScale(4) },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: moderateScale(24) },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), maxHeight: 400 },
    modalTitle: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(12) },
    option: { paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    optTxt: { fontSize: responsiveFontSize(13), color: '#334155' },
});

// ─── OVERVIEW TAB ─────────────────────────────────────────────
function OverviewTab({ data, refreshing, onRefresh }: { data: any, refreshing: boolean, onRefresh: () => void }) {
    if (!data) return null;
    const kpis = data.kpis || {};
    const ov = data.overview || {};
    const vt = ov.voltage_trend || { labels: [], values: [] };
    const tod = ov.tod_consumption || { labels: [], values: [] };
    const tech = data.technology_distribution || { labels: [], values: [] };

    return (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5da3fa']} />}
        >
            {/* KPIs */}
            <View style={{ flexDirection: 'row', marginBottom: verticalScale(14) }}>
                <KpiCard label="AC Uptime" value={`${kpis.ac_uptime || 0}%`} icon="zap" color="#5da3fa" />
                <KpiCard label="Phase Missing" value={String(kpis.phase_missing_incidents || 0)} icon="alert-circle" color="#ef4444" />
                <KpiCard label="Low Voltage Alerts" value={String(kpis.low_voltage_alerts || 0)} icon="eye-off" color="#f59e0b" />
            </View>

            {/* Voltage Trend */}
            <SectionCard title="Avg Voltage Trend (6-hr slots)">
                <TrendLine values={vt.values} labels={vt.labels} color="#5da3fa" />
            </SectionCard>

            {/* TOD Consumption */}
            <SectionCard title="TOD Consumption (kWh avg)">
                <TrendBar
                    values={tod.values}
                    labels={tod.labels}
                    colors={['#5da3fa', '#1c3d5a', '#4dc9f6', '#f4a261']}
                />
            </SectionCard>

            {/* Technology Distribution */}
            {tech.labels.length > 0 && (
                <SectionCard title="Technology Distribution">
                    <TrendBar
                        values={tech.values}
                        labels={tech.labels}
                        colors={['#5da3fa', '#1c3d5a', '#4dc9f6', '#f4a261', '#a9d6e5']}
                    />
                </SectionCard>
            )}
        </ScrollView>
    );
}

// ─── QUALITY TAB ──────────────────────────────────────────────
function QualityTab({ data, searchQuery, refreshing, onRefresh }: { data: any, searchQuery: string, refreshing: boolean, onRefresh: () => void }) {
    if (!data) return null;
    const q = data.quality_of_supply || {};
    const originalSiteData = q.site_data || [];
    const ryb = q.ryb_voltage_trend || { labels: [], r_phase: [], y_phase: [], b_phase: [] };
    const originalAlerts = q.recent_alerts || [];

    const filteredSiteData = useMemo(() => {
        if (!searchQuery) return originalSiteData;
        const query = searchQuery.toLowerCase();
        return originalSiteData.filter((s: any) => 
            (s.global_id || '').toLowerCase().includes(query) || 
            (s.site_id || '').toLowerCase().includes(query) ||
            (s.site_name || '').toLowerCase().includes(query) ||
            (s.imei || '').toLowerCase().includes(query)
        );
    }, [originalSiteData, searchQuery]);

    const filteredAlerts = useMemo(() => {
        if (!searchQuery) return originalAlerts;
        const query = searchQuery.toLowerCase();
        return originalAlerts.filter((a: any) => 
            (a.global_id || '').toLowerCase().includes(query) || 
            (a.site_id || '').toLowerCase().includes(query) ||
            (a.site_name || '').toLowerCase().includes(query) ||
            (a.imei || '').toLowerCase().includes(query)
        );
    }, [originalAlerts, searchQuery]);

    return (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5da3fa']} />}
        >

            {/* R-Y-B Voltage Trend */}
            <SectionCard title="R-Y-B Phase Voltage Trend">
                {ryb.labels.length > 0 ? (
                    <View>
                        {['R Phase', 'Y Phase', 'B Phase'].map((label, idx) => {
                            const vals = [ryb.r_phase, ryb.y_phase, ryb.b_phase][idx];
                            const colors = ['#e63946', '#f4a261', '#457b9d'];
                            return (
                                <View key={label} style={{ marginBottom: verticalScale(10) }}>
                                    <Text style={{ fontSize: responsiveFontSize(10), fontWeight: '700', color: colors[idx], marginBottom: verticalScale(4) }}>{label}</Text>
                                    <TrendLine values={vals || []} labels={ryb.labels} color={colors[idx]} />
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={{ color: '#94a3b8', textAlign: 'center', padding: moderateScale(20) }}>No voltage data</Text>
                )}
            </SectionCard>

            {/* Phase Missing Table */}
            <SectionCard title={`Sites with Phase Missing (${filteredSiteData.length})`}>
                {filteredSiteData.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: moderateScale(20) }}>
                        <AppIcon name="search" size={24} color="#cbd5e1" />
                        <Text style={{ color: '#94a3b8', fontWeight: '700', marginTop: verticalScale(6) }}>No matches found</Text>
                    </View>
                ) : (
                    filteredSiteData.map((s: any, i: number) => (
                        <View key={i} style={QTS.row}>
                            <View style={{ flex: 1.5 }}>
                                <Text style={QTS.siteName} numberOfLines={1}>{s.site_name}</Text>
                                <Text style={QTS.siteId}>{s.global_id || s.site_id}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
                                <PhaseBadge count={s.r_phase_missing} phase="R" />
                                <PhaseBadge count={s.y_phase_missing} phase="Y" />
                                <PhaseBadge count={s.b_phase_missing} phase="B" />
                            </View>
                            <Text style={[QTS.uptime, { color: parseFloat(s.ac_uptime) > 80 ? '#10b981' : '#ef4444' }]}>
                                {s.ac_uptime}
                            </Text>
                        </View>
                    ))
                )}
            </SectionCard>

            {/* Recent Alerts */}
            <SectionCard title="Recent Phase Missing Alerts">
                {filteredAlerts.length === 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppIcon name="search" size={16} color="#cbd5e1" />
                        <Text style={{ color: '#94a3b8', fontWeight: '600' }}>No matches found</Text>
                    </View>
                ) : (
                    filteredAlerts.map((a: any, i: number) => (
                        <View key={i} style={QTS.alertRow}>
                            <AppIcon name="alert-circle" size={14} color="#ef4444" />
                            <View style={{ flex: 1 }}>
                                <Text style={QTS.alertSite}>{a.global_id || a.site_id} — {a.site_name}</Text>
                                <Text style={{ fontSize: responsiveFontSize(10), color: '#ef4444', fontWeight: '600' }}>{a.alert_type}</Text>
                                {a.timestamp && (
                                    <Text style={{ fontSize: responsiveFontSize(9), color: '#94a3b8' }}>{new Date(a.timestamp).toLocaleString()}</Text>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </SectionCard>
        </ScrollView>
    );
}
const QTS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(10), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    siteName: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#0f172a' },
    siteId: { fontSize: responsiveFontSize(9), color: '#64748b', marginTop: verticalScale(2) },
    uptime: { fontSize: responsiveFontSize(11), fontWeight: '800', minWidth: 45, textAlign: 'right' },
    alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    alertSite: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#0f172a' },
});

// ─── TOD TAB ──────────────────────────────────────────────────
function TODTab({ data, searchQuery, refreshing, onRefresh }: { data: any, searchQuery: string, refreshing: boolean, onRefresh: () => void }) {
    const [abnTab, setAbnTab] = useState<'spike' | 'offhours' | 'weekly'>('spike');
    if (!data) return null;

    const tod = data.tod_monitoring || {};
    const abn = tod.abnormal_alerts || {};
    const slots = tod.time_slots || [];
    const bySite = tod.consumption_by_site || {};
    
    const filteredBySiteKeys = useMemo(() => {
        const keys = Object.keys(bySite);
        if (!searchQuery) return keys.slice(0, 5);
        const query = searchQuery.toLowerCase();
        return keys.filter(k => k.toLowerCase().includes(query)).slice(0, 10);
    }, [bySite, searchQuery]);

    const filterAbn = (alerts: any[]) => {
        if (!searchQuery) return alerts || [];
        const query = searchQuery.toLowerCase();
        return (alerts || []).filter(a => 
            (a.global_id || '').toLowerCase().includes(query) ||
            (a.site_id || '').toLowerCase().includes(query) ||
            (a.site_name || '').toLowerCase().includes(query) ||
            (a.imei || '').toLowerCase().includes(query)
        );
    };

    const spikedFiltered = filterAbn(abn.spike_alerts);
    const offhoursFiltered = filterAbn(abn.offhours_alerts);
    const weeklyFiltered = filterAbn(abn.weekly_alerts);

    return (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5da3fa']} />}
        >

            {/* TOD by site */}
            {filteredBySiteKeys.length > 0 && (
                <SectionCard title="TOD Consumption by Site (kWh)">
                    {filteredBySiteKeys.map((name, idx) => {
                        const vals = slots.map((sl: string) => bySite[name]?.[sl] || 0);
                        const colors = ['#5da3fa', '#1c3d5a', '#4dc9f6', '#f4a261', '#a9d6e5'];
                        return (
                            <View key={name} style={{ marginBottom: verticalScale(12) }}>
                                <Text style={{ fontSize: responsiveFontSize(10), fontWeight: '700', color: colors[idx % colors.length], marginBottom: verticalScale(4) }}>{name}</Text>
                                <TrendBar values={vals} labels={slots} colors={[colors[idx % colors.length]]} />
                            </View>
                        );
                    })}
                </SectionCard>
            )}

            {/* Abnormal Alerts */}
            <View style={TODS.abnWrap}>
                <Text style={TODS.abnTitle}>Abnormal Consumption Alerts</Text>
                <Text style={TODS.abnSub}>3 independent detection methods</Text>

                {/* Tab buttons */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(12) }}>
                    {[
                        { key: 'spike', label: 'Period Spike/Drop' },
                        { key: 'offhours', label: 'Off-Hours (00-06 & 18-24)' },
                        { key: 'weekly', label: 'Weekly Deviation' },
                    ].map(t => (
                        <TouchableOpacity
                            key={t.key}
                            style={[TODS.tab, abnTab === t.key && TODS.tabActive]}
                            onPress={() => setAbnTab(t.key as any)}
                        >
                            <Text style={[TODS.tabTxt, abnTab === t.key && TODS.tabTxtActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Spike/Drop */}
                {abnTab === 'spike' && (
                    spikedFiltered.length ? spikedFiltered.map((a: any, i: number) => (
                        <AbnCard key={i} item={a} type="spike" />
                    )) : <Text style={TODS.noData}>No results found</Text>
                )}

                {/* Off-hours */}
                {abnTab === 'offhours' && (
                    offhoursFiltered.length ? offhoursFiltered.map((a: any, i: number) => (
                        <AbnCard key={i} item={a} type="offhours" />
                    )) : <Text style={TODS.noData}>No results found</Text>
                )}

                {/* Weekly */}
                {abnTab === 'weekly' && (
                    weeklyFiltered.length ? weeklyFiltered.map((a: any, i: number) => (
                        <AbnCard key={i} item={a} type="weekly" />
                    )) : <Text style={TODS.noData}>No results found</Text>
                )}
            </View>
        </ScrollView>
    );
}
const TODS = StyleSheet.create({
    abnWrap: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2 },
    abnTitle: { fontSize: responsiveFontSize(14), fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(4) },
    abnSub: { fontSize: responsiveFontSize(10), color: '#94a3b8', marginBottom: verticalScale(12) },
    tab: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: moderateScale(8), borderWidth: 2, borderColor: '#5da3fa' },
    tabActive: { backgroundColor: '#5da3fa' },
    tabTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#5da3fa' },
    tabTxtActive: { color: '#fff' },
    noData: { fontSize: responsiveFontSize(12), color: '#94a3b8', fontWeight: '600', padding: moderateScale(16), textAlign: 'center' },
});

// ─── FILTER DRAWER ────────────────────────────────────────────
function FilterDrawer({ visible, onClose, onApply, states, districts, sites, filters, setFilters, onStateChange }: any) {
    const [showFrom, setShowFrom] = useState(false);
    const [showTo, setShowTo] = useState(false);
    const techOptions = [
        { label: '4G / LTE', value: '4G' },
        { label: '5G', value: '5G' },
        { label: '3G', value: '3G' },
        { label: '2G', value: '2G' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={FDS.overlay}>
                <View style={FDS.drawer}>
                    <View style={FDS.header}>
                        <Text style={FDS.headerTitle}>Filters</Text>
                        <TouchableOpacity onPress={onClose}>
                            <AppIcon name="x" size={22} color="#1e293b" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: verticalScale(20) }}>
                        {/* Date From */}
                        <Text style={FDS.label}>DATE FROM</Text>
                        <TouchableOpacity style={FDS.input} onPress={() => setShowFrom(true)}>
                            <Text style={{ color: filters.date_from ? '#1e293b' : '#94a3b8' }}>{filters.date_from || 'YYYY-MM-DD'}</Text>
                        </TouchableOpacity>

                        {/* Date To */}
                        <Text style={FDS.label}>DATE TO</Text>
                        <TouchableOpacity style={FDS.input} onPress={() => setShowTo(true)}>
                            <Text style={{ color: filters.date_to ? '#1e293b' : '#94a3b8' }}>{filters.date_to || 'YYYY-MM-DD'}</Text>
                        </TouchableOpacity>

                        {showFrom && (
                            <DateTimePicker
                                value={filters.date_from ? new Date(filters.date_from) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowFrom(false);
                                    if (d) setFilters((f: any) => ({ ...f, date_from: d.toISOString().split('T')[0] }));
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
                                    if (d) setFilters((f: any) => ({ ...f, date_to: d.toISOString().split('T')[0] }));
                                }}
                            />
                        )}

                        {/* State */}
                        <View style={{ marginBottom: verticalScale(12) }}>
                            <DropPicker
                                label="STATE / CIRCLE"
                                value={filters.state_id}
                                options={states.map((s: any) => ({ label: s.state_name, value: String(s.state_id) }))}
                                onChange={v => { setFilters((f: any) => ({ ...f, state_id: v, dist_id: '' })); onStateChange(v); }}
                                placeholder="All States"
                            />
                        </View>

                        {/* District */}
                        <View style={{ marginBottom: verticalScale(12) }}>
                            <DropPicker
                                label="DISTRICT"
                                value={filters.dist_id}
                                options={districts.map((d: any) => ({ label: d.district_name, value: String(d.dist_id) }))}
                                onChange={v => setFilters((f: any) => ({ ...f, dist_id: v }))}
                                placeholder="All Districts"
                            />
                        </View>

                        {/* Site */}
                        <View style={{ marginBottom: verticalScale(12) }}>
                            <DropPicker
                                label="SITE"
                                value={filters.site_id}
                                options={sites.map((s: any) => ({ label: `${s.site_name} (${s.global_id || s.site_id})`, value: s.site_id }))}
                                onChange={v => setFilters((f: any) => ({ ...f, site_id: v }))}
                                placeholder="All Sites"
                            />
                        </View>

                        {/* Technology */}
                        <View style={{ marginBottom: verticalScale(16) }}>
                            <DropPicker
                                label="TECHNOLOGY"
                                value={filters.technology}
                                options={techOptions}
                                onChange={v => setFilters((f: any) => ({ ...f, technology: v }))}
                                placeholder="All"
                            />
                        </View>

                        {/* Buttons */}
                        <TouchableOpacity style={FDS.applyBtn} onPress={() => { onApply(); onClose(); }} activeOpacity={0.8}>
                            <AppIcon name="filter" size={14} color="#fff" />
                            <Text style={FDS.applyBtnTxt}>Apply Filters</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={FDS.resetBtn} onPress={() => {
                            setFilters({ date_from: daysAgoStr(30), date_to: todayStr(), state_id: '', dist_id: '', site_id: '', technology: '' });
                        }}>
                            <Text style={FDS.resetBtnTxt}>Reset</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
const FDS = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    drawer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: moderateScale(20), maxHeight: '85%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(20) },
    headerTitle: { fontSize: responsiveFontSize(16), fontWeight: '800', color: '#0f172a' },
    label: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#5da3fa', marginBottom: verticalScale(4), textTransform: 'uppercase', letterSpacing: 0.5, marginTop: verticalScale(10) },
    input: { backgroundColor: '#f5faff', borderRadius: 8, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), fontSize: responsiveFontSize(12), color: '#1c3d5a', fontWeight: '600', borderWidth: 1.5, borderColor: '#d0e4f7', marginBottom: verticalScale(4) },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5da3fa', borderRadius: 12, paddingVertical: verticalScale(14), marginBottom: verticalScale(10) },
    applyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14) },
    resetBtn: { alignItems: 'center', paddingVertical: verticalScale(10) },
    resetBtnTxt: { color: '#5da3fa', fontWeight: '700', fontSize: responsiveFontSize(13) },
});

// ─── MAIN COMPONENT ───────────────────────────────────────────
const TABS = ['Overview', 'Quality', 'TOD'] as const;
type TabType = typeof TABS[number];

export default function GridBillingScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<TabType>('Overview');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [exporting, setExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Filter state
    const [filters, setFilters] = useState({
        date_from: daysAgoStr(30),
        date_to: daysAgoStr(1),
        state_id: '',
        dist_id: '',
        site_id: '',
        technology: '',
    });

    // Dropdown options from API response
    const [states, setStates] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [sites, setSites] = useState<any[]>([]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
        fetchData();
    }, []);

    const fetchData = useCallback(async (isRefresh = false, customFilters?: any) => {
        if (!isRefresh) setLoading(true);
        setErrorMsg(null);
        const params = customFilters || filters;
        try {
            console.log('[GridBilling] Fetching with params:', params);
            const res = await (api as any).getGridAnalytics(params);
            console.log('[GridBilling] Response received:', res ? 'Data found' : 'Empty');
            
            if (res && (res.status === 'success' || res.overview)) {
                setData(res);
                if (res.states_list) setStates(res.states_list);
                if (res.districts_list) setDistricts(res.districts_list);
                if (res.sites_list) setSites(res.sites_list);
            } else if (res && res.status === 'error') {
                setErrorMsg(res.message || 'Server reported an error');
            } else {
                setErrorMsg('Invalid data format received from server');
            }
        } catch (e: any) {
            console.log('GridBilling fetch error:', e);
            let msg = e.message || 'Failed to connect to server';
            if (msg.toLowerCase().includes('network error')) {
                msg = 'Network Error: The data might be too large for this range, or your connection is unstable. Try a shorter date range (e.g., 7 days).';
            } else if (msg.toLowerCase().includes('timeout')) {
                msg = 'Request Timed Out: The server is taking too long. Please try a smaller date range.';
            }
            setErrorMsg(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters]);

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    const onApplyFilters = () => { setData(null); fetchData(false); };

    // When state changes, fetch districts (reuse API with state filter)
    const onStateChange = async (stateId: string) => {
        if (!stateId) { setDistricts([]); return; }
        try {
            const res = await (api as any).getGridAnalytics({
                date_from: daysAgoStr(1), date_to: todayStr(), state_id: stateId
            });
            if (res?.districts_list) setDistricts(res.districts_list);
        } catch (e) { }
    };
    
    const handleExport = async () => {
        if (!data) return Alert.alert('No data', 'Nothing to export.');
        setExporting(true);
        try {
            const header = 'GLOBAL ID,SITE ID,SITE NAME,AC UPTIME,R-PHASE MISSING,Y-PHASE MISSING,B-PHASE MISSING,LOW VOLTAGE';
            const siteRows = (data.quality_of_supply?.site_data || []).map((s: any) => [
                `"${s.global_id || ''}"`,
                `"${s.site_id || ''}"`,
                `"${s.site_name || ''}"`,
                `"${s.ac_uptime || ''}"`,
                `"${s.r_phase_missing || 0}"`,
                `"${s.y_phase_missing || 0}"`,
                `"${s.b_phase_missing || 0}"`,
                `"${s.low_voltage_count || 0}"`,
            ].join(','));
            
            const csvContent = [
                `"GRID POWER ANALYTICS REPORT (${filters.date_from} to ${filters.date_to})"`,
                '',
                header,
                ...siteRows
            ].join('\n');
            
            const fileName = `Grid_Analytics_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvContent, 'utf8');
            await RNShare.open({ url: `file://${filePath}`, type: 'text/csv' });
        } catch (err) {
            console.log('Grid export error:', err);
        } finally {
            setExporting(false);
        }
    };

    const filterSummary = [
        filters.date_from && filters.date_to ? `${filters.date_from} - ${filters.date_to}` : null,
        filters.technology ? `Tech: ${filters.technology}` : null,
        filters.site_id ? `Site: ${filters.site_id}` : null,
    ].filter(Boolean).join('  ·  ');

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="GRID POWER ANALYTICS"
                subtitle={filterSummary || undefined}
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                    { icon: 'sliders', onPress: () => setFilterVisible(true) },
                ]}
            />

            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                        onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {(activeTab === 'Quality' || activeTab === 'TOD') && (
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

            {loading ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#5da3fa" />
                    <Text style={styles.loaderTxt}>Loading grid analytics...</Text>
                </View>
            ) : errorMsg ? (
                <View style={styles.emptyBox}>
                    <AppIcon name="alert-triangle" size={40} color="#ef4444" />
                    <Text style={[styles.emptyTxtMain, { color: '#ef4444' }]}>Error Loading Data</Text>
                    <Text style={styles.emptyTxtSub}>{errorMsg}</Text>
                    <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#ef4444' }]} onPress={() => fetchData()}>
                        <Text style={styles.retryTxt}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : !data ? (
                <View style={styles.emptyBox}>
                    <AppIcon name="database" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTxtMain}>No Analytics Data</Text>
                    <Text style={styles.emptyTxtSub}>We couldn't find any data for the selected filters. Try adjusting your dates or filters.</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
                        <Text style={styles.retryTxt}>Refresh Data</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1, backgroundColor: '#edf2fb' }}>
                    {activeTab === 'Overview' && (
                        <OverviewTab data={data} refreshing={refreshing} onRefresh={onRefresh} />
                    )}
                    {activeTab === 'Quality' && (
                        <QualityTab data={data} searchQuery={searchQuery} refreshing={refreshing} onRefresh={onRefresh} />
                    )}
                    {activeTab === 'TOD' && (
                        <TODTab data={data} searchQuery={searchQuery} refreshing={refreshing} onRefresh={onRefresh} />
                    )}
                </View>
            )}

            <FilterDrawer
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={onApplyFilters}
                states={states}
                districts={districts}
                sites={sites}
                filters={filters}
                setFilters={setFilters}
                onStateChange={onStateChange}
            />

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="GridBilling"
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
    loaderTxt: { marginTop: verticalScale(12), color: '#5da3fa', fontWeight: '600', fontSize: responsiveFontSize(13) },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(12) },
    tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#5da3fa' },
    tabTxt: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#64748b' },
    tabTxtActive: { color: '#5da3fa' },

    searchContainer: { 
        backgroundColor: '#fff', 
        paddingHorizontal: moderateScale(14), 
        paddingVertical: verticalScale(6), 
        flexDirection: 'row', 
        alignItems: 'center',
        marginHorizontal: moderateScale(16),
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

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(40), backgroundColor: '#edf2fb' },
    emptyTxtMain: { fontSize: responsiveFontSize(18), fontWeight: '800', color: '#1e293b', marginTop: verticalScale(12) },
    emptyTxtSub: { fontSize: responsiveFontSize(13), color: '#64748b', textAlign: 'center', marginTop: verticalScale(8), lineHeight: 20 },
    retryBtn: { marginTop: verticalScale(20), backgroundColor: '#5da3fa', paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(10), borderRadius: 10 },
    retryTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14) },
});