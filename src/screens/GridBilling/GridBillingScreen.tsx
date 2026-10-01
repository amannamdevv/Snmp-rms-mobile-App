/**
 * GridBillingScreen.tsx
 * API: GET /api/grid-analytics/
 * Params: date_from, date_to, site_id, state_id, dist_id, technology
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
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
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';

let SW = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SW = _d.width; } catch(_) {}

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
            showValuesOnTopOfBars={true}
            fromZero={true}
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
    const [tooltipPos, setTooltipPos] = useState<{x: number, y: number, value: any, label: string} | null>(null);
    if (!values.length) return <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>;
    
    return (
        <View style={{ position: 'relative' }}>
            <LineChart
                data={{
                    labels: labels,
                    datasets: [{ data: values }]
                }}
                width={SW - 60}
                height={180}
                onDataPointClick={({ value, index, x, y }) => {
                    let posX = x;
                    if (posX < 40) posX = 40;
                    if (posX > SW - 100) posX = SW - 100;
                    setTooltipPos({ x: posX, y, value, label: labels[index] });
                    setTimeout(() => setTooltipPos(curr => curr?.x === posX ? null : curr), 3000);
                }}
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
            {tooltipPos && (
                <View style={{
                    position: 'absolute',
                    left: tooltipPos.x - 30,
                    top: tooltipPos.y - 45,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    alignItems: 'center',
                    pointerEvents: 'none',
                    elevation: 5
                }}>
                    <Text style={{ color: '#fff', fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800' }}>{tooltipPos.value}</Text>
                    <Text style={{ color: '#cbd5e1', fontSize: responsiveFontSize(10), flexShrink: 1, }}>{tooltipPos.label}</Text>
                    <View style={{
                        position: 'absolute', bottom: -4, width: 0, height: 0,
                        borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
                        borderLeftColor: 'transparent', borderRightColor: 'transparent',
                        borderTopColor: 'rgba(15, 23, 42, 0.85)'
                    }} />
                </View>
            )}
        </View>
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
    val: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(4) },
    lab: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '700', textAlign: 'center' },
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
    title: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
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
    card: { borderLeftWidth: 4, borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(8), flexDirection: 'row', alignItems: 'center', gap: moderateScale(10) },
    name: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    id: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', marginBottom: verticalScale(3) },
    stats: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 8 },
    badgeTxt: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#fff', fontWeight: '800' },
});

// ─── Phase badge ──────────────────────────────────────────────
function PhaseBadge({ count, phase }: { count: number; phase: 'R' | 'Y' | 'B' }) {
    const colors = { R: '#ef4444', Y: '#facc15', B: '#3b82f6' };
    if (!count) return <Text style={{ color: '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, }}>0</Text>;
    return (
        <View style={{ backgroundColor: colors[phase], borderRadius: 10, paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2) }}>
            <Text style={{ color: '#fff', fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800' }}>{count}</Text>
        </View>
    );
}

// ─── Phase Missing Grouped Bar Chart ──────────────────────────
function PhaseMissingBarChart({ siteData }: { siteData: any[] }) {
    const [tooltip, setTooltip] = useState<any>(null);
    if (!siteData || siteData.length === 0) return <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>;
    
    // Sort by most missing to least, take top 10 to avoid crowding
    const sortedData = [...siteData].sort((a, b) => 
        ((b.r_phase_missing || 0) + (b.y_phase_missing || 0) + (b.b_phase_missing || 0)) - 
        ((a.r_phase_missing || 0) + (a.y_phase_missing || 0) + (a.b_phase_missing || 0))
    ).slice(0, 10);

    const maxVal = Math.max(...sortedData.flatMap(s => [s.r_phase_missing || 0, s.y_phase_missing || 0, s.b_phase_missing || 0]));
    const chartHeight = 150;
    
    const availableWidth = SW - 60;
    const isScrollable = sortedData.length > 4;
    const groupWidth = isScrollable ? 80 : availableWidth / (sortedData.length || 1);
    const barWidth = isScrollable ? 14 : (groupWidth - 20) / 3;

    return (
        <View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: moderateScale(15), marginBottom: moderateScale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 12, height: 12, backgroundColor: '#ef4444', borderRadius: 2, marginRight: 4 }} /><Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: 'bold' }}>R Phase</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 12, height: 12, backgroundColor: '#facc15', borderRadius: 2, marginRight: 4 }} /><Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: 'bold' }}>Y Phase</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 12, height: 12, backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 4 }} /><Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: 'bold' }}>B Phase</Text></View>
            </View>
            <ScrollView horizontal={isScrollable} showsHorizontalScrollIndicator={false} style={{ marginVertical: moderateScale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: moderateScale(10), paddingTop: moderateScale(50), paddingHorizontal: isScrollable ? 10 : 0, width: isScrollable ? 'auto' : availableWidth }}>
                    {sortedData.map((s, idx) => {
                        const r = s.r_phase_missing || 0;
                        const y = s.y_phase_missing || 0;
                        const b = s.b_phase_missing || 0;
                        const rHeight = maxVal > 0 ? (r / maxVal) * chartHeight : 0;
                        const yHeight = maxVal > 0 ? (y / maxVal) * chartHeight : 0;
                        const bHeight = maxVal > 0 ? (b / maxVal) * chartHeight : 0;
                        const label = s.global_id || s.site_id || `Site ${idx+1}`;

                        return (
                            <View key={idx} style={{ alignItems: 'center', width: groupWidth, position: 'relative' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, justifyContent: 'center' }}>
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => { setTooltip({ idx, label, phase: 'R', val: r }); setTimeout(() => setTooltip(null), 3000); }}
                                        style={{ width: barWidth, height: rHeight, backgroundColor: '#ef4444', marginRight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} 
                                    />
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => { setTooltip({ idx, label, phase: 'Y', val: y }); setTimeout(() => setTooltip(null), 3000); }}
                                        style={{ width: barWidth, height: yHeight, backgroundColor: '#facc15', marginRight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} 
                                    />
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => { setTooltip({ idx, label, phase: 'B', val: b }); setTimeout(() => setTooltip(null), 3000); }}
                                        style={{ width: barWidth, height: bHeight, backgroundColor: '#3b82f6', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} 
                                    />
                                </View>
                                <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', marginTop: 8, textAlign: 'center', fontWeight: '600' }} numberOfLines={1}>{label.substring(0, 10)}</Text>
                                
                                {tooltip && tooltip.idx === idx && (
                                    <View style={{
                                        position: 'absolute',
                                        bottom: chartHeight + 25,
                                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                        padding: 8,
                                        borderRadius: 6,
                                        alignItems: 'center',
                                        zIndex: 50,
                                        width: 80,
                                        elevation: 5
                                    }}>
                                        <Text style={{ color: '#fff', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800', marginBottom: 4 }} numberOfLines={1}>{tooltip.label}</Text>
                                        <Text style={{ 
                                            color: tooltip.phase === 'R' ? '#ef4444' : tooltip.phase === 'Y' ? '#facc15' : '#3b82f6', 
                                            fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800' 
                                        }}>
                                            {tooltip.phase} Phase: {tooltip.val}
                                        </Text>
                                        <View style={{
                                            position: 'absolute', bottom: -5, width: 0, height: 0,
                                            borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
                                            borderLeftColor: 'transparent', borderRightColor: 'transparent',
                                            borderTopColor: 'rgba(15, 23, 42, 0.85)'
                                        }} />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

// ─── Weekly Deviation Bar Chart ───────────────────────────────
function WeeklyDeviationBarChart({ weeklyData }: { weeklyData: any[] }) {
    const [tooltip, setTooltip] = useState<any>(null);
    if (!weeklyData || weeklyData.length === 0) return <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>;
    
    const sortedData = [...weeklyData].slice(0, 10);
    const maxVal = Math.max(...sortedData.flatMap(s => [parseFloat(s.this_week_avg) || 0, parseFloat(s.last_week_avg) || 0]));
    const chartHeight = 150;
    
    const availableWidth = SW - 60;
    const isScrollable = sortedData.length > 4;
    const groupWidth = isScrollable ? 80 : availableWidth / (sortedData.length || 1);
    const barWidth = isScrollable ? 22 : (groupWidth - 10) / 2;

    return (
        <View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: moderateScale(15), marginBottom: moderateScale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 12, height: 12, backgroundColor: '#38bdf8', borderRadius: 2, marginRight: 4 }} /><Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: 'bold' }}>This Week avg</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 12, height: 12, backgroundColor: '#64748b', borderRadius: 2, marginRight: 4 }} /><Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: 'bold' }}>Last Week avg</Text></View>
            </View>
            <ScrollView horizontal={isScrollable} showsHorizontalScrollIndicator={false} style={{ marginVertical: moderateScale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: moderateScale(10), paddingTop: moderateScale(50), paddingHorizontal: isScrollable ? 10 : 0, width: isScrollable ? 'auto' : availableWidth }}>
                    {sortedData.map((s, idx) => {
                        const tw = parseFloat(s.this_week_avg) || 0;
                        const lw = parseFloat(s.last_week_avg) || 0;
                        const twHeight = maxVal > 0 ? (tw / maxVal) * chartHeight : 0;
                        const lwHeight = maxVal > 0 ? (lw / maxVal) * chartHeight : 0;
                        const label = s.global_id || s.site_id || `Site ${idx+1}`;

                        return (
                            <View key={idx} style={{ alignItems: 'center', width: groupWidth, position: 'relative' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, justifyContent: 'center' }}>
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => { setTooltip({ idx, label, type: 'This Week', val: tw }); setTimeout(() => setTooltip(null), 3000); }}
                                        style={{ width: barWidth, height: twHeight, backgroundColor: '#38bdf8', marginRight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} 
                                    />
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => { setTooltip({ idx, label, type: 'Last Week', val: lw }); setTimeout(() => setTooltip(null), 3000); }}
                                        style={{ width: barWidth, height: lwHeight, backgroundColor: '#64748b', marginRight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} 
                                    />
                                </View>
                                <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', marginTop: 8, textAlign: 'center', fontWeight: '600' }} numberOfLines={1}>{label.substring(0, 10)}</Text>
                                
                                {tooltip && tooltip.idx === idx && (
                                    <View style={{
                                        position: 'absolute',
                                        bottom: chartHeight + 25,
                                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                        padding: 8,
                                        borderRadius: 6,
                                        alignItems: 'center',
                                        zIndex: 50,
                                        width: 80,
                                        elevation: 5
                                    }}>
                                        <Text style={{ color: '#fff', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800', marginBottom: 4 }} numberOfLines={1}>{tooltip.label}</Text>
                                        <Text style={{ 
                                            color: tooltip.type === 'This Week' ? '#38bdf8' : '#e2e8f0', 
                                            fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800' 
                                        }}>
                                            {tooltip.type}: {tooltip.val}
                                        </Text>
                                        <View style={{
                                            position: 'absolute', bottom: -5, width: 0, height: 0,
                                            borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
                                            borderLeftColor: 'transparent', borderRightColor: 'transparent',
                                            borderTopColor: 'rgba(15, 23, 42, 0.85)'
                                        }} />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
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
    label: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#5da3fa', marginBottom: verticalScale(4), textTransform: 'uppercase', letterSpacing: 0.5 },
    trigger: { backgroundColor: '#f5faff', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), borderWidth: 1.5, borderColor: '#d0e4f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    triggerTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1c3d5a', fontWeight: '600', flex: 1, marginRight: moderateScale(4) },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: moderateScale(24) },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), maxHeight: 400 },
    modalTitle: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(12) },
    option: { paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    optTxt: { fontSize: responsiveFontSize(15), flexShrink: 1, color: '#334155' },
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
                    colors={['#5da3fa', '#1c3d5a', '#4dc9f6', '#facc15']}
                />
            </SectionCard>


        </ScrollView>
    );
}

// ─── QUALITY TAB ──────────────────────────────────────────────
function QualityTab({ data, searchQuery, refreshing, onRefresh }: { data: any, searchQuery: string, refreshing: boolean, onRefresh: () => void }) {
    const [phaseFilter, setPhaseFilter] = useState<'R' | 'Y' | 'B'>('R');
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
            {/* Phase Missing Count per Site Chart */}
            <SectionCard title="Phase Missing Count per Site (R/Y/B)">
                <PhaseMissingBarChart siteData={originalSiteData} />
            </SectionCard>

            {/* R-Y-B Voltage Trend */}
            <SectionCard title="R-Y-B Phase Voltage Trend">
                {ryb.labels.length > 0 ? (
                    <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: moderateScale(16) }}>
                            {(['R', 'Y', 'B'] as const).map(p => {
                                const isActive = phaseFilter === p;
                                const color = p === 'R' ? '#ef4444' : p === 'Y' ? '#facc15' : '#3b82f6';
                                return (
                                    <TouchableOpacity 
                                        key={p} 
                                        activeOpacity={0.7}
                                        onPress={() => setPhaseFilter(p)}
                                        style={{
                                            paddingHorizontal: moderateScale(16), paddingVertical: 6, borderRadius: 20, 
                                            backgroundColor: isActive ? color : '#f8fafc',
                                            marginHorizontal: 6,
                                            borderWidth: 1, borderColor: isActive ? color : '#cbd5e1'
                                        }}
                                    >
                                        <Text style={{ 
                                            color: isActive ? '#fff' : '#64748b', 
                                            fontWeight: '800', fontSize: responsiveFontSize(12), flexShrink: 1, }}>{p} Phase</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        
                        {phaseFilter === 'R' && <TrendLine values={ryb.r_phase || []} labels={ryb.labels} color="#ef4444" />}
                        {phaseFilter === 'Y' && <TrendLine values={ryb.y_phase || []} labels={ryb.labels} color="#facc15" />}
                        {phaseFilter === 'B' && <TrendLine values={ryb.b_phase || []} labels={ryb.labels} color="#3b82f6" />}
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
                                <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#ef4444', fontWeight: '600' }}>{a.alert_type}</Text>
                                {a.timestamp && (
                                    <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8' }}>{new Date(a.timestamp).toLocaleString()}</Text>
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
    siteName: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#0f172a' },
    siteId: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', marginTop: verticalScale(2) },
    uptime: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', minWidth: 45, textAlign: 'right' },
    alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    alertSite: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#0f172a' },
});

// ─── TOD TAB ──────────────────────────────────────────────────
function TODTab({ data, searchQuery, refreshing, onRefresh }: { data: any, searchQuery: string, refreshing: boolean, onRefresh: () => void }) {
    if (!data) return null;

    const ov = data.overview || {};
    const vt = ov.voltage_trend || { labels: [], values: [] };
    const tech = data.technology_distribution || { labels: [], values: [] };
    const tod = data.tod_monitoring || {};
    const abn = tod.abnormal_alerts || {};
    const weeklyAlerts = abn.weekly_alerts || [];

    const pieData = tech.labels.map((lbl: string, i: number) => ({
        name: lbl,
        population: tech.values[i],
        color: ['#38bdf8', '#64748b', '#4dc9f6', '#facc15'][i % 4],
        legendFontColor: '#64748b',
        legendFontSize: responsiveFontSize(13)
    }));

    return (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5da3fa']} />}
        >
            {/* Voltage Fluctuation by TOD */}
            <SectionCard title="Voltage Fluctuation by TOD">
                <TrendLine values={vt.values} labels={vt.labels} color="#38bdf8" />
            </SectionCard>

            {/* Technology-wise Load Distribution */}
            <SectionCard title="Technology-wise Load Distribution">
                {tech.labels.length > 0 ? (
                    <View style={{ alignItems: 'center' }}>
                        <PieChart
                            data={pieData}
                            width={SW - 60}
                            height={200}
                            chartConfig={{
                                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            }}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                            absolute
                        />
                    </View>
                ) : (
                    <Text style={{ textAlign: 'center', color: '#94a3b8', margin: moderateScale(20) }}>No Data</Text>
                )}
            </SectionCard>

            {/* This Week vs Last Week */}
            <SectionCard title="This Week vs Last Week">
                <WeeklyDeviationBarChart weeklyData={weeklyAlerts} />
            </SectionCard>
        </ScrollView>
    );
}
const TODS = StyleSheet.create({
    abnWrap: { backgroundColor: '#fff', borderRadius: 16, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2 },
    abnTitle: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(4) },
    abnSub: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#94a3b8', marginBottom: verticalScale(12) },
    tab: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(7), borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: moderateScale(8), borderWidth: 2, borderColor: '#5da3fa' },
    tabActive: { backgroundColor: '#5da3fa' },
    tabTxt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#5da3fa' },
    tabTxtActive: { color: '#fff' },
    noData: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#94a3b8', fontWeight: '600', padding: moderateScale(16), textAlign: 'center' },
});



// ─── Grid Filter Bar Component (inline, like web) ────────────
function GridFilterBar({ localFilters, setLocalFilters, states, districts, sites, onStateChange, onApply, onReset }: {
    localFilters: any;
    setLocalFilters: (f: any) => void;
    states: any[];
    districts: any[];
    sites: any[];
    onStateChange: (stateId: string) => void;
    onApply: () => void;
    onReset: () => void;
}) {
    const [showDateFrom, setShowDateFrom] = React.useState(false);
    const [showDateTo, setShowDateTo] = React.useState(false);

    const selectedState = states.find((s: any) => String(s.state_id) === String(localFilters.state_id));
    const selectedDistrict = districts.find((d: any) => String(d.dist_id) === String(localFilters.dist_id));
    const selectedSite = sites.find((s: any) => String(s.site_id) === String(localFilters.site_id));

    return (
        <View style={GFB.container}>
            {/* Row 1: Date From + Date To */}
            <View style={GFB.row}>
                <View style={GFB.group}>
                    <Text style={GFB.label}>DATE FROM</Text>
                    <TouchableOpacity style={GFB.input} onPress={() => setShowDateFrom(true)} activeOpacity={0.8}>
                        <Text style={GFB.inputTxt}>{localFilters.date_from || 'Select'}</Text>
                        <AppIcon name="calendar" size={12} color="#5da3fa" />
                    </TouchableOpacity>
                    {showDateFrom && (
                        <DateTimePicker
                            value={new Date(localFilters.date_from || Date.now())}
                            mode="date"
                            display="calendar"
                            onChange={(_e: any, d: any) => {
                                setShowDateFrom(false);
                                if (d) {
                                    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
                                    setLocalFilters((p: any) => ({ ...p, date_from: `${y}-${m}-${day}` }));
                                }
                            }}
                        />
                    )}
                </View>

                <View style={GFB.group}>
                    <Text style={GFB.label}>DATE TO</Text>
                    <TouchableOpacity style={GFB.input} onPress={() => setShowDateTo(true)} activeOpacity={0.8}>
                        <Text style={GFB.inputTxt}>{localFilters.date_to || 'Select'}</Text>
                        <AppIcon name="calendar" size={12} color="#5da3fa" />
                    </TouchableOpacity>
                    {showDateTo && (
                        <DateTimePicker
                            value={new Date(localFilters.date_to || Date.now())}
                            mode="date"
                            display="calendar"
                            onChange={(_e: any, d: any) => {
                                setShowDateTo(false);
                                if (d) {
                                    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
                                    setLocalFilters((p: any) => ({ ...p, date_to: `${y}-${m}-${day}` }));
                                }
                            }}
                        />
                    )}
                </View>
            </View>

            {/* Row 2: State + District */}
            <View style={GFB.row}>
                <DropPicker
                    label="STATE / CIRCLE"
                    value={localFilters.state_id}
                    placeholder="All States"
                    options={states.map((s: any) => ({ label: s.state_name, value: String(s.state_id) }))}
                    onChange={(v: string) => {
                        setLocalFilters((p: any) => ({ ...p, state_id: v, dist_id: '', site_id: '' }));
                        onStateChange(v);
                    }}
                />
                <DropPicker
                    label="DISTRICT"
                    value={localFilters.dist_id}
                    placeholder="All Districts"
                    options={districts.map((d: any) => ({ label: d.district_name, value: String(d.dist_id) }))}
                    onChange={(v: string) => setLocalFilters((p: any) => ({ ...p, dist_id: v, site_id: '' }))}
                />
            </View>

            {/* Row 3: Site + Technology */}
            <View style={GFB.row}>
                <DropPicker
                    label="SITE"
                    value={localFilters.site_id}
                    placeholder="All Sites"
                    options={sites.map((s: any) => ({ label: `${s.site_name} (${s.site_id})`, value: String(s.site_id) }))}
                    onChange={(v: string) => setLocalFilters((p: any) => ({ ...p, site_id: v }))}
                />
                <DropPicker
                    label="TECHNOLOGY"
                    value={localFilters.technology}
                    placeholder="All"
                    options={[{ label: '2G', value: '2G' }, { label: '3G', value: '3G' }, { label: '4G', value: '4G' }, { label: '5G', value: '5G' }]}
                    onChange={(v: string) => setLocalFilters((p: any) => ({ ...p, technology: v }))}
                />
            </View>

            {/* Row 4: Apply + Reset + Info */}
            <View style={[GFB.row, { justifyContent: 'flex-end', alignItems: 'center', gap: moderateScale(8) }]}>
                {(localFilters.state_id || localFilters.site_id || localFilters.technology) && (
                    <Text style={GFB.infoTxt} numberOfLines={1}>
                        {localFilters.date_from} → {localFilters.date_to}{localFilters.site_id ? ` | Site: ${localFilters.site_id}` : ''}
                    </Text>
                )}
                <TouchableOpacity style={GFB.applyBtn} onPress={onApply} activeOpacity={0.85}>
                    <Text style={GFB.applyTxt}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={GFB.resetBtn} onPress={onReset} activeOpacity={0.85}>
                    <Text style={GFB.resetTxt}>Reset</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const GFB = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        marginHorizontal: moderateScale(10),
        marginTop: verticalScale(6),
        marginBottom: verticalScale(4),
        borderRadius: 14,
        padding: moderateScale(12),
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        gap: verticalScale(8),
    },
    row: { flexDirection: 'row', gap: moderateScale(8) },
    group: { flex: 1 },
    label: {
        fontSize: responsiveFontSize(9),
        flexShrink: 1,
        fontWeight: '800',
        color: '#5da3fa',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: verticalScale(3),
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#d0e4f7',
        borderRadius: 8,
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(7),
        backgroundColor: '#f5faff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputTxt: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#1c3d5a', fontWeight: '600', flex: 1, marginRight: 4 },
    applyBtn: {
        backgroundColor: '#1e3c72',
        borderRadius: 8,
        paddingHorizontal: moderateScale(18),
        paddingVertical: verticalScale(8),
    },
    applyTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13), flexShrink: 1 },
    resetBtn: {
        borderWidth: 1.5,
        borderColor: '#5da3fa',
        borderRadius: 8,
        paddingHorizontal: moderateScale(14),
        paddingVertical: verticalScale(8),
    },
    resetTxt: { color: '#5da3fa', fontWeight: '700', fontSize: responsiveFontSize(13), flexShrink: 1 },
    infoTxt: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', flex: 1 },
});

// ─── MAIN COMPONENT ───────────────────────────────────────────
const TABS = ['Overview', 'Quality', 'TOD'] as const;
type TabType = typeof TABS[number];

export default function GridBillingScreen({ navigation }: any) {
  const [localFilters, setLocalFilters] = useState<any>({ date_from: daysAgoStr(30), date_to: todayStr(), state_id: '', dist_id: '', site_id: '', technology: '' });

    const [activeTab, setActiveTab] = useState<TabType>('Overview');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [exporting, setExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Filter state


    // Dropdown options from API response
    const [states, setStates] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [sites, setSites] = useState<any[]>([]);

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async (isRefresh = false, customFilters?: any) => {
        if (!isRefresh) setLoading(true);
        setErrorMsg(null);
        const params = customFilters || localFilters;
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
            if ((e.response && e.response.status === 404) || (e.message && e.message.includes('404'))) {
                setData(null);
                setErrorMsg('No data available for the selected filters.');
                setLoading(false);
                setRefreshing(false);
                return;
            }
            
            let msg = e.message || 'Failed to connect to server';
            if (msg.toLowerCase().includes('network error')) {
                msg = 'Network Error: The data might be too large for this range, or your connection is unstable. Try a shorter date range.';
            } else if (msg.toLowerCase().includes('timeout')) {
                msg = 'Request Timed Out: The server is taking too long. Please try a smaller date range.';
            }
            setErrorMsg(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [localFilters]);

    // Initial fetch on mount
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                `"GRID POWER ANALYTICS REPORT (${globalFilters.date_from} to ${globalFilters.date_to})"`,
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
        localFilters.date_from && localFilters.date_to ? `${localFilters.date_from} - ${localFilters.date_to}` : null,
        localFilters.technology ? `Tech: ${localFilters.technology}` : null,
        localFilters.site_id ? `Site: ${localFilters.site_id}` : null,
    ].filter(Boolean).join('  ·  ');

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="GRID POWER ANALYTICS"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                hideGlobalFilter={true}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                ]}
            />


            {/* ── Grid Filter Bar ── */}
            <GridFilterBar
                localFilters={localFilters}
                setLocalFilters={setLocalFilters}
                states={states}
                districts={districts}
                sites={sites}
                onStateChange={onStateChange}
                onApply={() => { setData(null); fetchData(); }}
                onReset={() => setLocalFilters({ date_from: daysAgoStr(30), date_to: todayStr(), state_id: '', dist_id: '', site_id: '', technology: '' })}
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
                    <AppIcon name="slash" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTxtMain}>No Data Available</Text>
                    <Text style={styles.emptyTxtSub}>No data found for the selected filters. Try adjusting your date range or filters.</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
                        <Text style={styles.retryTxt}>Refresh</Text>
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
    loaderTxt: { marginTop: verticalScale(12), color: '#5da3fa', fontWeight: '600', fontSize: responsiveFontSize(15), flexShrink: 1, },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(12) },
    tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#5da3fa' },
    tabTxt: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#64748b' },
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
    searchInput: { flex: 1, fontSize: responsiveFontSize(15), flexShrink: 1, color: '#1e293b', height: verticalScale(38), padding: moderateScale(0), fontWeight: '500' },

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(40), backgroundColor: '#edf2fb' },
    emptyTxtMain: { fontSize: responsiveFontSize(20), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginTop: verticalScale(12) },
    emptyTxtSub: { fontSize: responsiveFontSize(15), flexShrink: 1, color: '#64748b', textAlign: 'center', marginTop: verticalScale(8), lineHeight: 20 },
    retryBtn: { marginTop: verticalScale(20), backgroundColor: '#5da3fa', paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(10), borderRadius: 10 },
    retryTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(16), flexShrink: 1, },
});