import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    Platform, FlatList, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import { PieChart, BarChart } from 'react-native-chart-kit';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';

let screenWidth = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') screenWidth = _d.width; } catch(_) {}

// ─────────────────────────────────────────────────────────────
// SEVERITY MAPS — EXACTLY matching website HTML
// ─────────────────────────────────────────────────────────────
const smpsAlarmSeverityMap: Record<string, string> = {
    HIGH_TEMPERATURE: 'Major',
    FIRE_and_SMOKE: 'Fire',
    LOW_BATTERY_VOLTAGE: 'Major',
    MAINS_FAIL: 'Major',
    DG_ON: 'Major',
    DG_Failed_to_start: 'Major',
    SITE_ON_BATTERY: 'Major',
    EMERGENCY_FAULT: 'Minor',
    ALTERNATOR_FAULT: 'Minor',
    DG_OVERLOAD: 'Minor',
    DG_FUEL_LEVEL_LOW1: 'Minor',
    DG_FUEL_LEVEL_LOW2: 'Minor',
    LLOP_FAULT: 'Minor',
    DG_Failed_to_stop: 'Minor',
    DOOR_ALARM: 'Minor',
    reserve: 'Minor',
};

const tpmsAlarmSeverityMap: Record<string, string> = {
    "BB Loop Break": "Major", "BB1 DisConnect": "Major", "BB2 Disconnect": "Major",
    "BB3 Disconnect": "Major", "BB4 Disconnect": "Major", "Extra Alarm": "Minor",
    "SOBT": "Minor", "Rectifier Fail": "Major", "RRU Disconnect": "Major", "BTS Open": "Major",
    "RTN Open": "Major", "Door-Open": "Minor", "Shelter Loop Break": "Major", "Fiber cut": "Major",
    "camera alarm": "Major", "BTS CABLE CUT": "Major", "cable loop break": "Major",
    "Motion 1": "Minor", "Motion 2": "Minor", "Fiber Cabinet open": "Major",
    "DG Battery Disconnected": "Major", "RTN cabinet open": "Major", "airtel odc rack": "Major",
    "idea odc rack": "Major", "Idea BTS Cabinet": "Major", "Airtel BTS Cabinet": "Major",
    "Door-Open 2": "Minor", "Solar Voltage Sensing": "Major", "Solar Loop Break": "Major",
    "AC 1 Fail": "Major", "AC 2 Fail": "Major", "AC 3 Fail": "Major", "AC 4 Fail": "Major",
    "Fire and smoke 1": "Fire", "fire and smoke 2": "Fire", "High Temperature": "Major",
    "DC Battery low": "Major", "Mains Failed": "Major", "Moter 1 Loop Break": "Major",
    "Moter 2 Loop Break": "Major", "DG on Load": "Minor", "Starter Cabinet Open": "Major",
    "Site Battery Low": "Major", "DG Common Fault": "Major", "Site On Battery": "Major",
    "BB Cabinet Door Open": "Major", "OAD Shelter Loop Break": "Major", "OAD RRU Disconnect": "Major",
    "OAD BB Cabinet Door Open": "Minor", "OAD BTS Open": "Major", "OAD BTS 1 Open": "Major",
    "OAD BTS 2 Open": "Major", "PUMP 1": "Minor", "Pump 2": "Minor", "Pump 3": "Minor",
    "B LVD Cut": "Major", "L LVD Cut": "Major", "Dg door open": "Minor", "DG BATTERY LOOPING": "Major",
    "RF CABLE DISCONNECT": "Major", "Motion 3": "Minor", "Motion 4": "Minor",
    "Vibration sensor 1": "Minor", "Vibration sensor2": "Minor", "Servo cabinet open": "Major",
    "Vibration Sensor 3": "Minor", "Vibration sensor 4": "Minor", "Vibration sensor 5": "Minor",
    "mains voltage trip": "Major", "DG Faild to start": "Major", "DG Faild to OFF": "Major",
    "Door Open": "Minor", "TPMS Battery Low": "Major", "Hooter": "Major", "FSMK": "Major",
    "DOPN": "Minor", "TPMS Supply Failed": "Minor", "MOTN": "Major", "AM MNSF": "Major", "BTLV": "Major",
};

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS — mirrors website logic exactly
// ─────────────────────────────────────────────────────────────
function isNightTime(ts: string): boolean {
    const h = new Date(ts).getHours();
    return h >= 22 || h < 6;
}

function isDoorAlarm(field: string | null, name: string | null): boolean {
    if (field === 'DOOR_ALARM') return true;
    return ['door-open', 'door open', 'dopn', 'door_open'].some(
        p => (name || '').toLowerCase().includes(p)
    );
}

/**
 * getSeverity — EXACT mirror of website getSeverity()
 * Returns: 'Major' | 'Minor' | 'Fire' | 'NightDoor'
 */
function getSeverity(alarm: any): string {
    const type = alarm.alarm_type;
    const ts = alarm.created_dt || alarm.create_dt || alarm.start_time;

    if (type === 'tpms') {
        const name = alarm.alarm_name || '';
        const nl = name.toLowerCase();
        if (nl.includes('fire') || nl.includes('smoke') || nl.includes('fsmk')) return 'Fire';
        if (isDoorAlarm(null, name) && ts && isNightTime(ts)) return 'NightDoor';
        return tpmsAlarmSeverityMap[name] || 'Minor';
    }

    // SMPS path — check active_alarms + closed_alarms arrays first
    const all = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];

    if (all.length === 0) {
        // Fallback to top-level field (fast_real_time_alarm_data structure)
        const f = alarm.alarm_name || alarm.alarm_field || '';
        if (f === 'FIRE_and_SMOKE') return 'Fire';
        if (isDoorAlarm(f, f) && ts && isNightTime(ts)) return 'NightDoor';
        return smpsAlarmSeverityMap[f] || 'Minor';
    }

    // Fire or NightDoor takes priority
    for (const a of all) {
        if (a.field === 'FIRE_and_SMOKE') return 'Fire';
        if (isDoorAlarm(a.field, a.name) && ts && isNightTime(ts)) return 'NightDoor';
    }

    // Major beats Minor
    for (const a of all) {
        if ((smpsAlarmSeverityMap[a.field] || 'Minor') === 'Major') return 'Major';
    }
    return 'Minor';
}

/**
 * isAlarmOpen — mirrors website isAlarmOpen() exactly
 */
function isAlarmOpen(alarm: any): boolean {
    if (alarm.alarm_type === 'smps') {
        if (alarm.alarm_status === 'Open') return true;
        if (alarm.alarm_status === 'Closed') return false;
        return !alarm.end_time;
    }
    if (alarm.alarm_status === 'Open') return true;
    if (alarm.alarm_status === 'Closed') return false;
    return alarm.is_currently_active === true || !alarm.end_time;
}

/**
 * getAlarmDisplayName — mirrors website getAlarmDisplayName() exactly
 */
function getAlarmDisplayName(alarm: any): string {
    if (alarm.alarm_type === 'tpms') return alarm.alarm_name || 'Unknown';
    const all = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
    if (all.length) return all.map((a: any) => a.name || a.field).join(', ');
    return alarm.alarm_name || alarm.alarm_field || 'Unknown';
}

function formatDuration(secs: number): string {
    if (!secs || secs <= 0) return '0s';
    secs = Math.abs(Math.floor(secs));
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
    return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
}

function formatTs(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleDateString() + '\n' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────
// SEVERITY / STATUS COLORS — matching website badge classes
// ─────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
    fire: '#ef4444',
    nightdoor: '#8a2be2',
    major: '#f59e0b',
    minor: '#3b82f6',
};

const SEV_BG: Record<string, string> = {
    fire: 'rgba(239,68,68,0.12)',
    nightdoor: 'rgba(138,43,226,0.12)',
    major: 'rgba(245,158,11,0.12)',
    minor: 'rgba(59,130,246,0.12)',
};

const SEV_LABEL: Record<string, string> = {
    fire: 'FIRE & SMOKE',
    nightdoor: 'NIGHT DOOR',
    major: 'MAJOR',
    minor: 'MINOR',
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function NocAnalytics({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [allAlarms, setAllAlarms] = useState<any[]>([]);
    const [severityFilter, setSeverityFilter] = useState('all');
    const [fullname, setFullname] = useState('Administrator');
    const [exporting, setExporting] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    // ── Fetch — same dual-API approach as website ──────────────
    const fetchAlarms = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            // Fetch SMPS alarms (same endpoint as website /api/alarms/)
            const smpsRes = await api.getAlarms();
            const smpsData = Array.isArray(smpsRes)
                ? smpsRes
                : smpsRes?.data ?? smpsRes?.alarms ?? [];

            // Fetch TPMS alarms (same endpoint as website /api/live-fast-alarms/)
            const tpmsRes = await api.getLiveFastAlarms();
            const tpmsData = Array.isArray(tpmsRes)
                ? tpmsRes
                : tpmsRes?.data ?? tpmsRes?.alarms ?? [];

            // Tag + combine — NO deduplication, exactly like website
            const combined = [
                ...smpsData.map((a: any) => ({ ...a, alarm_type: 'smps' })),
                ...tpmsData.map((a: any) => ({ ...a, alarm_type: 'tpms' })),
            ];

            // Sort newest-first
            combined.sort((a: any, b: any) => {
                const ta = +new Date(a.created_dt || a.create_dt || a.start_time || 0);
                const tb = +new Date(b.created_dt || b.create_dt || b.start_time || 0);
                return tb - ta;
            });

            setAllAlarms(combined);
        } catch (e) {
            console.log('Analytics Fetch Error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleExport = async () => {
        if (!allAlarms.length) return Alert.alert('No data', 'Nothing to export.');
        setExporting(true);
        try {
            const header = 'TYPE,EVENT ID,GLOBAL ID,SITE ID,SITE NAME,ALARM NAME,SEVERITY,STATUS,START TIME,END TIME,DURATION';
            const rows = allAlarms.map(a => {
                const sev = getSeverity(a);
                const status = isAlarmOpen(a) ? 'Open' : 'Closed';
                let durSecs = a.active_time_seconds || a.active_seconds || 0;
                if (!durSecs) {
                    const st = a.start_time || a.created_dt || a.create_dt;
                    const et = a.end_time;
                    if (st) durSecs = Math.max(0, Math.floor(((et ? new Date(et) : new Date()).getTime() - new Date(st).getTime()) / 1000));
                }
                return [
                    `"${(a.alarm_type?.toLowerCase() === 'tpms' || a.alarm_type?.toLowerCase() === 'rms') ? 'RMS' : (a.alarm_type || '')}"`,
                    `"${a.event_id || a.alarm_id || ''}"`,
                    `"${a.global_id || ''}"`,
                    `"${a.site_id || ''}"`,
                    `"${a.site_name || ''}"`,
                    `"${getAlarmDisplayName(a).replace(/"/g, '""')}"`,
                    `"${sev}"`,
                    `"${status}"`,
                    `"${a.start_time || a.created_dt || a.create_dt || ''}"`,
                    `"${a.end_time || ''}"`,
                    `"${formatDuration(durSecs)}"`
                ].join(',');
            });
            const csvContent = [header, ...rows].join('\n');
            const fileName = `NOC_Analytics_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvContent, 'utf8');
            await RNShare.open({ url: `file://${filePath}`, type: 'text/csv' });
        } catch (e) {
            console.log('NOC export error:', e);
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        fetchAlarms();
        const interval = setInterval(() => fetchAlarms(true), 30000); // 30s same as website
        return () => clearInterval(interval);
    }, [fetchAlarms]);

    const onRefresh = () => { setRefreshing(true); fetchAlarms(true); };

    // ── KPI Calculation — EXACT mirror of website updateKPIs() ──
    const kpis = useMemo(() => {
        let total = 0, major = 0, minor = 0, fire = 0, nightDoor = 0, open = 0, closed = 0;

        allAlarms.forEach(a => {
            total++;
            const sev = getSeverity(a).toLowerCase();
            const isOpen = isAlarmOpen(a);

            if (sev === 'fire') fire++;
            else if (sev === 'nightdoor') nightDoor++;
            else if (sev === 'major') major++;
            else minor++;

            if (isOpen) open++; else closed++;
        });

        return {
            total,
            major: major + fire + nightDoor, // website: Major card shows Major+Fire+NightDoor
            minor,
            open,
            closed,
        };
    }, [allAlarms]);

    // ── Filtered list for the incident table ──────────────────
    const filteredAlarms = useMemo(() => {
        let list = allAlarms;
        if (severityFilter !== 'all') {
            list = list.filter(a => {
                const sev = getSeverity(a).toLowerCase();
                const open = isAlarmOpen(a);
                if (severityFilter === 'major') return sev === 'major' || sev === 'fire' || sev === 'nightdoor';
                if (severityFilter === 'minor') return sev === 'minor';
                if (severityFilter === 'open') return open;
                if (severityFilter === 'closed') return !open;
                return true;
            });
        }
        if (search) {
            const low = search.toLowerCase();
            list = list.filter(a =>
                (a.global_id || '').toLowerCase().includes(low) ||
                (a.site_id || '').toLowerCase().includes(low) ||
                (a.site_name || '').toLowerCase().includes(low) ||
                (a.imei || '').toLowerCase().includes(low) ||
                getAlarmDisplayName(a).toLowerCase().includes(low)
            );
        }
        return list;
    }, [allAlarms, severityFilter, search]);

    // ── Chart data ─────────────────────────────────────────────
    const severityChartData = useMemo(() => [
        { name: 'Major', population: kpis.major, color: '#f59e0b', legendFontColor: '#64748b', legendFontSize: 11 },
        { name: 'Minor', population: kpis.minor, color: '#3b82f6', legendFontColor: '#64748b', legendFontSize: 11 },
    ], [kpis]);

    const openClosedData = useMemo(() => ({
        labels: ['Open', 'Closed'],
        datasets: [{ data: [kpis.open, kpis.closed] as number[] }],
    }), [kpis]);

    const topAlarms = useMemo(() => {
        const counts: Record<string, number> = {};
        allAlarms.forEach(a => {
            const name = getAlarmDisplayName(a).split(',')[0].trim() || 'Unknown';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [allAlarms]);

    const topAlarmsData = useMemo(() => ({
        labels: topAlarms.map(e => e[0].length > 8 ? e[0].substring(0, 8) + '..' : e[0]),
        datasets: [{ data: topAlarms.map(e => e[1]) as number[] }],
    }), [topAlarms]);

    // ── Stat Card ──────────────────────────────────────────────
    const renderStatCard = (
        label: string, value: number, color: string, icon: string, filterVal: string
    ) => (
        <TouchableOpacity
            key={filterVal}
            style={[
                styles.statCard,
                severityFilter === filterVal && { borderColor: color, borderBottomWidth: 3 },
            ]}
            onPress={() => setSeverityFilter(filterVal)}
            activeOpacity={0.75}
        >
            <Text style={[styles.statValue, { color }]}>{value ?? 0}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </TouchableOpacity>
    );

    // ── Incident Card ──────────────────────────────────────────
    const renderIncidentItem = ({ item }: { item: any }) => {
        const sev = getSeverity(item).toLowerCase();
        const open = isAlarmOpen(item);

        const sevColor = SEV_COLOR[sev] || '#3b82f6';
        const sevBg = SEV_BG[sev] || 'rgba(59,130,246,0.12)';
        const sevLabel = SEV_LABEL[sev] || sev.toUpperCase();
        const stColor = open ? '#ef4444' : '#10b981';
        const stBg = open ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
        const stLabel = open ? 'ACTIVE' : 'CLOSED';

        // Alarm display name — same as website
        const alarmName = getAlarmDisplayName(item);

        // Duration
        let durSecs = item.active_time_seconds || item.active_seconds || 0;
        if (!durSecs) {
            const st = item.start_time || item.created_dt || item.create_dt;
            const et = item.end_time;
            if (st) durSecs = Math.max(0, Math.floor(
                ((et ? new Date(et) : new Date()).getTime() - new Date(st).getTime()) / 1000
            ));
        }

        const eventId = item.event_id || item.alarm_id || '—';
        const siteId = item.site_id || '—';
        const startTs = item.start_time_display || item.start_time || item.created_dt || item.create_dt;
        const endTs = item.end_time_display || item.end_time;

        return (
            <View style={styles.incidentCard}>
                {/* Row 1: Event ID + Badges */}
                <View style={styles.cardRow}>
                    <Text style={styles.eventId}>Event ID: {eventId}</Text>
                    <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: sevBg, borderColor: sevColor }]}>
                            <Text style={[styles.badgeText, { color: sevColor }]}>{sevLabel}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: stBg, borderColor: stColor }]}>
                            <Text style={[styles.badgeText, { color: stColor }]}>{stLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* Row 2: Site info + Alarm name */}
                <View style={[styles.cardRow, { marginTop: verticalScale(8) }]}>
                    <View style={{ flex: 1.2 }}>
                        <Text style={styles.siteName} numberOfLines={1}>{item.site_name || '—'}</Text>
                        <Text style={styles.siteId}>Global ID: {item.global_id || item.site_id}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.alarmName} numberOfLines={2}>{alarmName}</Text>
                    </View>
                </View>

                {/* Row 3: Times + Duration */}
                <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                        <Text style={styles.timeLabel}>START</Text>
                        <Text style={styles.timeText}>{formatTs(startTs)}</Text>
                    </View>
                    <View style={[styles.timeDivider]} />
                    <View style={styles.timeItem}>
                        <Text style={styles.timeLabel}>END</Text>
                        <Text style={styles.timeText}>{endTs ? formatTs(endTs) : '—'}</Text>
                    </View>
                    <View style={[styles.timeDivider]} />
                    <View style={styles.timeItem}>
                        <Text style={styles.timeLabel}>DURATION</Text>
                        <Text style={[styles.timeText, { color: '#3b82f6', fontWeight: '700' }]}>
                            {formatDuration(durSecs)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };



    if (loading && !refreshing) {
        return (
            <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color="#1e3c72" />
                <Text style={styles.loaderText}>Loading analytics...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="NOC ANALYTICS"
                subtitle="LIVE"
                leftAction="menu"
                onLeftPress={() => setSidebarVisible(true)}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport }
                ]}
            />

            <FlatList
                data={filteredAlarms}
                keyExtractor={(item, i) => `${item.alarm_id || item.id || i}`}
                renderItem={renderIncidentItem}
                ListHeaderComponent={
                    <View style={{ backgroundColor: '#f1f5f9' }}>
                        {/* KPI Cards */}
                        <View style={styles.kpiWrapper}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.kpiScroll}
                            >
                                {renderStatCard('Total', kpis.total, '#3b82f6', 'bell', 'all')}
                                {renderStatCard('Major', kpis.major, '#f59e0b', 'alert-triangle', 'major')}
                                {renderStatCard('Minor', kpis.minor, '#3b82f6', 'info', 'minor')}
                                {renderStatCard('Active', kpis.open, '#ef4444', 'activity', 'open')}
                                {renderStatCard('Closed', kpis.closed, '#10b981', 'check-circle', 'closed')}
                            </ScrollView>
                        </View>

                        {/* Charts */}
                        <View style={styles.chartsSection}>
                            {/* Severity Pie */}
                            <View style={styles.chartCard}>
                                <Text style={styles.chartTitle}>SEVERITY DISTRIBUTION</Text>
                                {(kpis.major + kpis.minor) > 0 ? (
                                    <PieChart
                                        data={severityChartData}
                                        width={screenWidth - 32}
                                        height={180}
                                        chartConfig={{ color: (opacity = 1) => `rgba(0,0,0,${opacity})` }}
                                        accessor="population"
                                        backgroundColor="transparent"
                                        paddingLeft="15"
                                        center={[10, 0]}
                                        absolute
                                    />
                                ) : (
                                    <View style={styles.noDataBox}>
                                        <Text style={styles.noDataText}>No data</Text>
                                    </View>
                                )}
                            </View>

                            {/* Open vs Closed + Top Alarms side by side */}
                            <View style={styles.chartRow}>
                                <View style={[styles.chartCard, styles.chartHalf]}>
                                    <Text style={styles.chartTitleSm}>OPEN vs CLOSED</Text>
                                    {(kpis.open + kpis.closed) > 0 ? (
                                        <BarChart
                                            data={openClosedData}
                                            width={(screenWidth - 52) / 2}
                                            height={140}
                                            yAxisLabel="" yAxisSuffix=""
                                            chartConfig={chartConfigSmall('#ef4444')}
                                            fromZero
                                            showValuesOnTopOfBars
                                            style={{ marginLeft: -16 }}
                                        />
                                    ) : (
                                        <View style={styles.noDataBox}>
                                            <Text style={styles.noDataText}>No data</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={[styles.chartCard, styles.chartHalf]}>
                                    <Text style={styles.chartTitleSm}>TOP ALARM TYPES</Text>
                                    {topAlarmsData.datasets[0].data.length > 0 ? (
                                        <BarChart
                                            data={topAlarmsData}
                                            width={(screenWidth - 52) / 2}
                                            height={140}
                                            yAxisLabel="" yAxisSuffix=""
                                            chartConfig={chartConfigSmall('#3b82f6')}
                                            fromZero
                                            showValuesOnTopOfBars
                                            style={{ marginLeft: -16 }}
                                        />
                                    ) : (
                                        <View style={styles.noDataBox}>
                                            <Text style={styles.noDataText}>No data</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Legend for Top Alarms Type */}
                            {topAlarms.length > 0 && (
                                <View style={[styles.chartCard, { marginTop: -4, paddingBottom: verticalScale(8) }]}>
                                    <Text style={[styles.chartTitle, { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b' }]}>TOP 5 ALARM DETAILS</Text>
                                    {topAlarms.map(([name, count], i) => (
                                        <View key={name} style={styles.legendRow}>
                                            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                                            <Text style={styles.legendName} numberOfLines={1}>{name}</Text>
                                            <Text style={styles.legendCount}>{count}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Search Row */}
                        <View style={styles.searchWrap}>
                            <Icon name="search" size={14} color="#94a3b8" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by Global ID or Name..."
                                placeholderTextColor="#94a3b8"
                                value={search}
                                onChangeText={setSearch}
                            />
                            {!!search && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <Icon name="x" size={14} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter Row */}
                        <View style={styles.filterRow}>
                            <Text style={styles.incidentCount}>
                                INCIDENTS ({filteredAlarms.length})
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.filterBtns}>
                                    {(['all', 'major', 'minor', 'open', 'closed'] as const).map(f => (
                                        <TouchableOpacity
                                            key={f}
                                            onPress={() => setSeverityFilter(f)}
                                            style={[
                                                styles.filterBtn,
                                                severityFilter === f && styles.filterBtnActive,
                                            ]}
                                        >
                                            <Text style={[
                                                styles.filterBtnText,
                                                severityFilter === f && styles.filterBtnTextActive,
                                            ]}>
                                                {f.toUpperCase()}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: verticalScale(24) }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#1e3c72']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Icon name="slash" size={36} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No alarms match this filter</Text>
                    </View>
                }
            />

            <Sidebar
                isVisible={isSidebarVisible}
                onClose={() => setSidebarVisible(false)}
                navigation={navigation}
                fullname={fullname}
                activeRoute="NocAnalytics"
                handleLogout={async () => {
                    await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                    navigation.replace('Login');
                }}
            />
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
// CHART CONFIG
// ─────────────────────────────────────────────────────────────
const chartConfigSmall = (barColor: string) => ({
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => barColor + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: (opacity = 1) => `rgba(100,116,139,${opacity})`,
    propsForLabels: { fontSize: responsiveFontSize(9), flexShrink: 1, }, // Increased from 7
    barPercentage: 0.6,
});

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loaderText: { marginTop: verticalScale(10), color: '#1e3c72', fontWeight: '600', fontSize: responsiveFontSize(14), flexShrink: 1, },

    // Header
    header: { paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(14), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerBtn: { padding: moderateScale(6) },
    headerCenter: { alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', letterSpacing: 1.2 },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: verticalScale(3) },
    liveDot: { width: moderateScale(7), height: verticalScale(7), borderRadius: 3.5, backgroundColor: '#10b981', marginRight: moderateScale(5) },
    liveText: { color: '#10b981', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', letterSpacing: 0.5 },

    // KPI
    kpiWrapper: { backgroundColor: '#fff', paddingVertical: verticalScale(14) },
    kpiScroll: { paddingHorizontal: moderateScale(16), gap: moderateScale(10) },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        marginHorizontal: moderateScale(16), marginVertical: verticalScale(8), borderRadius: 10,
        paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), elevation: 1, gap: 8,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a', fontWeight: '500', padding: moderateScale(0) },
    statCard: {
        backgroundColor: '#fff', padding: moderateScale(16), borderRadius: 12,
        width: moderateScale(100), alignItems: 'center', elevation: 2,
    },
    statValue: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '700', lineHeight: 28 },
    statLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#666', fontWeight: '500', marginTop: verticalScale(4) },

    // Charts
    chartsSection: { padding: moderateScale(12) },
    chartCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(14),
        marginBottom: verticalScale(12), elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    chartRow: { flexDirection: 'row', gap: moderateScale(10) },
    chartHalf: { flex: 1 },
    chartTitle: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(10), letterSpacing: 0.5 },
    chartTitleSm: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(8), textAlign: 'center', letterSpacing: 0.4 },
    noDataBox: { height: verticalScale(80), justifyContent: 'center', alignItems: 'center' },
    noDataText: { color: '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, },

    // Filter Row
    filterRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: moderateScale(16), paddingBottom: verticalScale(12), paddingTop: verticalScale(4),
    },
    incidentCount: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#64748b', marginRight: moderateScale(8) },
    filterBtns: { flexDirection: 'row', gap: 6 },
    filterBtn: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6), borderRadius: 8, backgroundColor: '#e2e8f0' },
    filterBtnActive: { backgroundColor: '#3b82f6' },
    filterBtnText: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    filterBtnTextActive: { color: '#fff' },

    // Incident Card
    incidentCard: {
        backgroundColor: '#fff', marginHorizontal: moderateScale(12), marginBottom: verticalScale(10),
        borderRadius: 14, padding: moderateScale(16), elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eventId: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#94a3b8' },
    badgeRow: { flexDirection: 'row', gap: 6 },
    badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 6, borderWidth: 1 },
    badgeText: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800' },
    siteName: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    siteId: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },
    alarmName: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#3b82f6', textAlign: 'right' },

    // Time row
    timeRow: {
        flexDirection: 'row', backgroundColor: '#f8fafc',
        borderRadius: 10, padding: moderateScale(12), marginTop: verticalScale(12),
        alignItems: 'flex-start',
    },
    timeItem: { flex: 1, alignItems: 'center' },
    timeDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: moderateScale(6), alignSelf: 'stretch' },
    timeLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.4, marginBottom: verticalScale(4) },
    timeText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#1e293b', fontWeight: '600', textAlign: 'center', lineHeight: 14 },

    // Empty
    emptyBox: { alignItems: 'center', padding: moderateScale(48) },
    emptyText: { color: '#94a3b8', fontSize: responsiveFontSize(15), flexShrink: 1, marginTop: verticalScale(12), fontWeight: '500' },

    // Legend Styles
    legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(6), borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
    legendDot: { width: moderateScale(10), height: verticalScale(10), borderRadius: 5, marginRight: moderateScale(10) },
    legendName: { flex: 1, fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', fontWeight: '500' },
    legendCount: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginLeft: moderateScale(10) },
});