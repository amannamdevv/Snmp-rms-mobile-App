import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupUsage'>;
type Tab = 'all' | 'dg' | 'battery' | 'both';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtDisplay(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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

export default function BackupUsageScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const res = await api.getSitesWentOnBackupCount(dateToStr(date));
      setData(res);
    } catch (e) {
      Alert.alert('Error', 'Failed to load backup usage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const total = data?.total_sites || data?.total || 0;
  const dgCount = data?.sites_went_on_dg || data?.dg_count || 0;
  const battCount = data?.sites_went_on_battery || data?.battery_count || 0;
  const bothCount = data?.sites_went_on_both || data?.both_count || 0;
  const backupTotal = data?.total_sites_with_backup || data?.backup_total || 0;

  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';

  const tabSites: Record<Tab, any[]> = {
    all: [
      ...(data?.sites_on_dg_list || data?.sites_on_dg || []).map((s: any) => ({ ...s, type: 'dg' })),
      ...(data?.sites_on_battery_list || data?.sites_on_battery || []).map((s: any) => ({ ...s, type: 'battery' })),
      ...(data?.sites_on_both_list || data?.sites_on_both || []).map((s: any) => ({ ...s, type: 'both' })),
    ],
    dg: (data?.sites_on_dg_list || data?.sites_on_dg || []).map((s: any) => ({ ...s, type: 'dg' })),
    battery: (data?.sites_on_battery_list || data?.sites_on_battery || []).map((s: any) => ({ ...s, type: 'battery' })),
    both: (data?.sites_on_both_list || data?.sites_on_both || []).map((s: any) => ({ ...s, type: 'both' })),
  };

  const sites = useMemo(() => {
    let list = tabSites[activeTab];
    if (searchQuery) {
      const low = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.site_name?.toLowerCase().includes(low) ||
        s.global_id?.toLowerCase().includes(low) ||
        s.site_id?.toLowerCase().includes(low) ||
        s.imei?.toLowerCase().includes(low)
      );
    }
    return list;
  }, [tabSites, activeTab, searchQuery]);

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!data || !sites.length) {
      Alert.alert('No Data', 'Nothing to export in this category');
      return;
    }
    setExporting(true);
    try {
      const rows = sites.map((s, i) => ({
        'S.No': i + 1,
        'Global ID': s.global_id || '',
        'Site ID': s.site_id,
        'Site Name': s.site_name,
        'IMEI': s.imei,
        'Backup Type': s.type === 'dg' ? 'DG' : s.type === 'battery' ? 'Battery' : 'DG + Battery',
        'DG Duration': s.dg_duration || '00:00:00',
        'Battery Duration': s.battery_duration || '00:00:00',
        'Mains Duration': s.mains_duration || '00:00:00',
      }));
      const csv = convertToCSV(rows);
      const fileName = `BackupUsage_${activeTab}_${dateToStr(selectedDate)}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(filePath, csv, 'utf8');
      
      // Fixed Share call for Android
      await Share.open({
        title: 'Export Backup Usage',
        url: `file://${filePath}`,
        type: 'text/csv',
        filename: fileName,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export Error', 'Failed to generate or share CSV');
        console.error('[Export Error]', e);
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Badge config ─────────────────────────────────────────────────────────
  const badgeCfg: Record<string, { label: string; bg: string; fg: string }> = {
    dg:      { label: 'DG',          bg: '#fdebd0', fg: '#b9770e' },
    battery: { label: 'Battery',     bg: '#fff3cd', fg: '#856404' },
    both:    { label: 'DG + Battery', bg: '#e8daef', fg: '#7d3c98' },
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="DG & Battery Backup Usage"
        subtitle="Track sites that went on backup"
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[{ icon: exporting ? 'loader' : 'download', onPress: handleExport }]}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: verticalScale(30) }}>

        {/* ── Date Picker ── */}
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Select Date</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
              <AppIcon name="calendar" size={15} color="#01497C" />
              <Text style={styles.dateBtnTxt}>{fmtDisplay(selectedDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={() => fetchData(selectedDate)}>
              <Text style={styles.applyBtnTxt}>Check Backup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            maximumDate={new Date()}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (event.type === 'dismissed') { setShowPicker(false); return; }
              if (date) setSelectedDate(date);
              if (Platform.OS === 'ios') setShowPicker(false);
            }}
          />
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#01497C" style={{ marginTop: verticalScale(40) }} />
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <View style={styles.statsGrid}>
              <StatCard icon="bar-chart-2" label="Total Sites" value={total} color="#3498db" pct={null} />
              <StatCard icon="zap" label="Sites on DG" value={dgCount} color="#e67e22" pct={pct(dgCount)} />
              <StatCard icon="battery-charging" label="Sites on Battery" value={battCount} color="#f39c12" pct={pct(battCount)} />
              <StatCard icon="activity" label="Both DG & Battery" value={bothCount} color="#9b59b6" pct={pct(bothCount)} />
              <StatCard icon="check-circle" label="Total with Backup" value={backupTotal} color="#27ae60" pct={pct(backupTotal)} />
            </View>

            {/* ── Tabs ── */}
            <View style={styles.tabRow}>
              {(['all', 'dg', 'battery', 'both'] as Tab[]).map(tab => {
                const counts = { all: backupTotal, dg: dgCount, battery: battCount, both: bothCount };
                const labels = { all: `All (${counts.all})`, dg: `DG (${dgCount})`, battery: `Batt (${battCount})`, both: `Both (${bothCount})` };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>{labels[tab]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Search Bar */}
            <View style={styles.searchWrap}>
                <AppIcon name="search" size={14} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search Global ID, Name, ID, or IMEI..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {!!searchQuery && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <AppIcon name="x" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Sites List ── */}
            <View style={styles.section}>
              {sites.length === 0 ? (
                <View style={styles.emptyBox}>
                  <AppIcon name="inbox" size={36} color="#ccc" />
                  <Text style={styles.emptyTxt}>
                    {searchQuery ? 'No sites match your search' : 'No sites in this category'}
                  </Text>
                </View>
              ) : sites.map((site: any, idx: number) => {
                const cfg = badgeCfg[site.type] || badgeCfg.dg;
                return (
                  <View key={`${site.imei}-${idx}`} style={[styles.siteCard, idx % 2 === 0 && styles.siteCardAlt]}>
                    {/* Header */}
                    <View style={styles.siteCardHeader}>
                      <Text style={styles.siteId}>Global ID: {site.global_id || site.site_id}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.typeBadgeTxt, { color: cfg.fg }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    {/* Site Name → navigates to Run Hours */}
                    <TouchableOpacity
                      onPress={() => navigation.navigate('SiteRunHoursDetail', { imei: site.imei, siteName: site.site_name })}
                    >
                      <Text style={styles.siteName}>{site.site_name}</Text>
                    </TouchableOpacity>
                    {/* Durations */}
                    <View style={styles.durGrid}>
                      {site.dg_duration && site.dg_duration !== '00:00:00' && (
                        <DurRow icon="zap" label="DG Duration" val={site.dg_duration} color="#e67e22" />
                      )}
                      {site.battery_duration && site.battery_duration !== '00:00:00' && (
                        <DurRow icon="battery-charging" label="Battery Duration" val={site.battery_duration} color="#f39c12" />
                      )}
                      <DurRow icon="activity" label="Mains Duration" val={site.mains_duration || '00:00:00'} color="#27ae60" />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  dg: '#e67e22', battery: '#f39c12', both: '#9b59b6', total: '#27ae60',
};

const StatCard = ({ icon, label, value, color, pct }: any) => (
  <View style={[styles.statBox, { borderTopColor: color }]}>
    <View style={styles.statHeader}>
      <Text style={styles.statLabel}>{label}</Text>
      <AppIcon name={icon} size={18} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {pct && (
      <View style={styles.pctBar}>
        <View style={[styles.pctFill, { width: `${Math.min(parseFloat(pct), 100)}%`, backgroundColor: color }]} />
        <Text style={styles.pctTxt}>{pct}% of total</Text>
      </View>
    )}
  </View>
);

function DurRow({ icon, label, val, color }: { icon: string; label: string; val: string; color: string }) {
  return (
    <View style={styles.durRow}>
      <AppIcon name={icon} size={12} color={color} style={{ marginRight: moderateScale(4) }} />
      <Text style={styles.durLabel}>{label}:</Text>
      <Text style={[styles.durVal, { color }]}>{val}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF2FA' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: moderateScale(12), marginBottom: verticalScale(12), borderRadius: 10,
    paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), elevation: 2, gap: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: responsiveFontSize(13), color: '#0f172a', fontWeight: '500', padding: moderateScale(0) },

  // Filter
  filterCard: { margin: moderateScale(12), backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), elevation: 2 },
  filterLabel: { fontSize: responsiveFontSize(11), color: '#01497C', fontWeight: '700', marginBottom: verticalScale(8), textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#01497C', borderRadius: 8, padding: moderateScale(10), backgroundColor: '#F0F7FF' },
  dateBtnTxt: { fontSize: responsiveFontSize(13), color: '#01497C', fontWeight: '700', flex: 1 },
  applyBtn: { backgroundColor: '#01497C', borderRadius: 8, paddingHorizontal: moderateScale(16), justifyContent: 'center' },
  applyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(13) },

  // Stats
  statsGrid: { paddingHorizontal: moderateScale(12), paddingBottom: verticalScale(10) },
  statBox: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), elevation: 2, borderTopWidth: 4, marginBottom: verticalScale(10) },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) },
  statLabel: { fontSize: responsiveFontSize(11), color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  statValue: { fontSize: responsiveFontSize(24), fontWeight: '800', marginBottom: verticalScale(8) },
  pctBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pctFill: { height: verticalScale(4), borderRadius: 2, flex: 1 },
  pctTxt: { fontSize: responsiveFontSize(10), color: '#94a3b8', fontWeight: '700' },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: moderateScale(12), marginBottom: verticalScale(10), gap: 6 },
  tab: { flex: 1, paddingVertical: verticalScale(8), borderRadius: 8, borderWidth: 1.5, borderColor: '#d0e8f5', backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { backgroundColor: '#01497C', borderColor: '#01497C' },
  tabTxt: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#01497C' },
  tabTxtActive: { color: '#fff' },

  // Section
  section: { marginHorizontal: moderateScale(12) },

  // Site cards
  siteCard: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(14), marginBottom: verticalScale(10), elevation: 2 },
  siteCardAlt: { backgroundColor: '#FAFCFF' },
  siteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) },
  siteId: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#475569' },
  typeBadge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(3), borderRadius: 12 },
  typeBadgeTxt: { fontSize: responsiveFontSize(11), fontWeight: '700' },
  siteName: { fontSize: responsiveFontSize(14), color: '#2980b9', fontWeight: '700', textDecorationLine: 'underline', marginBottom: verticalScale(10) },
  durGrid: { gap: 5 },
  durRow: { flexDirection: 'row', alignItems: 'center' },
  durLabel: { fontSize: responsiveFontSize(12), color: '#64748b', fontWeight: '600', marginRight: moderateScale(4) },
  durVal: { fontSize: responsiveFontSize(12), fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: verticalScale(40) },
  emptyTxt: { color: '#94A3B8', marginTop: verticalScale(10), fontSize: responsiveFontSize(13), fontStyle: 'italic' },
});
