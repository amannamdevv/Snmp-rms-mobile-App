import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
  RefreshControl, TextInput, Linking, Modal, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import Sidebar from '../../components/Sidebar';
import IndiaMap from '../../components/IndiaMap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

let SCREEN_W = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SCREEN_W = _d.width; } catch(_) {}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Site {
  site_id: string;
  site_name: string;
  technician_name: string;
  technician_mobile: string;
  status: 'Active' | 'Non Active';
  last_communication: string;
  comm_timestamp: string | null;
  global_id?: string;
}

interface SummaryData {
  total_sites: number;
  active_sites: number;
  non_active_sites: number;
  sites: Site[];
  mapping_data: Array<[number, string, number]>; // [state_id, state_name, count]
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({
  visible, onClose, onApply,
  siteName, setSiteName,
  siteId, setSiteId,
  globalId, setGlobalId,
  imei, setImei,
  statusFilter, setStatusFilter,
}: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose}>
              <AppIcon name="x" size={22} color="#1e3c72" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>Site Name</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Enter site name"
              placeholderTextColor="#94a3b8"
              value={siteName}
              onChangeText={setSiteName}
            />

            <Text style={styles.filterLabel}>Site ID</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Enter site ID"
              placeholderTextColor="#94a3b8"
              value={siteId}
              onChangeText={setSiteId}
            />

            <Text style={styles.filterLabel}>Global ID</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Enter Global ID"
              placeholderTextColor="#94a3b8"
              value={globalId}
              onChangeText={setGlobalId}
            />

            <Text style={styles.filterLabel}>GSM IMEI</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Enter IMEI"
              placeholderTextColor="#94a3b8"
              value={imei}
              onChangeText={setImei}
            />

            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.statusRow}>
              {['', 'active', 'down'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, statusFilter === s && styles.statusChipActive]}
                  onPress={() => setStatusFilter(s)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {s === 'active' && <AppIcon name="check" size={12} color={statusFilter === s ? '#fff' : '#22c55e'} />}
                    {s === 'down' && <AppIcon name="x" size={12} color={statusFilter === s ? '#fff' : '#ef4444'} />}
                    <Text style={[styles.statusChipText, statusFilter === s && styles.statusChipTextActive]}>
                      {s === '' ? 'All' : s === 'active' ? 'Active' : 'Non-Active'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
              <AppIcon name="check" size={16} color="#fff" />
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSiteName(''); setSiteId(''); setGlobalId('');
                setImei(''); setStatusFilter('');
                setTimeout(onApply, 100);
              }}
            >
              <Text style={styles.clearBtnText}>Clear All Filters</Text>
            </TouchableOpacity>

            <View style={{ height: verticalScale(30) }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── State Stats Row ──────────────────────────────────────────────────────────
function StateStatsTable({ mappingData }: { mappingData: Array<[number, string, number]> }) {
  const sorted = useMemo(() =>
    [...mappingData].sort((a, b) => b[2] - a[2]),
    [mappingData]
  );
  const maxCount = sorted[0]?.[2] || 1;

  if (!sorted.length) return null;

  return (
    <View style={styles.statsCard}>
      <Text style={styles.sectionTitle}>
        <AppIcon name="bar-chart-2" size={16} color="#1e3c72" />
        {'  '}State-wise Distribution
      </Text>
      {sorted.map(([, stateName, count]) => (
        <View key={stateName} style={styles.stateRow}>
          <Text style={styles.stateName} numberOfLines={1}>{stateName}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(count / maxCount) * 100}%` }]} />
          </View>
          <Text style={styles.stateCount}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Site Card ────────────────────────────────────────────────────────────────
function SiteCard({ item }: { item: Site }) {
  const isActive = item.status === 'Active';
  return (
    <View style={[styles.card, isActive ? styles.cardActive : styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.siteName} numberOfLines={1}>{item.site_name}</Text>
          <Text style={styles.siteId}>Global ID: {item.global_id || item.site_id}</Text>
        </View>
        <View style={[styles.statusBadge, isActive ? styles.badgeActive : styles.badgeInactive]}>
          <AppIcon name={isActive ? 'wifi' : 'wifi-off'} size={11} color={isActive ? '#22c55e' : '#ef4444'} />
          <Text style={[styles.statusText, { color: isActive ? '#22c55e' : '#ef4444' }]}>
            {isActive ? 'Active' : 'Non Active'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <AppIcon name="user" size={13} color="#64748b" />
          <Text style={styles.infoText}>{item.technician_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <AppIcon name="phone" size={13} color="#64748b" />
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.technician_mobile}`)}>
            <Text style={[styles.infoText, item.technician_mobile !== 'N/A' && styles.phoneLink]}>
              {item.technician_mobile}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <AppIcon name="clock" size={13} color="#64748b" />
          <Text style={styles.infoText}>{item.last_communication}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ResourceMappingScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [fullname, setFullname] = useState('Administrator');
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [exporting, setExporting] = useState(false);

  // Filter states
  const [siteName, setSiteName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [globalId, setGlobalId] = useState('');
  const [imei, setImei] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const name = await AsyncStorage.getItem('user_fullname');
      if (name) setFullname(name);
    };
    loadUser();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (siteName) filters.site_name = siteName;
      if (siteId) filters.site_id = siteId;
      if (globalId) filters.global_id = globalId;
      if (imei) filters.imei = imei;
      if (statusFilter) filters.status = statusFilter;

      const data = await api.getSiteSummary(filters);
      if (data.status === 'success') {
        setSummary(data);
      }
    } catch (e) {
      console.log('ResourceMapping fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteName, siteId, globalId, imei, statusFilter]);

  const handleApply = useCallback(() => {
    setShowFilter(false);
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (!summary?.sites?.length) return Alert.alert('No data', 'Nothing to export.');
    setExporting(true);
    try {
      const header = 'GLOBAL ID,SITE ID,SITE NAME,TECHNICIAN,MOBILE,STATUS,LAST COMMUNICATION';
      const rows = summary.sites.map(s => [
        `"${s.global_id || ''}"`,
        `"${s.site_id || ''}"`,
        `"${s.site_name || ''}"`,
        `"${s.technician_name || ''}"`,
        `"${s.technician_mobile || ''}"`,
        `"${s.status || ''}"`,
        `"${s.last_communication || ''}"`
      ].join(','));
      
      const csvContent = [header, ...rows].join('\n');
      const fileName = `Resource_Mapping_${new Date().getTime()}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(filePath, csvContent, 'utf8');
      await Share.open({ url: `file://${filePath}`, type: 'text/csv' });
    } catch (e) {
      console.log('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  // Convert mapping_data [[state_id, state_name, count]] → [[state_name, count]] for the map
  const mapData: Array<[string, number]> = useMemo(() => {
    if (!summary?.mapping_data) return [];
    return summary.mapping_data.map(([, name, count]) => [name, count]);
  }, [summary]);

  const activeCount = summary?.active_sites ?? 0;
  const totalCount = summary?.total_sites ?? 0;
  const nonActiveCount = summary?.non_active_sites ?? 0;
  const hasActiveFilters = !!(siteName || siteId || globalId || imei || statusFilter);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
      <AppHeader
        title="Mapping of Resources"
        leftAction="menu"
        onLeftPress={() => setSidebarVisible(true)}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          { icon: 'filter', onPress: () => setShowFilter(true), badge: hasActiveFilters },
        ]}
      />

        {/* Search Bar */}
        <View style={styles.searchWrap}>
            <AppIcon name="search" size={14} color="#94a3b8" />
            <TextInput
                style={styles.searchInput}
                placeholder="Search Global ID, Name, or ID..."
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

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiBox, { borderTopColor: '#3b82f6' }]}>
            <Text style={styles.kpiVal}>{totalCount}</Text>
            <Text style={styles.kpiLab}>Total Sites</Text>
          </View>
          <View style={[styles.kpiBox, { borderTopColor: '#22c55e' }]}>
            <Text style={[styles.kpiVal, { color: '#22c55e' }]}>{activeCount}</Text>
            <Text style={styles.kpiLab}>Active</Text>
          </View>
          <View style={[styles.kpiBox, { borderTopColor: '#ef4444' }]}>
            <Text style={[styles.kpiVal, { color: '#ef4444' }]}>{nonActiveCount}</Text>
            <Text style={styles.kpiLab}>Offline</Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'map' && styles.tabActive]}
            onPress={() => setActiveTab('map')}
          >
            <AppIcon name="map" size={14} color={activeTab === 'map' ? '#1e3c72' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>India Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.tabActive]}
            onPress={() => setActiveTab('list')}
          >
            <AppIcon name="list" size={14} color={activeTab === 'list' ? '#1e3c72' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
              Site List {totalCount > 0 ? `(${totalCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

      {/* ── Content ── */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3c72" />
          <Text style={styles.loadingText}>Loading resource data...</Text>
        </View>
      ) : activeTab === 'map' ? (
        /* ── MAP TAB ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.mapScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              colors={['#1e3c72']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* India Map */}
          <View style={styles.mapCard}>
            <Text style={styles.sectionTitle}>
              <AppIcon name="map-pin" size={16} color="#1e3c72" />
              {'  '}SNMP-RMS Installed Across India
            </Text>
            <Text style={styles.mapHint}>Tap a state to see site count</Text>
            <IndiaMap mappingData={mapData || []} width={SCREEN_W - 48} />
          </View>

          {/* State-wise Distribution Table */}
          {summary?.mapping_data && summary.mapping_data.length > 0 && (
            <StateStatsTable mappingData={summary.mapping_data} />
          )}

          <View style={{ height: verticalScale(80) }} />
        </ScrollView>
      ) : (
        /* ── LIST TAB ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              colors={['#1e3c72']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {summary?.sites && summary.sites.length > 0 ? (
            (() => {
                const filtered = summary.sites.filter(s => 
                    !searchQuery || 
                    s.site_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    s.global_id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    s.site_id?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filtered.length === 0) return (
                    <View style={styles.empty}>
                        <AppIcon name="info" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No sites match your search.</Text>
                    </View>
                );
                return filtered.map((item, i) => <SiteCard key={`${item.site_id}-${i}`} item={item} />);
            })()
          ) : (
            <View style={styles.empty}>
              <AppIcon name="server" size={60} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Sites Found</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters ? 'Try adjusting your filters.' : 'No resource data available.'}
              </Text>
            </View>
          )}
          <View style={{ height: verticalScale(80) }} />
        </ScrollView>
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={handleApply}
        siteName={siteName} setSiteName={setSiteName}
        siteId={siteId} setSiteId={setSiteId}
        globalId={globalId} setGlobalId={setGlobalId}
        imei={imei} setImei={setImei}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      />

      {/* Sidebar */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        activeRoute="ResourceMapping"
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(0),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: moderateScale(16), marginVertical: verticalScale(10), borderRadius: 10,
    paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(10), elevation: 2, gap: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: responsiveFontSize(13), flexShrink: 1, color: '#0f172a', fontWeight: '500', padding: moderateScale(0) },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: verticalScale(14),
  },
  headerTitle: { color: '#fff', fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: moderateScale(8), borderRadius: 8, position: 'relative' },
  filterActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterDot: {
    position: 'absolute', top: 6, right: 6,
    width: moderateScale(8), height: verticalScale(8), borderRadius: 4,
    backgroundColor: '#fbbf24', borderWidth: 1, borderColor: '#fff',
  },

  // KPI
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(12),
    gap: moderateScale(10),
  },
  kpiBox: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: moderateScale(12), 
    borderRadius: 10, 
    alignItems: 'center', 
    elevation: 3,
    borderTopWidth: 4,
  },
  kpiVal: { fontSize: responsiveFontSize(20), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
  kpiLab: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', textTransform: 'uppercase', marginTop: verticalScale(2), fontWeight: '700' },

  // Tab bar
  tabBar: {
    flexDirection: 'row', gap: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(12),
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: verticalScale(10), borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '700' },
  tabTextActive: { color: '#1e3c72' },

  // Map tab
  mapScrollContent: { padding: moderateScale(16) },
  mapCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: moderateScale(16), marginBottom: verticalScale(16),
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  sectionTitle: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(4) },
  mapHint: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8', marginBottom: verticalScale(12) },
  mapEmpty: { alignItems: 'center', paddingVertical: verticalScale(40) },
  mapEmptyText: { color: '#94a3b8', marginTop: verticalScale(10), fontSize: responsiveFontSize(13), flexShrink: 1, },

  // State stats
  statsCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: moderateScale(16), marginBottom: verticalScale(16),
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  stateRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: verticalScale(10), gap: 8,
  },
  stateName: { width: moderateScale(110), fontSize: responsiveFontSize(12), flexShrink: 1, color: '#334155', fontWeight: '500' },
  barTrack: {
    flex: 1, height: verticalScale(8), backgroundColor: '#f1f5f9',
    borderRadius: 4, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#2a5298', borderRadius: 4 },
  stateCount: { width: moderateScale(32), fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#1e293b', textAlign: 'right' },

  // List tab
  listScrollContent: { padding: moderateScale(16) },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: moderateScale(14), marginBottom: verticalScale(12),
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
    borderLeftWidth: 4,
  },
  cardActive: { borderLeftColor: '#22c55e' },
  cardInactive: { borderLeftColor: '#ef4444' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: verticalScale(10) },
  siteName: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(2) },
  siteId: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 20,
  },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600' },
  cardBody: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#475569' },
  phoneLink: { color: '#1e3c72', textDecorationLine: 'underline' },

  // States
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(40) },
  loadingText: { color: '#94a3b8', marginTop: verticalScale(12), fontSize: responsiveFontSize(14), flexShrink: 1, },
  empty: { alignItems: 'center', paddingTop: verticalScale(80), paddingHorizontal: moderateScale(40) },
  emptyTitle: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '700', color: '#334155', marginTop: verticalScale(16) },
  emptyText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#94a3b8', textAlign: 'center', marginTop: verticalScale(6) },

  // Filter Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: moderateScale(24), maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: verticalScale(20),
  },
  modalTitle: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '700', color: '#1e293b' },
  filterLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '600', color: '#64748b', marginBottom: verticalScale(6), marginTop: verticalScale(14), textTransform: 'uppercase' },
  filterInput: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(10),
    fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b',
  },
  statusRow: { flexDirection: 'row', gap: moderateScale(10), flexWrap: 'wrap', marginTop: verticalScale(4) },
  statusChip: {
    paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8), borderRadius: 20,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  statusChipActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  statusChipText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '500' },
  statusChipTextActive: { color: '#fff' },
  applyBtn: {
    backgroundColor: '#1e3c72', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    padding: moderateScale(14), borderRadius: 12, marginTop: verticalScale(20), gap: 8,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(15), flexShrink: 1, },
  clearBtn: { alignItems: 'center', padding: moderateScale(12), marginTop: verticalScale(8) },
  clearBtnText: { color: '#ef4444', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '600' },
});
