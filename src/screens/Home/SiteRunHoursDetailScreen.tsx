import React, { useEffect, useState, useCallback } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteRunHoursDetail'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToSeconds(t: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length !== 3) return 0;
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
}

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function totalRunning(mains: string, batt: string, dg: string): string {
  const total = timeToSeconds(mains) + timeToSeconds(batt) + timeToSeconds(dg);
  const result = secondsToTime(total);
  return result === '23:59:59' ? '24:00:00' : result;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start, end };
}

function dateToString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtDisplay(dateStr: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(t: string): string {
  if (!t) return 'N/A';
  if (t.includes('T')) return t.split('T')[1].substring(0, 8);
  return t.length > 8 ? t.substring(0, 8) : t;
}

function badgeColor(source: string): { bg: string; fg: string } {
  if (source === 'SOEB') return { bg: '#d5f4e6', fg: '#27ae60' };
  if (source === 'SOBT') return { bg: '#fff3cd', fg: '#856404' };
  if (source === 'SODG') return { bg: '#d1ecf1', fg: '#0c5460' };
  return { bg: '#f8d7da', fg: '#721c24' };
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function convertToCSV(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SiteRunHoursDetailScreen({ route, navigation }: Props) {
  const { imei, siteName } = route.params;
  const [records, setRecords] = useState<any[]>([]);
  const [siteInfo, setSiteInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { start: defStart, end: defEnd } = defaultDateRange();
  const [startDate, setStartDate] = useState<Date>(defStart);
  const [endDate, setEndDate] = useState<Date>(defEnd);
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const loadData = useCallback(async (sd: Date, ed: Date) => {
    const sdStr = dateToString(sd);
    const edStr = dateToString(ed);
    setLoading(true);
    try {
      const res = await api.getDatewiseRunningDuration(imei, sdStr, edStr);
      setSiteInfo({ site_id: res.site_id, site_name: res.site_name, imei: res.imei, total: res.records_found });
      setRecords(res.data || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load run hours data');
    } finally {
      setLoading(false);
    }
  }, [imei]);

  useEffect(() => { loadData(startDate, endDate); }, []);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    if (!records.length) return null;
    let tMains = 0, tBatt = 0, tDG = 0, tNonComm = 0, tRunning = 0, tSlreb = 0, tSlrbt = 0, tSlrdg = 0;
    records.forEach(r => {
      tMains += timeToSeconds(r.mains_duration);
      tBatt += timeToSeconds(r.battery_duration);
      tDG += timeToSeconds(r.dg_duration);
      tNonComm += timeToSeconds(r.non_comm_duration);
      tRunning += timeToSeconds(r.total_running_duration || totalRunning(r.mains_duration, r.battery_duration, r.dg_duration));
      tSlreb += timeToSeconds(r.slreb_duration || '00:00:00');
      tSlrbt += timeToSeconds(r.slrbt_duration || '00:00:00');
      tSlrdg += timeToSeconds(r.slrdg_duration || '00:00:00');
    });
    const n = records.length;
    return {
      avgMains: secondsToTime(tMains / n),
      avgBatt: secondsToTime(tBatt / n),
      avgDG: secondsToTime(tDG / n),
      avgSlreb: secondsToTime(tSlreb / n),
      avgSlrbt: secondsToTime(tSlrbt / n),
      avgSlrdg: secondsToTime(tSlrdg / n),
      avgNonComm: secondsToTime(tNonComm / n),
      avgRunning: secondsToTime(tRunning / n),
      days: n,
      totalMains: secondsToTime(tMains),
      totalBatt: secondsToTime(tBatt),
      totalDG: secondsToTime(tDG),
      totalSlreb: secondsToTime(tSlreb),
      totalSlrbt: secondsToTime(tSlrbt),
      totalSlrdg: secondsToTime(tSlrdg),
      totalNonComm: secondsToTime(tNonComm),
      totalRunning: secondsToTime(tRunning),
    };
  }, [records]);

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!records.length) { Alert.alert('No Data', 'Nothing to export'); return; }
    setExporting(true);
    try {
      const rows = records.map((r, i) => ({
        'S.No': i + 1,
        'Date': fmtDisplay(r.date),
        'Mains Duration (SOEB)': r.mains_duration,
        'Battery Duration (SOBT)': r.battery_duration,
        'DG Duration (SODG)': r.dg_duration,
        'SLREB Duration': r.slreb_duration || '00:00:00',
        'SLRBT Duration': r.slrbt_duration || '00:00:00',
        'SLRDG Duration': r.slrdg_duration || '00:00:00',
        'Total Running Duration': r.total_running_duration || totalRunning(r.mains_duration, r.battery_duration, r.dg_duration),
        'Non-Comm Duration': r.non_comm_duration,
        'Primary Source': r.primary_source,
        'Sessions Count': (r.sessions || []).length,
      }));
      const csv = convertToCSV(rows);
      const sdStr = dateToString(startDate);
      const edStr = dateToString(endDate);
      const fileName = `RunHours_${imei}_${sdStr}_to_${edStr}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(filePath, csv, 'utf8');
      await Share.open({ title: 'Export Run Hours', url: `file://${filePath}`, type: 'text/csv', filename: fileName, showAppsToView: true });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Export Error', 'Failed to generate CSV');
    } finally {
      setExporting(false);
    }
  };

  // ── Render record row ─────────────────────────────────────────────────────
  const renderRecord = (record: any, idx: number) => {
    const rowId = `row-${record.date}`;
    const isExpanded = expandedRow === rowId;
    const mains = record.mains_duration || '00:00:00';
    const batt = record.battery_duration || '00:00:00';
    const dg = record.dg_duration || '00:00:00';
    const nonComm = record.non_comm_duration || '00:00:00';
    const runTotal = totalRunning(mains, batt, dg);
    const src = record.primary_source || 'Non Comm';
    const badgeFmt = badgeColor(src);
    const sessions: any[] = record.sessions || [];

    return (
      <View key={rowId} style={[styles.recordCard, idx % 2 === 0 && styles.recordCardAlt]}>
        {/* Date + Primary Source */}
        <View style={styles.recordHeader}>
          <Text style={styles.recordDate}>{fmtDisplay(record.date)}</Text>
          <View style={[styles.srcBadge, { backgroundColor: badgeFmt.bg }]}>
            <Text style={[styles.srcBadgeTxt, { color: badgeFmt.fg }]}>{src}</Text>
          </View>
        </View>

        {/* Duration grid */}
        <View style={styles.durationGrid}>
          <DurCell label="Mains (SOEB)" val={mains} color="#27ae60" />
          <DurCell label="Battery (SOBT)" val={batt} color="#856404" />
          <DurCell label="DG (SODG)" val={dg} color="#0c5460" />
          <DurCell label="SLREB" val={record.slreb_duration || '00:00:00'} color="#7c3aed" />
          <DurCell label="SLRBT" val={record.slrbt_duration || '00:00:00'} color="#db2777" />
          <DurCell label="SLRDG" val={record.slrdg_duration || '00:00:00'} color="#0284c7" />
          <DurCell label="Non-Comm" val={nonComm} color="#dc2626" />
          <DurCell label="Total Running" val={record.total_running_duration || runTotal} color="#2980b9" highlight />
        </View>

        {/* Sessions toggle */}
        {sessions.length > 0 && (
          <TouchableOpacity style={styles.sessionToggle} onPress={() => setExpandedRow(isExpanded ? null : rowId)}>
            <AppIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#01497C" />
            <Text style={styles.sessionToggleTxt}>
              {isExpanded ? 'Hide Sessions' : `Show Sessions (${sessions.length})`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Session Details */}
        {isExpanded && (
          <View style={styles.sessionBox}>
            <Text style={styles.sessionBoxTitle}>Session Details</Text>
            {sessions.map((s: any, si: number) => {
              const sc = badgeColor(s.source === 'Non Comm' ? 'Non Comm' : s.source);
              return (
                <View key={si} style={[styles.sessionItem, { borderLeftColor: sc.fg }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionSrc, { color: sc.fg }]}>{s.source}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.sessionTime}>{fmtTime(s.start_time)}</Text>
                      <AppIcon name="arrow-right" size={10} color="#64748b" style={{ marginHorizontal: moderateScale(4) }} />
                      <Text style={styles.sessionTime}>{fmtTime(s.end_time)}</Text>
                    </View>
                  </View>
                  <View style={[styles.sessionDurBadge, { backgroundColor: sc.fg }]}>
                    <Text style={styles.sessionDurTxt}>{s.duration || '--'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Site Run Hours"
        subtitle={siteName || imei}
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[{ icon: exporting ? 'loader' : 'download', onPress: handleExport }]}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: verticalScale(120) }}>

        {/* ── Date Filter ── */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* Start Date */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Start Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('start')}>
                <AppIcon name="calendar" size={14} color="#01497C" />
                <Text style={styles.dateBtnTxt}>{fmtDisplay(dateToString(startDate))}</Text>
              </TouchableOpacity>
            </View>
            {/* End Date */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>End Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('end')}>
                <AppIcon name="calendar" size={14} color="#01497C" />
                <Text style={styles.dateBtnTxt}>{fmtDisplay(dateToString(endDate))}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterBtnRow}>
            <TouchableOpacity style={styles.applyBtn} onPress={() => loadData(startDate, endDate)}>
              <Text style={styles.applyBtnTxt}>Apply Filter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={() => {
              const { start, end } = defaultDateRange();
              setStartDate(start); setEndDate(end);
              loadData(start, end);
            }}>
              <Text style={styles.resetBtnTxt}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Native DateTimePicker */}
        {showPicker && (
          <DateTimePicker
            value={showPicker === 'start' ? startDate : endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') setShowPicker(null);
              if (event.type === 'dismissed') { setShowPicker(null); return; }
              if (selectedDate) {
                if (showPicker === 'start') setStartDate(selectedDate);
                else setEndDate(selectedDate);
              }
              if (Platform.OS === 'ios') setShowPicker(null);
            }}
          />
        )}

        {/* ── Site Info ── */}
        <View style={styles.siteInfoCard}>
          <View style={styles.infoItem}><Text style={styles.infoLbl}>Global ID</Text><Text style={styles.infoVal}>{siteInfo.site_id || '--'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLbl}>Site Name</Text><Text style={styles.infoVal}>{siteInfo.site_name || siteName || '--'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLbl}>IMEI</Text><Text style={styles.infoVal}>{siteInfo.imei || imei}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLbl}>Records</Text><Text style={styles.infoVal}>{siteInfo.total ?? '--'}</Text></View>
        </View>

        {/* ── Stats Summary ── */}
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard label="Avg Mains" val={stats.avgMains} color="#27ae60" />
            <StatCard label="Avg Battery" val={stats.avgBatt} color="#856404" />
            <StatCard label="Avg DG" val={stats.avgDG} color="#0c5460" />
            <StatCard label="Avg SLREB" val={stats.avgSlreb} color="#7c3aed" />
            <StatCard label="Avg SLRBT" val={stats.avgSlrbt} color="#db2777" />
            <StatCard label="Avg SLRDG" val={stats.avgSlrdg} color="#0284c7" />
            <StatCard label="Avg Non-Comm" val={stats.avgNonComm} color="#dc2626" />
            <StatCard label="Avg Running" val={stats.avgRunning} color="#2980b9" />
            <StatCard label="Days Analyzed" val={String(stats.days)} color="#01497C" />
          </View>
        )}

        {/* ── Records ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Run Hours Analysis</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#01497C" style={{ marginTop: verticalScale(30) }} />
          ) : records.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppIcon name="inbox" size={36} color="#ccc" />
              <Text style={styles.emptyTxt}>No data for selected date range</Text>
            </View>
          ) : (
            [...records].sort((a, b) => b.date.localeCompare(a.date)).map(renderRecord)
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Footer Summary ── */}
      {stats && (
        <View style={styles.footer}>
          <FooterItem label="Mains" val={stats.totalMains} />
          <View style={styles.footerDivider} />
          <FooterItem label="Battery" val={stats.totalBatt} />
          <View style={styles.footerDivider} />
          <FooterItem label="DG" val={stats.totalDG} />
          <View style={styles.footerDivider} />
          <FooterItem label="SLREB" val={stats.totalSlreb} />
          <View style={styles.footerDivider} />
          <FooterItem label="SLRBT" val={stats.totalSlrbt} />
          <View style={styles.footerDivider} />
          <FooterItem label="SLRDG" val={stats.totalSlrdg} />
          <View style={styles.footerDivider} />
          <FooterItem label="Non-Comm" val={stats.totalNonComm} />
          <View style={styles.footerDivider} />
          <FooterItem label="Total" val={stats.totalRunning} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DurCell = ({ label, val, color, highlight }: { label: string; val: string; color: string; highlight?: boolean }) => (
  <View style={[styles.durCell, highlight && styles.durCellHighlight]}>
    <Text style={styles.durLabel}>{label}</Text>
    <Text style={[styles.durVal, { color }]}>{val}</Text>
  </View>
);

const StatCard = ({ label, val, color }: { label: string; val: string; color: string }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <Text style={[styles.statVal, { color }]}>{val}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const FooterItem = ({ label, val, highlight }: { label: string; val: string; highlight?: boolean }) => (
  <View style={styles.footerItem}>
    <Text style={styles.footerLabel}>{label}</Text>
    <Text style={[styles.footerVal, highlight && styles.footerValHighlight]}>{val}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF2FA' },

  // Filter
  filterCard: { margin: moderateScale(12), backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), elevation: 2 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: verticalScale(10) },
  filterField: { flex: 1 },
  filterLabel: { fontSize: responsiveFontSize(11), color: '#01497C', fontWeight: '700', marginBottom: verticalScale(4), textTransform: 'uppercase' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#01497C', borderRadius: 8, padding: moderateScale(10), backgroundColor: '#F0F7FF' },
  dateBtnTxt: { fontSize: responsiveFontSize(13), color: '#01497C', fontWeight: '700', flex: 1 },
  filterBtnRow: { flexDirection: 'row', gap: 10 },
  applyBtn: { flex: 1, backgroundColor: '#01497C', borderRadius: 8, paddingVertical: verticalScale(10), alignItems: 'center' },
  applyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(14) },
  resetBtn: { flex: 1, backgroundColor: '#95a5a6', borderRadius: 8, paddingVertical: verticalScale(10), alignItems: 'center' },
  resetBtnTxt: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(14) },

  // Site Info
  siteInfoCard: { marginHorizontal: moderateScale(12), marginBottom: verticalScale(10), backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), elevation: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { minWidth: '45%', flex: 1 },
  infoLbl: { fontSize: responsiveFontSize(10), color: '#2A6F97', fontWeight: '700', textTransform: 'uppercase', marginBottom: verticalScale(2) },
  infoVal: { fontSize: responsiveFontSize(13), color: '#1C2F3E', fontWeight: '600' },

  // Stats
  statsGrid: { marginHorizontal: moderateScale(12), marginBottom: verticalScale(10), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { backgroundColor: '#fff', borderRadius: 10, padding: moderateScale(8), alignItems: 'center', borderTopWidth: 3, elevation: 2, width: '31.5%', marginBottom: verticalScale(8) },
  statVal: { fontSize: responsiveFontSize(13), fontWeight: '800', marginBottom: verticalScale(4) },
  statLabel: { fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },

  // Section
  section: { marginHorizontal: moderateScale(12) },
  sectionTitle: { fontSize: responsiveFontSize(15), fontWeight: '700', color: '#01497C', marginBottom: verticalScale(10) },

  // Record card
  recordCard: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), marginBottom: verticalScale(10), elevation: 2 },
  recordCardAlt: { backgroundColor: '#FAFCFF' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(12) },
  recordDate: { fontSize: responsiveFontSize(15), fontWeight: '700', color: '#01497C' },
  srcBadge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(4), borderRadius: 12 },
  srcBadgeTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', textTransform: 'uppercase' },

  // Duration grid
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: verticalScale(10) },
  durCell: { backgroundColor: '#F0F7FF', borderRadius: 8, padding: moderateScale(8), width: '23.5%', marginBottom: verticalScale(8) },
  durCellHighlight: { backgroundColor: '#EBF5FB' },
  durLabel: { fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: verticalScale(4) },
  durVal: { fontSize: responsiveFontSize(12), fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Session toggle
  sessionToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: verticalScale(4), paddingVertical: verticalScale(6), paddingHorizontal: moderateScale(10), backgroundColor: '#F0F7FF', borderRadius: 8, alignSelf: 'flex-start' },
  sessionToggleTxt: { fontSize: responsiveFontSize(12), color: '#01497C', fontWeight: '600' },

  // Session details
  sessionBox: { marginTop: verticalScale(10), backgroundColor: '#F8FAFC', borderRadius: 8, padding: moderateScale(12), borderWidth: 1, borderColor: '#E2EBF4' },
  sessionBoxTitle: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#01497C', marginBottom: verticalScale(8), textTransform: 'uppercase' },
  sessionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: moderateScale(8), borderRadius: 6, borderLeftWidth: 3, marginBottom: verticalScale(6) },
  sessionSrc: { fontSize: responsiveFontSize(12), fontWeight: '700', marginBottom: verticalScale(2) },
  sessionTime: { fontSize: responsiveFontSize(11), color: '#64748b' },
  sessionDurBadge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 10 },
  sessionDurTxt: { color: '#fff', fontSize: responsiveFontSize(10), fontWeight: '700' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: verticalScale(40) },
  emptyTxt: { color: '#94A3B8', marginTop: verticalScale(10), fontSize: responsiveFontSize(13), fontStyle: 'italic' },

  // Sticky footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 3, borderTopColor: '#01497C', flexDirection: 'row', paddingVertical: verticalScale(10), paddingHorizontal: moderateScale(4), elevation: 10 },
  footerItem: { flex: 1, alignItems: 'center' },
  footerDivider: { width: 1, backgroundColor: '#E2EBF4' },
  footerLabel: { fontSize: responsiveFontSize(9), color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: verticalScale(2) },
  footerVal: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#1C2F3E' },
  footerValHighlight: { color: '#2980b9' },
});



