import React, { useEffect, useState, useCallback } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'NonCommSites'>;

// ─── Aging Bucket Card ────────────────────────────────────────────────────────
const AgingBucket = ({ label, count, color }: { label: string; count: number; color: string }) => (
  <View style={[styles.bucketCard, { borderTopColor: color }]}>
    <Text style={[styles.bucketCount, { color }]}>{count}</Text>
    <Text style={styles.bucketLabel}>{label}</Text>
  </View>
);

// ─── Days-offline badge color ─────────────────────────────────────────────────
const getDaysColor = (days: number | null): string => {
  if (days === null || days === undefined) return '#7f1d1d';
  if (days > 90) return '#7f1d1d';
  if (days > 60) return '#991b1b';
  if (days > 30) return '#dc2626';
  if (days > 7) return '#ea580c';
  return '#ca8a04';
};

// ─── Site Card ────────────────────────────────────────────────────────────────
const SiteCard = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const days = item.days_since_comm ?? null;
  const color = getDaysColor(days);
  const isCritical = days === null || days > 7;

  const lastComm = item.last_communication
    ? String(item.last_communication).replace('T', ' ').substring(0, 16)
    : 'Never communicated';

  const daysLabel = days !== null ? `${days} day${days !== 1 ? 's' : ''} offline` : 'Never comm';

  return (
    <TouchableOpacity
      style={[styles.card, isCritical && styles.cardCritical]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: moderateScale(10) }}>
          <Text style={styles.siteName} numberOfLines={2}>{item.site_name || '—'}</Text>
          <Text style={styles.siteId}>Global ID: {item.globel_id || item.global_id || item.site_id || '—'}</Text>
        </View>
        <View style={[styles.daysBadge, { backgroundColor: color + '18', borderColor: color }]}>
          <AppIcon name="wifi-off" size={11} color={color} style={{ marginRight: moderateScale(4) }} />
          <Text style={[styles.daysBadgeText, { color }]}>{daysLabel}</Text>
        </View>
      </View>

      {/* ── Divider ─────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Info Grid ───────────────────────────────────────── */}
      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <View style={styles.labelRow}>
            <AppIcon name="smartphone" size={12} color="#888" />
            <Text style={styles.infoLabel}>IMEI</Text>
          </View>
          <Text style={styles.infoValue}>{item.imei || '—'}</Text>
        </View>
        <View style={styles.infoCell}>
          <View style={styles.labelRow}>
            <AppIcon name="hash" size={12} color="#888" />
            <Text style={styles.infoLabel}>Site ID</Text>
          </View>
          <Text style={styles.infoValue}>{item.site_id || '—'}</Text>
        </View>
        <View style={styles.infoCell}>
          <View style={styles.labelRow}>
            <AppIcon name="clock" size={12} color="#888" />
            <Text style={styles.infoLabel}>Last Communication</Text>
          </View>
          <Text style={[styles.infoValue, { color: isCritical ? '#dc2626' : '#333' }]}>
            {lastComm}
          </Text>
        </View>
        <View style={styles.infoCell}>
          <View style={styles.labelRow}>
            <AppIcon name="battery" size={12} color="#888" />
            <Text style={styles.infoLabel}>Battery Voltage</Text>
          </View>
          <Text style={styles.infoValue}>{item.battery_v ? item.battery_v + ' V' : '—'}</Text>
        </View>
        <View style={styles.infoCell}>
          <View style={styles.labelRow}>
            <AppIcon name="map-pin" size={12} color="#888" />
            <Text style={styles.infoLabel}>Location</Text>
          </View>
          <Text style={styles.infoValue}>
            {[item.state_name, item.district_name, item.cluster_name]
              .filter(Boolean)
              .join(' / ') || '—'}
          </Text>
        </View>
      </View>

      {/* ── Last Alarms Section (New) ────────────────────────── */}
      {item.last_alarms && item.last_alarms.length > 0 && (
        <View style={styles.alarmSec}>
          <Text style={styles.secTitle}>Recent Activity / Alarms</Text>
          {item.last_alarms.slice(0, 3).map((a: any, i: number) => (
            <View key={i} style={styles.alarmRow}>
              <AppIcon name="alert-circle" size={10} color="#dc2626" />
              <Text style={styles.alarmName}>{a.alarm_name}</Text>
              <Text style={styles.alarmTime}>{a.create_dt.substring(5, 16)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Duration Bar ────────────────────────────────────── */}
      {days !== null && (
        <View style={styles.durationRow}>
          <View style={styles.durationBarBg}>
            <View
              style={[
                styles.durationBarFill,
                {
                  backgroundColor: color,
                  width: `${Math.min((days / 90) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.durationLabel, { color }]}>
            {days <= 7 ? '0–7 days' :
              days <= 30 ? '8–30 days' :
                days <= 60 ? '31–60 days' :
                  days <= 90 ? '61–90 days' : '90+ days'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NonCommSitesScreen({ navigation }: Props) {
  const { globalFilters } = useGlobalFilter();
  const [sites, setSites] = useState<any[]>([]);
  const [buckets, setBuckets] = useState<any>(null);
  const [totalSites, setTotalSites] = useState(0);

  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(globalFilters as Record<string, string>)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const fetchData = async (
    pageNum = 1,
    isRefresh = false,
    currentFilters = activeFilters,
  ) => {
    if (loading && !isRefresh) return;
    setLoading(true);

    try {
      // site-communication-statuss API expects "ctmids" not "customer_id"
      const mappedFilters: any = { ...currentFilters };
      if (mappedFilters.customer_id) {
        mappedFilters.ctmids = mappedFilters.customer_id;
        delete mappedFilters.customer_id;
      }
      if (pageNum === 1) {
        const bucketRes = await api.getNonCommAging(mappedFilters);
        // Fallback for different response types
        const bucketData = bucketRes.status === 'success' ? bucketRes.data : bucketRes;
        if (bucketData?.aging_buckets) {
          setBuckets(bucketData.aging_buckets);
          setTotalSites(bucketData.total_non_comm ?? bucketData.total_sites ?? 0);
        }
      }

      const listRes = await api.getNonCommSitesList(mappedFilters, pageNum, 10);
      // Robustly handle different response structures ( {sites: [...]}, {data: {sites: [...]}}, [...] )
      let listRaw = listRes.sites || (listRes.data?.sites || listRes.data || listRes);
      if (Array.isArray(listRaw)) {
        if (isRefresh) setSites(listRaw);
        else setSites(prev => [...prev, ...listRaw]);

        // Use pagination metadata if available, otherwise assume 10 items per page
        const meta = listRes.meta || listRes.data?.meta || {};
        setHasNext(listRes.has_next ?? meta.has_next ?? listRaw.length === 10);
        setPage(pageNum);
        if (pageNum === 1) setTotalSites(listRes.total_sites ?? meta.total_records ?? listRaw.length);
      }
    } catch (e) {
      console.error('[NonComm] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(1, true, activeFilters);
  }, [activeFilters]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // 1. Fetch the Excel binary data as an ArrayBuffer
      const response = await api.exportNonCommSites(activeFilters);

      // 2. Convert ArrayBuffer to Base64 (Reliable manual conversion)
      const buffer = new Uint8Array(response.data);
      const base64data = await new Promise<string>((resolve) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let output = '';
        const len = buffer.byteLength;
        for (let i = 0; i < len; i += 3) {
          const a = buffer[i];
          const b = i + 1 < len ? buffer[i + 1] : 0;
          const c = i + 2 < len ? buffer[i + 2] : 0;
          const tri = (a << 16) | (b << 8) | c;

          output += chars.charAt((tri >> 18) & 63);
          output += chars.charAt((tri >> 12) & 63);
          output += i + 1 < len ? chars.charAt((tri >> 6) & 63) : '=';
          output += i + 2 < len ? chars.charAt(tri & 63) : '=';
        }
        resolve(output);
      });

      if (!base64data) throw new Error('Data conversion failed.');

      const fileName = `NonComm_Sites_Report_${Date.now()}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      
      // 3. Write to a real file in cache storage
      await RNFS.writeFile(filePath, base64data, 'base64');
      
      // 4. Open share sheet using file URI with explicit authority for Android
      await Share.open({
        title: 'Export Non-Comm Sites',
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: fileName,
      });

    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Error', error.message || 'Failed to download Excel report.');
        console.error('[Export] Error:', error);
      }
    } finally {
      setExporting(false);
    }
  };

  const BUCKET_CONFIG = [
    { key: '0-7 days', label: '0–7 Days', color: '#ca8a04' },
    { key: '8-30 days', label: '8–30 Days', color: '#ea580c' },
    { key: '31-60 days', label: '31–60 Days', color: '#dc2626' },
    { key: '61-90 days', label: '61–90 Days', color: '#991b1b' },
    { key: '90+ days', label: '90+ Days', color: '#7f1d1d' },
  ];

  const filteredSites = sites.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item.globel_id || item.global_id || '').toLowerCase().includes(q) ||
      (item.site_id || '').toLowerCase().includes(q) ||
      (item.site_name || '').toLowerCase().includes(q) ||
      (item.imei || '').toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
        <AppHeader
          title="Offline Sites Analysis"
          subtitle={`Aging View (${totalSites || 0})`}
          leftAction="back"
          onLeftPress={() => navigation.goBack()}
          rightActions={[
            { icon: exporting ? 'loader' : 'download', onPress: handleExport },
            
          ]}
        />

        
      

        {/* ── Aging Buckets ────────────────────────────────────────────────────── */}
        {buckets && (
          <View style={styles.bucketsSection}>
            <View style={styles.totalRow}>
              <AppIcon name="wifi-off" size={16} color="#dc2626" />
              <Text style={styles.totalText}>
                Total Offline: <Text style={styles.totalCount}>{totalSites}</Text>
              </Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={BUCKET_CONFIG}
              keyExtractor={item => item.key}
              contentContainerStyle={styles.bucketsContainer}
              renderItem={({ item }) => (
                <AgingBucket
                  label={item.label}
                  count={buckets[item.key] ?? 0}
                  color={item.color}
                />
              )}
            />
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Global ID, Name, ID, or IMEI..."
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

        {/* ── Sites List ──────────────────────────────────────────────────────── */}
        <FlatList
          data={filteredSites}
          keyExtractor={(item, index) => (item.imei || item.site_id || index).toString()}
          renderItem={({ item }) => (
            <SiteCard
              item={item}
              onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
            />
          )}
          contentContainerStyle={{ padding: moderateScale(16), paddingBottom: verticalScale(32) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(1, true, activeFilters); }}
            />
          }
          onEndReached={() => { if (hasNext && !loading) fetchData(page + 1, false, activeFilters); }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            !loading && filteredSites.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="search" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No Data Found</Text>
                <Text style={styles.emptySubtitle}>No offline sites match your search.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading ? <ActivityIndicator size="small" color="#1e3c72" style={{ margin: moderateScale(20) }} /> : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: moderateScale(8), marginLeft: moderateScale(4), position: 'relative' },
  filterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444' },

  bucketsSection: { backgroundColor: '#fff', paddingBottom: verticalScale(12), elevation: 2 },
  totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(16), paddingTop: verticalScale(14), paddingBottom: verticalScale(8), gap: 8 },
  totalText: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#475569', fontWeight: '600' },
  totalCount: { color: '#dc2626', fontWeight: '800' },
  bucketsContainer: { paddingHorizontal: moderateScale(16), gap: moderateScale(10), paddingBottom: verticalScale(4) },
  bucketCard: { backgroundColor: '#f8fafc', padding: moderateScale(12), borderRadius: 10, minWidth: 88, alignItems: 'center', elevation: 1, borderTopWidth: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  bucketCount: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800' },
  bucketLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', marginTop: verticalScale(4), fontWeight: '600', textAlign: 'center' },

  searchContainer: {
    backgroundColor: '#fff',
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(12),
    paddingHorizontal: moderateScale(12),
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    height: verticalScale(48),
  },
  searchIcon: { marginRight: moderateScale(8) },
  searchInput: {
    flex: 1,
    fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b',
    height: '100%',
    padding: moderateScale(0),
  },
  emptyContainer: { alignItems: 'center', marginTop: verticalScale(50) },
  emptyText: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '700', color: '#334155', marginTop: verticalScale(12) },
  emptySubtitle: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(4) },

  // Site card
  card: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 3, borderLeftWidth: 5, borderLeftColor: '#89c2d9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardCritical: { borderLeftColor: '#dc2626', backgroundColor: '#fffbfb' },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(12) },
  siteName: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700', color: '#1e3c72', lineHeight: 20 },
  siteId: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8', marginTop: verticalScale(3), fontWeight: '500' },
  daysBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(9), paddingVertical: verticalScale(5), borderRadius: 20, borderWidth: 1.5 },
  daysBadgeText: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(12) },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoCell: { width: '50%', marginBottom: verticalScale(10), paddingRight: moderateScale(8) },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(2), gap: 4 },
  infoLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#334155', fontWeight: '600' },

  durationRow: { marginTop: verticalScale(8), flexDirection: 'row', alignItems: 'center', gap: moderateScale(10) },
  durationBarBg: { flex: 1, height: verticalScale(5), backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  durationBarFill: { height: '100%', borderRadius: 3 },
  durationLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', width: moderateScale(65), textAlign: 'right' },
  alarmSec: { padding: moderateScale(10), backgroundColor: '#fff5f5', borderRadius: 8, marginTop: verticalScale(12), borderWidth: 1, borderColor: '#fee2e2' },
  secTitle: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', marginBottom: verticalScale(6), letterSpacing: 0.5 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(4), gap: 6 },
  alarmName: { flex: 1, fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', color: '#450a0a' },
  alarmTime: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#991b1b', fontStyle: 'italic' },
});

