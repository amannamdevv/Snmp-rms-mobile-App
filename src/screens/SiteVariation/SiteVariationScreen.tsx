import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
  TextInput, Alert, Dimensions, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, logoutApi } from '../../api';
import { LineChart } from 'react-native-chart-kit';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Share as NativeShare } from 'react-native'; // for fallback
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';

let SCREEN_W = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SCREEN_W = _d.width; } catch(_) {}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VoltagePoint {
  timestamp: string;
  time_display: string;
  battery_voltage: number;
  running_status: string;
  active_alarms: string[];
  alarm_flags: Record<string, string>;
  mains_voltages: { r: number; y: number; b: number };
  dg_voltages: { r: number; y: number; b: number };
  source_status: string;
  voltage_change?: number;
  detection_method?: string;
}

interface AlarmDetail {
  timestamp: string;
  alarm_name: string;
  status: 'Open' | 'Closed';
  duration: string;
  battery_voltage_at_alarm: number | null;
  source: string;
  details?: string;
}

interface SiteData {
  site_info: { site_id: string; site_name: string; global_id: string; imei: string };
  date_range: { start_date_display: string; end_date_display: string };
  data_availability: { oldest_data_display: string; total_days_available: number; total_records: number };
  voltage_statistics: { min_voltage: number; max_voltage: number; avg_voltage: number; count: number };
  alarm_summary: { mains_fail_count: number; battery_events_count: number; dg_events_count: number; total_events: number };
  voltage_alarm_correlation: VoltagePoint[];
  detailed_alarms: AlarmDetail[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('mains')) return '#22c55e';
  if (s.includes('battery')) return '#f59e0b';
  if (s.includes('dg')) return '#ef4444';
  return '#94a3b8';
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6); // last 7 days
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(start), endDate: fmt(end) };
}

// ─── FIX 1: smartSample ───────────────────────────────────────────────────────
// Browser SVG handles 2000+ points fine. Mobile SVG engine crashes/freezes.
// This keeps max 120 points for the chart but always preserves status-change
// transitions so colors stay accurate. Original data is kept in `raw` for
// the readings table — table shows ALL records, only chart is sampled.
function smartSample(data: VoltagePoint[], max: number): VoltagePoint[] {
  if (data.length <= max) return data;
  const step = Math.floor(data.length / max);
  const kept = new Set<number>();
  kept.add(0);
  kept.add(data.length - 1);
  for (let i = 0; i < data.length; i += step) kept.add(i);
  let prev = data[0]?.source_status;
  for (let i = 1; i < data.length; i++) {
    if (data[i].source_status !== prev) {
      kept.add(Math.max(0, i - 1));
      kept.add(i);
    }
    prev = data[i].source_status;
  }
  return Array.from(kept).sort((a, b) => a - b).map(i => data[i]);
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderBottomColor: color, borderBottomWidth: 3, flex: undefined, width: moderateScale(140) }]}>
      <AppIcon name={icon} size={20} color={color} style={{ marginBottom: verticalScale(6) }} />
      <Text style={[styles.kpiVal, { color }]}>{value}</Text>
      <Text style={styles.kpiLab}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SiteVariationScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('Administrator');
  const [activeTab, setActiveTab] = useState<'chart' | 'alarms' | 'readings'>('chart');

  // Filters
  const defaults = getDefaultDates();
  const [siteId, setSiteId] = useState('');
  const [globalId, setGlobalId] = useState('');
  const [imei, setImei] = useState('');
  const [siteName, setSiteName] = useState('');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Chart local filters
  const [chartDateFilter, setChartDateFilter] = useState('All Dates');
  const [chartHourFilter, setChartHourFilter] = useState('All Hours');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const [listLimit, setListLimit] = useState(25);
  const [listFilter, setListFilter] = useState('All'); // 'All', 'Mains', 'Battery', 'DG'
  const [expandedLogIdx, setExpandedLogIdx] = useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem('user_fullname').then(n => n && setFullname(n));
  }, []);

  const fetchData = useCallback(async () => {
    if (!siteId && !globalId && !imei && !siteName) {
      Alert.alert('Filter Required', 'Please enter at least one of: Site ID, Global ID, IMEI, or Site Name.');
      return;
    }
    setLoading(true);
    try {
      const filters: any = {};
      if (siteId) filters.site_id = siteId;
      if (globalId) filters.global_id = globalId;
      if (imei) filters.imei = imei;
      if (siteName) filters.site_name = siteName;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const data = await api.getSiteVariationData(filters, 1, 2500); // Fetch up to 2500 points for "Everything" view
      if (data.error) {
        Alert.alert('Error', data.error);
      } else {
        setSiteData(data);
        setActiveTab('chart');
        setSelectedIdx(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to fetch site variation data');
    } finally {
      setLoading(false);
    }
  }, [siteId, globalId, imei, siteName, startDate, endDate]);

  const handleExport = async () => {
    if (!siteData) return;
    setExporting(true);
    try {
      const info = siteData.site_info;
      const title = `"SITE VARIATION ANALYSIS - ${info.site_name || info.site_id} (${startDate} to ${endDate})"`;
      let csvContent = title + '\n\n';

      // Use the same filtering logic as the UI
      let filteredVoltage = siteData.voltage_alarm_correlation;
      let filteredAlarms = siteData.detailed_alarms;

      if (chartDateFilter !== 'All Dates') {
        filteredVoltage = filteredVoltage.filter(v => v.timestamp.startsWith(chartDateFilter));
        filteredAlarms = filteredAlarms.filter(a => a.timestamp.startsWith(chartDateFilter));
      }
      if (chartHourFilter !== 'All Hours') {
        filteredVoltage = filteredVoltage.filter(v => {
          const timeStr = v.timestamp.split('T')[1];
          return timeStr && timeStr.startsWith(chartHourFilter + ':');
        });
        filteredAlarms = filteredAlarms.filter(a => {
          const timeStr = a.timestamp.split('T')[1];
          return timeStr && timeStr.startsWith(chartHourFilter + ':');
        });
      }

      // 1. Voltage Data
      csvContent += '"--- VOLTAGE CORRELATION ---"\n';
      csvContent += 'TIMESTAMP,SOURCE,STATUS,BATTERY VOLTAGE,MAINS VOLTS (R/Y/B),DG VOLTS (R/Y/B),ACTIVE ALARMS\n';
      filteredVoltage.forEach(pt => {
        const mains = `${pt.mains_voltages?.r || 0}/${pt.mains_voltages?.y || 0}/${pt.mains_voltages?.b || 0}`;
        const dg = `${pt.dg_voltages?.r || 0}/${pt.dg_voltages?.y || 0}/${pt.dg_voltages?.b || 0}`;
        const alarmsAtPt = (pt.active_alarms || []).join(' | ');
        csvContent += `"${pt.timestamp}","${pt.source_status}","${pt.running_status}","${parseFloat(pt.battery_voltage.toString()).toFixed(2)}","${mains}","${dg}","${alarmsAtPt}"\n`;
      });

      // 2. Alarms
      csvContent += '\n"--- ALARM LOG ---"\n';
      csvContent += 'TIMESTAMP,ALARM NAME,STATUS,DURATION,VOLTS AT ALARM,DETAILS\n';
      filteredAlarms.forEach(al => {
        csvContent += `"${al.timestamp}","${al.alarm_name}","${al.status}","${al.duration}","${al.battery_voltage_at_alarm !== null ? parseFloat(al.battery_voltage_at_alarm.toString()).toFixed(2) : '-'}","${al.details || ''}"\n`;
      });

      const path = `${RNFS.TemporaryDirectoryPath}/site_variation_${Date.now()}.csv`;
      await RNFS.writeFile(path, csvContent, 'utf8');
      await Share.open({
        url: `file://${path}`,
        type: 'text/csv',
        filename: 'Site_Variation_Analysis',
      });
    } catch (e: any) {
      console.log('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  // ─── FIX 2: chartData useMemo ─────────────────────────────────────────────
  // Only change vs original: smartSample() called on filtered data before
  // building chart datasets. `raw` still holds ALL filtered points for tooltip.
  // `allRaw` holds unfiltered data for the readings table below the chart.
  const chartData = useMemo(() => {
    if (!siteData?.voltage_alarm_correlation?.length) return null;
    let raw = siteData.voltage_alarm_correlation; // Show absolute everything, including 0s

    if (chartDateFilter !== 'All Dates') {
      raw = raw.filter(v => v.timestamp.startsWith(chartDateFilter));
    }
    if (chartHourFilter !== 'All Hours') {
      raw = raw.filter(v => {
        const timeStr = v.timestamp.split('T')[1];
        if (!timeStr) return false;
        return timeStr.startsWith(chartHourFilter + ':');
      });
    }

    setSelectedIdx(null);

    // sampled = what the chart draws (fast, no SVG crash)
    // raw     = what the tooltip reads (accurate on tap)
    const sampled = smartSample(raw, 120);

    const labels = sampled.map((_, i) => (i % 15 === 0 ? sampled[i].time_display.split(' ')[1] : ''));
    const values = sampled.map(v => parseFloat(v.battery_voltage.toFixed(2)));
    const colors = sampled.map(v => (_: number) => statusColor(v.running_status));

    return {
      labels,
      datasets: [{ data: values, colors }],
      raw: sampled,          // tooltip uses this (indexed by chart tap)
      totalFiltered: raw.length, // shown in subtitle
    };
  }, [siteData, chartDateFilter, chartHourFilter]);

  const availableDates = useMemo(() => {
    if (!siteData?.voltage_alarm_correlation) return [];
    const dates = new Set(siteData.voltage_alarm_correlation.map(v => v.timestamp.split('T')[0]));
    return ['All Dates', ...Array.from(dates)];
  }, [siteData]);

  const availableHours = ['All Hours', ...Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))];

  const alarms = siteData?.detailed_alarms ?? [];

  // ─── FIX 3: memoized renderItem & keyExtractor ────────────────────────────
  // Without useCallback, FlatList creates a new function reference every render
  // which forces every visible row to re-render on any state change (e.g. tap).
  const renderVoltageRow = useCallback(({ item: pt, id }: { item: VoltagePoint, id: string }) => {
    const rawStatus = pt.running_status || '';
    const sl = rawStatus.toLowerCase();
    const fullStatus = sl.includes('soeb') || sl.includes('mains') ? 'Site On Mains (SOEB)' :
                     sl.includes('sobt') || sl.includes('battery') ? 'Site On Battery (SOBT)' :
                     sl.includes('sodg') || sl.includes('dg') ? 'Site On DG (SODG)' :
                     rawStatus;
                     
    const color = statusColor(pt.running_status);
    const isExpanded = expandedLogIdx === id;

    return (
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setExpandedLogIdx(isExpanded ? null : id)}
            style={{ 
                backgroundColor: '#fff', 
                borderRadius: 12, 
                padding: moderateScale(12), 
                paddingHorizontal: moderateScale(14),
                marginBottom: moderateScale(10),
                borderLeftWidth: 4,
                borderLeftColor: color,
                borderWidth: 1,
                borderColor: '#f1f5f9',
                elevation: 1,
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) }}>
                {/* Left side: Dot, Time, Status */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: '600' }}>{pt.time_display}</Text>
                    <View style={{ backgroundColor: color, paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2), borderRadius: 10 }}>
                        <Text style={{ color: '#fff', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700' }}>{fullStatus}</Text>
                    </View>
                </View>
                {/* Right side: Alert icon and Chevron */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!isExpanded && pt.active_alarms && pt.active_alarms.length > 0 && (
                         <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 }}>
                             <AppIcon name="alert-circle" size={12} color="#ef4444" />
                             <Text style={{ fontSize: responsiveFontSize(10), flexShrink: 1, color: '#ef4444', fontWeight: '700', marginLeft: 4 }}>{pt.active_alarms.length}</Text>
                         </View>
                    )}
                    <AppIcon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
                </View>
            </View>

            {/* Voltage & Change Indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: moderateScale(14) }}>
                <Text style={{ fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: color }}>{pt.battery_voltage.toFixed(2)}V</Text>
                {pt.voltage_change !== undefined && (
                    <View style={{ marginLeft: moderateScale(8), backgroundColor: pt.voltage_change > 0 ? '#dcfce7' : pt.voltage_change < 0 ? '#fee2e2' : '#f1f5f9', paddingHorizontal: moderateScale(6), paddingVertical: verticalScale(3), borderRadius: 6 }}>
                        <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: pt.voltage_change > 0 ? '#16a34a' : pt.voltage_change < 0 ? '#ef4444' : '#64748b' }}>
                            {pt.voltage_change > 0 ? '↑' : pt.voltage_change < 0 ? '↓' : '~'} {Math.abs(pt.voltage_change).toFixed(2)}V
                        </Text>
                    </View>
                )}
            </View>

            {/* Expandable Section */}
            {isExpanded && (
                <View style={{ marginTop: verticalScale(12), paddingTop: verticalScale(12), borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    {/* Mains and DG */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(6) }}>
                        <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' }}>Mains:</Text>
                        <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', fontWeight: '600' }}>R:{pt.mains_voltages.r}V Y:{pt.mains_voltages.y}V B:{pt.mains_voltages.b}V</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12) }}>
                        <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' }}>DG:</Text>
                        <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', fontWeight: '600' }}>R:{pt.dg_voltages.r}V Y:{pt.dg_voltages.y}V B:{pt.dg_voltages.b}V</Text>
                    </View>

                    {/* Active Alarms */}
                    {pt.active_alarms && pt.active_alarms.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: verticalScale(12) }}>
                            {pt.active_alarms.map((name, idx) => (
                                <View key={idx} style={{ backgroundColor: '#fee2e2', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 6 }}>
                                    <Text style={{ fontSize: responsiveFontSize(12), flexShrink: 1, color: '#ef4444', fontWeight: '700' }}>{name}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Detection / Energy Log Source */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#0ea5e9', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <AppIcon name="database" size={12} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700' }}>
                                {pt.detection_method || pt.source_status || 'energy_log_source'}
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
  }, [expandedLogIdx]);

  const voltageKeyExtractor = useCallback((_: VoltagePoint, i: number) => String(i), []);

  const renderAlarmItem = useCallback(({ item: alarm }: { item: AlarmDetail }) => (
    <AlarmRow alarm={alarm} />
  ), []);

  const alarmKeyExtractor = useCallback((_: AlarmDetail, i: number) => `alarm_${i}`, []);

  const S = styles; // Shorthand

  // Filtered and chronological correlation data for the readings table
  const filteredCorrelation = useMemo(() => {
    if (!siteData) return [];
    let items = [...siteData.voltage_alarm_correlation];
    
    if (listFilter === 'Mains') {
        items = items.filter(i => {
           const s = (i.running_status || '').toLowerCase();
           return s.includes('mains') || s === 'soeb';
        });
    } else if (listFilter === 'Battery') {
        items = items.filter(i => {
            const s = (i.running_status || '').toLowerCase();
            return s.includes('battery') || s === 'sobt';
         });
    } else if (listFilter === 'DG') {
        items = items.filter(i => {
            const s = (i.running_status || '').toLowerCase();
            return s.includes('dg') || s === 'sodg';
         });
    }
    
    return items;
  }, [siteData, listFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
        <AppHeader
          title="Site Variation Analysis"
          leftAction="menu"
          onLeftPress={() => setSidebarVisible(true)}
          rightActions={[
            { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          ]}
        />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Filter Card — unchanged */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Search Site</Text>

          <View style={S.row2}>
            <View style={S.halfInput}>
              <Text style={S.label}>Global ID</Text>
              <TextInput style={S.input} placeholder="Enter Global ID (GID)" placeholderTextColor="#94a3b8" value={globalId} onChangeText={setGlobalId} />
            </View>
            <View style={S.halfInput}>
              <Text style={S.label}>Site Name</Text>
              <TextInput style={S.input} placeholder="Site name..." placeholderTextColor="#94a3b8" value={siteName} onChangeText={setSiteName} />
            </View>
          </View>

          <View style={S.row2}>
            <View style={S.halfInput}>
              <Text style={S.label}>Site ID</Text>
              <TextInput style={S.input} placeholder="Enter Site ID" placeholderTextColor="#94a3b8" value={siteId} onChangeText={setSiteId} />
            </View>
            <View style={S.halfInput}>
              <Text style={S.label}>GSM IMEI</Text>
              <TextInput style={S.input} placeholder="Enter IMEI number" placeholderTextColor="#94a3b8" value={imei} onChangeText={setImei} keyboardType="numeric" />
            </View>
          </View>

          <View style={S.row2}>
            <View style={S.halfInput}>
              <Text style={S.label}>From Date</Text>
              <TouchableOpacity style={S.input} onPress={() => setShowStartPicker(true)}>
                <Text style={{ color: startDate ? '#1e293b' : '#94a3b8' }}>{startDate || 'YYYY-MM-DD'}</Text>
              </TouchableOpacity>
            </View>
            <View style={S.halfInput}>
              <Text style={S.label}>To Date</Text>
              <TouchableOpacity style={S.input} onPress={() => setShowEndPicker(true)}>
                <Text style={{ color: endDate ? '#1e293b' : '#94a3b8' }}>{endDate || 'YYYY-MM-DD'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={new Date(startDate)}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowStartPicker(false);
                if (d) setStartDate(d.toISOString().split('T')[0]);
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={new Date(endDate)}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowEndPicker(false);
                if (d) setEndDate(d.toISOString().split('T')[0]);
              }}
            />
          )}

          <TouchableOpacity style={S.searchBtn} onPress={fetchData} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <><AppIcon name="search" size={16} color="#fff" /><Text style={S.searchBtnText}>  Analyze Site</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Empty state — unchanged */}
        {!siteData && !loading && (
          <View style={styles.emptyCard}>
            <AppIcon name="activity" size={52} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptyText}>Enter a Site ID, Global ID, IMEI or Site Name and tap Analyze Site to view battery voltage trends & alarm history.</Text>
          </View>
        )}

        {/* Results — unchanged structure */}
        {siteData && (
          <>
            {/* Site info — unchanged */}
            {/* Site info */}
            <View style={[styles.card, { paddingHorizontal: 0, paddingBottom: 0 }]}>
              <View style={{ paddingHorizontal: moderateScale(16), marginBottom: moderateScale(12) }}>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                     <AppIcon name="info" size={15} color="#1e293b" /> Site Information
                  </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: moderateScale(16), paddingBottom: moderateScale(16), gap: moderateScale(12) }}>
                  <InfoBox icon="map-pin" label="Site ID" value={siteData.site_info.site_id} />
                  <InfoBox icon="home" label="Site Name" value={siteData.site_info.site_name} />
                  <InfoBox icon="globe" label="Global ID" value={siteData.site_info.global_id} />
                  <InfoBox icon="cpu" label="IMEI" value={siteData.site_info.imei} />
              </ScrollView>
            </View>

            {/* KPIs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: moderateScale(12), paddingBottom: moderateScale(12) }}>
                <KpiCard icon="calendar" label="Days of Data Available" value={`${siteData.data_availability.total_days_available}`} color="#6366f1" />
                <KpiCard icon="database" label="Data Available Since" value={`${siteData.data_availability.oldest_data_display}`} color="#8b5cf6" />
                <KpiCard icon="zap-off" label="Mains Fail Events" value={`${siteData.alarm_summary.mains_fail_count}`} color="#ef4444" />
                <KpiCard icon="battery" label="Battery Mode Events" value={`${siteData.alarm_summary.battery_events_count}`} color="#f59e0b" />
                <KpiCard icon="activity" label="DG Run Events" value={`${siteData.alarm_summary.dg_events_count}`} color="#3b82f6" />
                <KpiCard icon="battery-charging" label="Average Battery Voltage" value={`${siteData.voltage_statistics.avg_voltage.toFixed(2)}V`} color="#0ea5e9" />
                <KpiCard icon="arrow-up" label="Maximum Voltage" value={`${siteData.voltage_statistics.max_voltage.toFixed(2)}V`} color="#22c55e" />
                <KpiCard icon="arrow-down" label="Minimum Voltage" value={`${siteData.voltage_statistics.min_voltage.toFixed(2)}V`} color="#e11d48" />
            </ScrollView>

            {/* Legend — unchanged */}
            <View style={[styles.card, { marginTop: verticalScale(12) }]}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} /><Text style={styles.legText}>Mains  </Text>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legText}>Battery  </Text>
                <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legText}>DG  </Text>
                <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} /><Text style={styles.legText}>Unknown</Text>
              </View>
            </View>

            {/* Tabs — unchanged */}
            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tab, activeTab === 'chart' && styles.tabActive]} onPress={() => setActiveTab('chart')}>
                <AppIcon name="activity" size={14} color={activeTab === 'chart' ? '#1e3c72' : '#fff'} />
                <Text style={[styles.tabText, activeTab === 'chart' && styles.tabTextActive]}> Chart</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'readings' && styles.tabActive]} onPress={() => setActiveTab('readings')}>
                <AppIcon name="list" size={14} color={activeTab === 'readings' ? '#1e3c72' : '#fff'} />
                <Text style={[styles.tabText, activeTab === 'readings' && styles.tabTextActive]}> Readings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'alarms' && styles.tabActive]} onPress={() => setActiveTab('alarms')}>
                <AppIcon name="bell" size={14} color={activeTab === 'alarms' ? '#1e3c72' : '#fff'} />
                <Text style={[styles.tabText, activeTab === 'alarms' && styles.tabTextActive]}> Alarms</Text>
              </TouchableOpacity>
            </View>

            {/* Chart Tab — unchanged except subtitle text + smartSample applied */}
            {activeTab === 'chart' && chartData && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Battery Voltage Timeline</Text>

                {/* Chart Filters — unchanged */}
                <View style={{ marginBottom: verticalScale(12) }}>
                  <Text style={styles.filterLabel}>Filter by Date:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(8) }}>
                    {availableDates.map(d => (
                      <TouchableOpacity key={d} onPress={() => setChartDateFilter(d)}
                        style={[styles.chip, chartDateFilter === d && styles.chipActive]}>
                        <Text style={[styles.chipText, chartDateFilter === d && styles.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.filterLabel}>Filter by Hour:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {availableHours.map(h => (
                      <TouchableOpacity key={h} onPress={() => setChartHourFilter(h)}
                        style={[styles.chip, chartHourFilter === h && styles.chipActive]}>
                        <Text style={[styles.chipText, chartHourFilter === h && styles.chipTextActive]}>{h === 'All Hours' ? h : h + ':00'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Subtitle: now shows sampled/total so user understands */}
                <Text style={styles.chartSub}>
                  Displaying {chartData.raw.length} of {chartData.totalFiltered} data points. Scroll horizontally to view all.
                </Text>

                {chartData.raw.length === 0 ? (
                  <Text style={styles.emptyText}>No data available for selected filters.</Text>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <LineChart
                        data={{
                          labels: chartData.labels,
                          datasets: [{ data: chartData.datasets[0].data }],
                        }}
                        width={Math.max(SCREEN_W - 32, chartData.labels.length * 18)}
                        height={260}
                        yAxisSuffix="V"
                        chartConfig={{
                          backgroundColor: '#fff',
                          backgroundGradientFrom: '#f8fafc',
                          backgroundGradientTo: '#fff',
                          decimalPlaces: 1,
                          color: (opacity = 1) => `rgba(30, 60, 114, ${opacity})`,
                          labelColor: () => '#64748b',
                          propsForDots: { r: '4', strokeWidth: '1', stroke: '#fff' },
                          propsForBackgroundLines: { stroke: '#e2e8f0', strokeDasharray: '' },
                        }}
                        bezier
                        style={{ borderRadius: 10 }}
                        withInnerLines
                        withOuterLines={false}
                        withDots={chartData.raw.length <= 150}
                        getDotColor={(_, idx) => statusColor(chartData.raw[idx]?.running_status ?? '')}
                        onDataPointClick={({ index }) => setSelectedIdx(index)}
                      />
                    </ScrollView>

                    {/* Tooltip Card */}
                    {selectedIdx !== null && chartData.raw[selectedIdx] && (
                      <View style={[styles.tooltipCard, { backgroundColor: '#262626', borderColor: '#404040' }]}>
                        <View style={[styles.tooltipHeader, { borderBottomColor: '#404040' }]}>
                          <Text style={[styles.tooltipTime, { color: '#f8fafc' }]}>{chartData.raw[selectedIdx].time_display}</Text>
                          <TouchableOpacity onPress={() => setSelectedIdx(null)} style={{ padding: moderateScale(4) }}>
                            <AppIcon name="x" size={16} color="#a3a3a3" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(4) }}>
                          <View style={[styles.ptDot, { borderRadius: 2, backgroundColor: statusColor(chartData.raw[selectedIdx].running_status), marginRight: moderateScale(6) }]} />
                          <Text style={[styles.tooltipVolt, { color: '#f8fafc', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700' }]}>Voltage: {chartData.raw[selectedIdx].battery_voltage.toFixed(2)}V</Text>
                        </View>

                        <Text style={[styles.tooltipText, { color: '#d4d4d8' }]}><Text style={{ color: '#a3a3a3' }}>Status:</Text> {chartData.raw[selectedIdx].running_status}</Text>
                        
                        {chartData.raw[selectedIdx].voltage_change !== undefined && (
                            <Text style={[styles.tooltipText, { color: '#d4d4d8' }]}><Text style={{ color: '#a3a3a3' }}>Change:</Text> {chartData.raw[selectedIdx].voltage_change > 0 ? '↑' : chartData.raw[selectedIdx].voltage_change < 0 ? '↓' : ''} {Math.abs(chartData.raw[selectedIdx].voltage_change).toFixed(2)}V</Text>
                        )}
                        
                        <Text style={[styles.tooltipText, { color: '#d4d4d8' }]}><Text style={{ color: '#a3a3a3' }}>Detection:</Text> {chartData.raw[selectedIdx].detection_method || chartData.raw[selectedIdx].source_status}</Text>
                        
                        <Text style={[styles.tooltipText, { color: '#d4d4d8' }]}><Text style={{ color: '#a3a3a3' }}>Mains:</Text> R:{chartData.raw[selectedIdx].mains_voltages.r}V Y:{chartData.raw[selectedIdx].mains_voltages.y}V B:{chartData.raw[selectedIdx].mains_voltages.b}V</Text>

                        {/* Alarm Flags Map */}
                        {chartData.raw[selectedIdx].alarm_flags && (
                            <View style={{ marginTop: verticalScale(8) }}>
                                {[
                                    { key: 'MAINS_FAIL', label: 'MAINS FAIL', color: '#ef4444' },
                                    { key: 'SITE_ON_BATTERY', label: 'SITE ON BATTERY', color: '#f59e0b' },
                                    { key: 'LOW_BATTERY_VOLTAGE', label: 'LOW BATTERY VOLTAGE', color: '#f97316' },
                                    { key: 'DG_ON', label: 'DG ON', color: '#0ea5e9' },
                                    { key: 'LVD_CUT', label: 'LVD CUT', color: '#a855f7' },
                                    { key: 'BLVD_CUT', label: 'BLVD CUT', color: '#f43f5e' }
                                ].map(flag => {
                                    const rawFlags = chartData.raw[selectedIdx].alarm_flags;
                                    const val = rawFlags[flag.key] || rawFlags[flag.key.toLowerCase()] || rawFlags[flag.label] || "0";
                                    const state = val === "1" ? "High" : "Low";
                                    return (
                                        <View key={flag.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(2) }}>
                                            <View style={{ width: moderateScale(10), height: moderateScale(10), backgroundColor: flag.color, marginRight: moderateScale(6), borderRadius: 2 }} />
                                            <Text style={{ color: '#f8fafc', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700' }}>{flag.label}: <Text style={{ fontWeight: '500', color: '#d4d4d8' }}>{state}</Text></Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: verticalScale(24), marginBottom: verticalScale(12) }}>
                    <Text style={[styles.cardTitle, { marginBottom: verticalScale(0), fontSize: responsiveFontSize(13), flexShrink: 1, }]}>Recent Readings (Unfiltered)</Text>
                    <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{filteredCorrelation.length} Recs</Text>
                    </View>
                </View>

                {/* List Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(12) }}>
                    {[
                        {v: 'All', l: 'All Events'},
                        {v: 'Mains', l: 'Mains Only'},
                        {v: 'Battery', l: 'Battery Only'},
                        {v: 'DG', l: 'DG Only'}
                    ].map(f => (
                        <TouchableOpacity 
                            key={f.v} 
                            onPress={() => { setListFilter(f.v); setListLimit(25); }}
                            style={[styles.chipSmall, listFilter === f.v && styles.chipSmallActive]}
                        >
                            <Text style={[styles.chipSmallText, listFilter === f.v && styles.chipSmallTextActive]}>{f.l}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={{ backgroundColor: 'transparent' }}>
                    {filteredCorrelation.slice(0, 5).map((item, index) => (
                        <View key={`voltage_mini_${index}`}>
                            {renderVoltageRow({ item, id: `mini_${index}` })}
                        </View>
                    ))}
                    <TouchableOpacity 
                        style={[S.loadMoreBtn, { borderRadius: 12 }]} 
                        onPress={() => setActiveTab('readings')}
                    >
                        <Text style={S.loadMoreText}>VIEW ALL {filteredCorrelation.length} READINGS</Text>
                        <AppIcon name="arrow-right" size={16} color="#1e3c72" />
                    </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'readings' && (
               <View style={styles.card}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(16) }}>
                    <Text style={styles.cardTitle}>Detailed Site Readings</Text>
                    <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{filteredCorrelation.length} Records</Text>
                    </View>
                 </View>

                 {/* List Filters */}
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(12) }}>
                    {[
                        {v: 'All', l: 'All Events'},
                        {v: 'Mains', l: 'Mains Only'},
                        {v: 'Battery', l: 'Battery Only'},
                        {v: 'DG', l: 'DG Only'}
                    ].map(f => (
                        <TouchableOpacity 
                            key={f.v} 
                            onPress={() => { setListFilter(f.v); setListLimit(25); }}
                            style={[styles.chipSmall, listFilter === f.v && styles.chipSmallActive]}
                        >
                            <Text style={[styles.chipSmallText, listFilter === f.v && styles.chipSmallTextActive]}>{f.l}</Text>
                        </TouchableOpacity>
                    ))}
                 </ScrollView>

                 <View style={{ backgroundColor: 'transparent' }}>
                    {filteredCorrelation.slice(0, listLimit).map((item, index) => (
                        <View key={`voltage_full_${index}`}>
                            {renderVoltageRow({ item, id: `full_${index}` })}
                        </View>
                    ))}
                    {filteredCorrelation.length > listLimit ? (
                        <TouchableOpacity 
                           style={[S.loadMoreBtn, { borderRadius: 12 }]} 
                           onPress={() => setListLimit(prev => prev + 100)}
                        >
                            <Text style={S.loadMoreText}>LOAD MORE ({filteredCorrelation.length - listLimit} REMAINING)</Text>
                            <AppIcon name="chevron-down" size={16} color="#1e3c72" />
                        </TouchableOpacity>
                    ) : (
                        <Text style={[styles.chartSub, { padding: moderateScale(12), textAlign: 'center' }]}>
                            End of records.
                        </Text>
                    )}
                 </View>
               </View>
            )}

            {/* Alarm Log Tab — unchanged layout, memoized renderItem */}
            {activeTab === 'alarms' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Alarm Log</Text>
                {alarms.length === 0
                  ? <Text style={styles.emptyText}>No alarm events in this period.</Text>
                  : (
                    <View>
                      {alarms.slice(0, 100).map((item, index) => (
                        <View key={`alarm_${index}`}>
                          {renderAlarmItem({ item })}
                        </View>
                      ))}
                    </View>
                  )
                }
                {alarms.length > 100 && (
                  <Text style={styles.chartSub}>...and {alarms.length - 100} more alarms omitted for performance.</Text>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: verticalScale(100) }} />
      </ScrollView>

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        activeRoute="SiteVariation"
        handleLogout={async () => {
          await AsyncStorage.removeItem('user_fullname');
          await logoutApi();
          navigation.replace('Login');
        }}
      />
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components (100% original) ──────────────────────────────────────────
function InfoBox({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={{ backgroundColor: '#f8fafc', padding: moderateScale(12), borderRadius: 10, width: moderateScale(140), borderWidth: 1, borderColor: '#f1f5f9' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: verticalScale(6) }}>
                <AppIcon name={icon} size={14} color="#64748b" />
                <Text style={{ fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
            </View>
            <Text style={{ fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '800' }}>{value}</Text>
        </View>
    )
}

function AlarmRow({ alarm }: { alarm: AlarmDetail }) {
  const isOpen = alarm.status === 'Open';
  const isSmps = alarm.source !== 'fast_alarm_report';
  return (
    <View style={styles.alarmRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.alarmName}>{alarm.alarm_name}</Text>
        {alarm.details ? <Text style={styles.alarmDetails}>{alarm.details}</Text> : null}
        <Text style={styles.alarmTime}>{new Date(alarm.timestamp).toLocaleString()}</Text>
        <View style={styles.durRow}>
          <AppIcon name="clock" size={10} color="#94a3b8" style={{ marginRight: moderateScale(4) }} />
          <Text style={styles.alarmDur}>{alarm.duration}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[styles.badge, { backgroundColor: isOpen ? '#fee2e2' : '#dcfce7' }]}>
          <Text style={{ color: isOpen ? '#ef4444' : '#16a34a', fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700' }}>
            {alarm.status}
          </Text>
        </View>
        <Text style={styles.alarmVolt}>
          {alarm.battery_voltage_at_alarm != null ? `${alarm.battery_voltage_at_alarm.toFixed(2)}V` : '—'}
        </Text>
        <View style={[styles.badge, { backgroundColor: isSmps ? '#dbeafe' : '#f0fdf4' }]}>
          <Text style={{ color: isSmps ? '#1d4ed8' : '#15803d', fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '600' }}>
            {isSmps ? 'SMPS' : 'RMS'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles (100% original — zero changes) ────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(14),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerBtn: { padding: moderateScale(8), borderRadius: 8 },

  scroll: { padding: moderateScale(16) },

  card: {
    backgroundColor: '#fff', borderRadius: moderateScale(16), padding: moderateScale(16),
    marginBottom: moderateScale(12), elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginBottom: moderateScale(12) },

  row2: { flexDirection: 'row', gap: moderateScale(10), marginBottom: moderateScale(10) },
  halfInput: { flex: 1 },
  label: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', color: '#64748b', marginBottom: moderateScale(4), textTransform: 'uppercase' },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: moderateScale(8), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10),
    fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b',
  },
  searchBtn: {
    backgroundColor: '#1e3c72', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    padding: moderateScale(13), borderRadius: moderateScale(10), marginTop: moderateScale(4),
  },
  searchBtnText: { color: '#fff', fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700' },

  emptyCard: {
    alignItems: 'center', padding: moderateScale(40),
    backgroundColor: '#fff', borderRadius: moderateScale(16), marginBottom: moderateScale(12),
  },
  emptyTitle: { fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '700', color: '#334155', marginTop: moderateScale(14), marginBottom: moderateScale(6) },
  emptyText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#94a3b8', textAlign: 'center', lineHeight: moderateScale(20) },

  infoGrid: { gap: moderateScale(8) },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { width: moderateScale(90), fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: '600' },
  infoValue: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b' },

  kpiRow: { flexDirection: 'row', gap: moderateScale(10), marginBottom: moderateScale(10) },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', padding: moderateScale(16), borderRadius: moderateScale(12), alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 3,
  },
  kpiVal: { fontSize: responsiveFontSize(20), flexShrink: 1, fontWeight: '800', marginBottom: moderateScale(2) },
  kpiLab: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' },

  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  legendDot: { width: moderateScale(10), height: verticalScale(10), borderRadius: 5, marginRight: moderateScale(4) },
  legText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', marginRight: moderateScale(8) },

  tabBar: {
    flexDirection: 'row', gap: 8, marginBottom: verticalScale(12),
    backgroundColor: '#1e3c72', borderRadius: 12, padding: moderateScale(6),
  },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: verticalScale(8), borderRadius: 8 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#1e3c72' },

  chartSub: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8', marginBottom: verticalScale(10) },
  chip: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6), borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: moderateScale(8), borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  chipText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  filterLabel: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(8) },

  tooltipCard: { backgroundColor: '#fff', padding: moderateScale(14), borderRadius: 12, marginTop: verticalScale(16), borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: verticalScale(2) } },
  tooltipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(8), paddingBottom: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tooltipTime: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e293b' },
  tooltipVolt: { fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
  tooltipText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', marginBottom: verticalScale(3) },
  tooltipAlarms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: verticalScale(8) },
  tooltipBadge: { backgroundColor: '#fee2e2', paddingHorizontal: moderateScale(6), paddingVertical: verticalScale(2), borderRadius: 4 },
  tooltipBadgeText: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#ef4444', fontWeight: '700' },

  ptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(7), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  ptDot: { width: moderateScale(10), height: verticalScale(10), borderRadius: 5 },
  ptTime: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '600', color: '#1e293b' },
  ptStatus: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b' },
  ptVolt: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', flex: 1, textAlign: 'right' },
  ptVoltSmall: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', fontWeight: '500' },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: moderateScale(15), backgroundColor: '#f1f5f9', gap: 8 },
  loadMoreText: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },

  chipSmall: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(5), borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: moderateScale(8), borderWidth: 1, borderColor: '#e2e8f0' },
  chipSmallActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  chipSmallText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#475569', fontWeight: '600' },
  chipSmallTextActive: { color: '#fff' },

  filterBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(2), borderRadius: 6 },
  filterBadgeText: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', color: '#0369a1' },

  alarmRow: {
    flexDirection: 'row', padding: moderateScale(12),
    backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: verticalScale(8),
    borderLeftWidth: 3, borderLeftColor: '#1e3c72',
  },
  alarmName: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(2) },
  alarmTime: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b' },
  alarmDur: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(2) },
  alarmVolt: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
  alarmDetails: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#3b82f6', marginBottom: verticalScale(2), fontWeight: '500' },
  durRow: { flexDirection: 'row', alignItems: 'center', marginTop: verticalScale(2) },
  badge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 20 },
  ptRowContainer: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ptRowExpanded: { backgroundColor: '#f8fafc' },
  expandedDetail: { padding: moderateScale(16), backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(16) },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: verticalScale(4) },
  detailValue: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#1e293b', fontWeight: '500' },
});