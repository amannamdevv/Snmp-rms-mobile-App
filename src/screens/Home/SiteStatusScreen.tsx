import React, { useEffect, useState } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper to convert JSON array to CSV string
const convertToCSV = (objArray: any[]) => {
  if (!objArray || objArray.length === 0) return '';

  // Extract all unique headers from all objects
  const allHeadersSet = new Set<string>();
  objArray.forEach(obj => Object.keys(obj).forEach(key => allHeadersSet.add(key)));
  const headers = Array.from(allHeadersSet);

  const csvRows = [headers.join(',')];

  // Loop through rows
  for (const row of objArray) {
    const values = headers.map(header => {
      // Ensure null/undefined becomes empty string, convert to string
      const val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
      // Escape internal quotes and wrap in quotes to handle commas inside text
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
};

type Props = NativeStackScreenProps<RootStackParamList, 'SiteStatus'>;
type Site = {
  site_id: string;
  site_name: string;
  global_id: string;
  imei: string;
  battery_v: string;
  last_communication: string;
  site_status: string;
    aging?: string;
  commData?: any; // Added to store pre-loaded comm data
};

// --- SiteCard Component ---
const SiteCard = ({ item, onSiteDetailsClick }: { item: Site; onSiteDetailsClick: () => void }) => {
  const getAging = (lastComm) => {
    if (!lastComm || lastComm === '-') return '-';
    // try to parse '2026-09-26 17:15:51' or ISO
    const commDate = new Date(lastComm.replace(' ', 'T'));
    if (isNaN(commDate.getTime())) return '-';
    const now = new Date();
    const diffMs = now - commDate;
    if (diffMs < 0) return '0 mins ago';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return diffMins + ' mins ago';
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + ' hours ago';
    const diffDays = Math.floor(diffHours / 24);
    return diffDays + ' days ago';
  };

  const [expanded, setExpanded] = useState(false);

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const commData = item.commData;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.siteId}>Global ID: {item.global_id || '—'}</Text>
        <View style={[styles.badge, item.site_status === 'Active' ? styles.activeBadge : styles.downBadge]}>
          <Text style={styles.badgeText}>{item.site_status}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(5) }}>
          <Text style={[styles.siteName, { flex: 1, marginRight: moderateScale(10) }]}>{item.site_name}</Text>
          <Text style={{ fontSize: responsiveFontSize(12), color: '#475569', fontWeight: 'bold' }}>IMEI: {item.imei}</Text>
        </View>
  
        <View style={styles.infoRow}>
          <View style={styles.infoCol}><Text style={styles.infoLabel}>Site ID</Text><Text style={styles.infoValue}>{item.site_id || '—'}</Text></View>
          <View style={styles.infoCol}><Text style={styles.infoLabel}>Battery</Text><Text style={styles.infoValue}>{item.battery_v ? `${item.battery_v} V` : '-'}</Text></View>
        </View>
  
        <View style={styles.infoRow}>
          <View style={styles.infoCol}><Text style={styles.infoLabel}>Last Comm</Text><Text style={styles.infoValue}>{item.last_communication || '—'}</Text></View>
          <View style={styles.infoCol}><Text style={styles.infoLabel}>Aging</Text><Text style={styles.infoValue}>{item.aging || getAging(item.last_communication)}</Text></View>
        </View>

      {expanded && (
        <View style={styles.expandedContainer}>
          {commData ? (
            <>
              <View style={styles.commGrid}>
                <View style={styles.commBox}><Text style={styles.commBoxTitle}>S  SMPS</Text><Text style={styles.commLabel}>MAKE: <Text style={styles.commValue}>{commData.SMPS_Make || '-'}</Text></Text><Text style={styles.commLabel}>LAST COM: <Text style={styles.commValue}>{commData.SMPS_LAST_COM || '-'}</Text></Text></View>
                <View style={styles.commBox}><Text style={styles.commBoxTitle}>A  AMF</Text><Text style={styles.commLabel}>MAKE: <Text style={styles.commValue}>{commData.AMF_Make || '-'}</Text></Text><Text style={styles.commLabel}>LAST COM: <Text style={styles.commValue}>{commData.AMF_LAST_COM || '-'}</Text></Text></View>
                <View style={styles.commBox}><Text style={styles.commBoxTitle}>D  DCEM</Text><Text style={styles.commLabel}>MAKE: <Text style={styles.commValue}>{commData.DCEM_Make || '-'}</Text></Text><Text style={styles.commLabel}>LAST COM: <Text style={styles.commValue}>{commData.DCEM_Last_Com || '-'}</Text></Text></View>
              </View>
              <View style={styles.remarksBox}><Text style={styles.remarksTitle}>Remarks:</Text><Text style={styles.remarksText}>{commData.Remarks || '-'}</Text></View>
            </>
          ) : (
            <Text style={styles.noDataText}>No communication data available.</Text>
          )}
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtnOutline} onPress={toggleDetails}>
          <Text style={styles.actionBtnOutlineText}>{expanded ? 'Hide Details' : 'View Details'}</Text>
          <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#475569" style={{ marginLeft: moderateScale(6) }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSolid} onPress={onSiteDetailsClick}>
          <Text style={styles.actionBtnSolidText}>Site Details</Text>
          <AppIcon name="arrow-right" size={16} color="#fff" style={{ marginLeft: moderateScale(6) }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- Main Screen ---
export default function SiteStatusScreen({ navigation }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [kpi, setKpi] = useState({ total_sites: 0, active_sites: 0, non_active_sites: 0 });
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter States
  const [statusFilter, setStatusFilter] = useState('');
  const { globalFilters, setGlobalFilters, hasActiveFilters: gHasFilters, activeFilterCount: gFilterCount } = useGlobalFilter();
  const [activeFilters, setActiveFilters] = useState<any>(globalFilters)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadSites = async (pageNumber = 1, replace = false, currentFilters = activeFilters) => {
    if (loading && !replace) return;
    setLoading(true);

    try {
      const res = await api.getSiteStatus({ status: statusFilter, ...currentFilters }, pageNumber, 10);

      if (res && res.sites) {
        // Use unfiltered_kpi if available to keep top-level counts accurate
        if (res.unfiltered_kpi) {
          setKpi(res.unfiltered_kpi);
        } else if (res.kpi) {
          setKpi(res.kpi);
        }

        // --- MERGE COMMUNICATION DATA INTO SITES ---
        // Create a lookup map for faster access
        const comms = res.communication || [];
        const commMap: any = {};
        comms.forEach((c: any) => { if (c.imei) commMap[c.imei] = c; });

        // Map commData to each site by IMEI
        const sitesWithComm = res.sites.map((site: any) => ({
          ...site,
          commData: commMap[site.imei] || null
        }));

        setHasNext(res.pagination?.has_next ?? false);
        setPage(pageNumber);

        if (replace) setSites(sitesWithComm);
        else setSites(prev => [...prev, ...sitesWithComm]);
      } else {
        console.log('Unexpected response structure:', res);
      }
    } catch (error) {
      console.log('Load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSites(1, true, activeFilters);
  }, [statusFilter, activeFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSites(1, true);
  };

  const loadMore = () => {
    if (hasNext && !loading) loadSites(page + 1, false);
  };

  const handleApplyFilters = (newFilters: any) => {
    setGlobalFilters(newFilters); // persist globally
    setActiveFilters(newFilters);
  };

  const handleExport = async () => {
    if (exporting) return;
    try {
      setExporting(true);

      // Fetch all filtered data in one shot (large page size)
      const res = await api.getSiteStatus(
        { status: statusFilter, ...activeFilters },
        1,
        10000
      );

      const sitesArray = res?.sites;

      if (!sitesArray || sitesArray.length === 0) {
        Alert.alert('No Data', 'There is no data to export with the current filters.');
        return;
      }

      const csvRows = sitesArray.map((site: any) => ({
        'Global ID': site.global_id || '',
        'Site ID': site.site_id || '',
        'Site Name': site.site_name || '',
        'IMEI': site.imei || '',
        'Status': site.site_status || '',
        'Battery (V)': site.battery_v || '',
        'Last Communication': site.last_communication || '',
          'Aging': site.aging || '',
      }));

      const csvString = convertToCSV(csvRows);
      const fileName = `Site_Status_${new Date().getTime()}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, csvString, 'utf8');

      await Share.open({
        title: 'Export Site Status',
        url: `file://${filePath}`,
        type: 'text/csv',
        filename: fileName,
        showAppsToView: true,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Error', 'Failed to generate or download CSV.');
        console.error(error);
      }
    } finally {
      setExporting(false);
    }
  };

  const filteredSites = sites.filter(site => {
    const q = searchQuery.toLowerCase();
    return (
      (site.global_id || '').toLowerCase().includes(q) ||
      (site.site_id || '').toLowerCase().includes(q) ||
      (site.site_name || '').toLowerCase().includes(q) ||
      (site.imei || '').toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Site Status"
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          { icon: 'filter', onPress: () => setFilterModalVisible(true), badge: gFilterCount > 0 },
        ]}
      />

      <GlobalFilterBanner />
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={activeFilters}
      />

      {/* KPIs */}
      <View style={styles.kpiContainer}>
        <TouchableOpacity
          style={[styles.kpiCard, { borderTopColor: '#3b82f6' }, statusFilter === '' && styles.kpiActive]}
          onPress={() => setStatusFilter('')}
        >
          <Text style={styles.kpiValue}>{kpi.total_sites}</Text>
          <Text style={styles.kpiLabel}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.kpiCard, { borderTopColor: '#10b981' }, statusFilter === 'active' && styles.kpiActive]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.kpiValue, { color: '#10b981' }]}>{kpi.active_sites}</Text>
          <Text style={styles.kpiLabel}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.kpiCard, { borderTopColor: '#ef4444' }, statusFilter === 'down' && styles.kpiActive]}
          onPress={() => setStatusFilter('down')}
        >
          <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{kpi.non_active_sites}</Text>
          <Text style={styles.kpiLabel}>NON-ACTIVE</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Global ID, Name, or IMEI..."
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

      <FlatList
        data={filteredSites}
        keyExtractor={(item, index) => (item.imei || item.site_id || index).toString()}
        renderItem={({ item }) => (
          <SiteCard
            item={item}
            onSiteDetailsClick={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
          />
        )}
        contentContainerStyle={{ padding: moderateScale(16) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color="#1e3c72" style={{ margin: moderateScale(20) }} /> : null}
        ListEmptyComponent={
          !loading && filteredSites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="search" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Data Found</Text>
              <Text style={styles.emptySubtitle}>Try searching with a different criteria.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: moderateScale(8), marginLeft: moderateScale(10), position: 'relative' },
  activeFilterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

  kpiContainer: { flexDirection: 'row', paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(12), gap: 10 },
  kpiCard: { flex: 1, backgroundColor: '#fff', padding: moderateScale(12), borderRadius: 10, alignItems: 'center', elevation: 3, borderTopWidth: 4 },
  kpiActive: { backgroundColor: '#f0f4ff', elevation: 1 },
  kpiValue: { fontSize: responsiveFontSize(22), fontWeight: '800', color: '#1e3c72' },
  kpiLabel: { fontSize: responsiveFontSize(11), color: '#64748b', marginTop: verticalScale(2), fontWeight: '700', textTransform: 'uppercase' },

  searchContainer: {
    backgroundColor: '#fff',
    marginHorizontal: moderateScale(16),
    marginBottom: verticalScale(10),
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
    fontSize: responsiveFontSize(14),
    color: '#1e293b',
    height: '100%',
    padding: moderateScale(0),
  },
  emptyContainer: { alignItems: 'center', marginTop: verticalScale(50) },
  emptyText: { fontSize: responsiveFontSize(18), fontWeight: '700', color: '#334155', marginTop: verticalScale(12) },
  emptySubtitle: { fontSize: responsiveFontSize(14), color: '#94a3b8', marginTop: verticalScale(4) },

  card: { backgroundColor: '#fff', padding: moderateScale(16), borderRadius: 12, marginBottom: verticalScale(12), elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12) },
  siteId: { fontSize: responsiveFontSize(16), fontWeight: '800', color: '#1e293b' },
  badge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(4), borderRadius: 12 },
  activeBadge: { backgroundColor: '#d1fae5' },
  downBadge: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: responsiveFontSize(12), fontWeight: '600', color: '#333' },
  siteName: { fontSize: responsiveFontSize(13), fontWeight: '600', marginBottom: verticalScale(12), color: '#64748b' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(8) },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: responsiveFontSize(11), color: '#888', textTransform: 'uppercase', marginBottom: verticalScale(2) },
  infoValue: { fontSize: responsiveFontSize(13), color: '#333', fontWeight: '500' },

  // Expanded Section Styles
  expandedContainer: { marginTop: verticalScale(12), paddingTop: verticalScale(12), borderTopWidth: 1, borderTopColor: '#eee' },
  commGrid: { flexDirection: 'column', gap: 8, marginBottom: verticalScale(10) },
  commBox: { backgroundColor: '#f8fafc', padding: moderateScale(12), borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  commBoxTitle: { fontSize: responsiveFontSize(14), fontWeight: '700', color: '#475569', marginBottom: verticalScale(8) },
  commLabel: { fontSize: responsiveFontSize(11), color: '#64748b', marginBottom: verticalScale(4) },
  commValue: { fontSize: responsiveFontSize(12), color: '#0f172a', fontWeight: '600' },
  remarksBox: { backgroundColor: '#f0f9ff', padding: moderateScale(12), borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#38bdf8' },
  remarksTitle: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#0369a1', marginBottom: verticalScale(4) },
  remarksText: { fontSize: responsiveFontSize(12), color: '#0c4a6e' },
  noDataText: { textAlign: 'center', color: '#888', fontSize: responsiveFontSize(13), marginVertical: verticalScale(10) },

  // Action Buttons Row
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: verticalScale(16), gap: 10 },
  actionBtnOutline: { flex: 1, paddingVertical: verticalScale(10), borderRadius: 8, borderWidth: 1, borderColor: '#64748b', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtnOutlineText: { color: '#475569', fontSize: responsiveFontSize(13), fontWeight: '600' },
  actionBtnSolid: { flex: 1, paddingVertical: verticalScale(10), borderRadius: 8, backgroundColor: '#1e3c72', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtnSolidText: { color: '#fff', fontSize: responsiveFontSize(13), fontWeight: '600' },
});
