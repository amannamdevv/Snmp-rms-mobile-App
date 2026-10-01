import React, { useEffect, useState } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'SiteRunningStatus'>;

// Helper to convert JSON array to CSV string
const convertToCSV = (objArray: any[]) => {
  if (!objArray || objArray.length === 0) return '';
  const allHeadersSet = new Set<string>();
  objArray.forEach(obj => Object.keys(obj).forEach(key => allHeadersSet.add(key)));
  const headers = Array.from(allHeadersSet);
  const csvRows = [headers.join(',')];
  for (const row of objArray) {
    const values = headers.map(header => {
      const val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
};

export default function SiteRunningStatusScreen({ navigation }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({
    total_active: 0,
    total_non_active: 0,
    total_soeb: 0,
    total_sobt: 0,
    total_sodg: 0,
    total_slreb: 0,
    total_slrdg: 0,
    total_slrbt: 0
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const { globalFilters, setGlobalFilters, hasActiveFilters: gHasFilters, activeFilterCount: gFilterCount } = useGlobalFilter();
  const [activeFilters, setActiveFilters] = useState<any>(globalFilters)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch data based on global filters
      const res = await api.getSiteRunningStatus(activeFilters, 1, 10000);
      let sitesToExport = res?.sites || [];

      // Filter by the currently active tab (EB, DG, Battery, etc.)
      if (activeTab === 'Non-Comm') {
        sitesToExport = sitesToExport.filter((s: any) => s.comm_status === 'Non Active');
      } else if (activeTab !== 'All') {
        sitesToExport = sitesToExport.filter((s: any) => s.running_status === activeTab && s.comm_status === 'Active');
      }

      if (sitesToExport.length === 0) {
        Alert.alert("No Data", "There is no data to export with the current filters.");
        return;
      }
      
      const csvString = convertToCSV(sitesToExport);
      const fileName = `Running_Status_${activeTab}_${new Date().getTime()}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, csvString, 'utf8');
      
      // Fixed Share call with proper file URI for Android
      await Share.open({
        title: 'Export Running Status',
        url: `file://${filePath}`,
        type: 'text/csv',
        filename: fileName,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert("Export Error", "Failed to generate or open export data.");
        console.error('[Export Error]', error);
      }
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchData(activeFilters);
  }, [activeFilters]);

  const fetchData = async (currentFilters = {}) => {
    setLoading(true);
    try {
      const res = await api.getSiteRunningStatus(currentFilters);
      // Logic Fix: Django returns the object directly, not wrapped in 'success'
      if (res && res.sites) {
        setData(res.sites);
        setCounts(res.counts);
        // Apply the tab filter immediately on fresh data
        applyLocalTabFilter(res.sites, activeTab, searchQuery);
      }
    } catch (e) {
      console.error("API Error:", e);
      Alert.alert("Connection Error", "Could not fetch running status data.");
    } finally {
      setLoading(false);
    }
  };

  const applyLocalTabFilter = (allData: any[], tab: string, query: string) => {
    let filtered = allData;
    
    // Tab filtering
    if (tab === 'Non-Comm') {
      filtered = allData.filter(s => s.comm_status === 'Non Active');
    } else if (tab !== 'All') {
      filtered = allData.filter(s => s.running_status === tab && s.comm_status === 'Active');
    }

    // Search filtering
    if (query) {
      filtered = filtered.filter(s => 
        (s.site_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.global_id || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.globel_id || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.site_id || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.imei || '').toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    applyLocalTabFilter(data, tab, searchQuery);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    applyLocalTabFilter(data, activeTab, query);
  };

  const getStatusColor = (status: string, comm: string) => {
    if (comm === 'Non Active') return '#dc2626';
    if (status === 'SOEB') return '#01497C';
    if (status === 'SOBT') return '#468FAF';
    if (status === 'SODG') return '#ea580c';
    if (status === 'SLREB') return '#059669';
    if (status === 'SLRDG') return '#d97706';
    if (status === 'SLRBT') return '#2563eb';
    return '#888';
  };

  const renderCard = ({ item }: { item: any }) => {
    const isOffline = item.comm_status === 'Non Active';
    const displayStatus = isOffline ? 'Non-Comm' : (item.running_status || 'Unknown');
    const color = getStatusColor(item.running_status, item.comm_status);

    // Format 3-phase voltages with 2 decimal places matching the website display
    const fmt = (v: any) => (v != null && v !== '' ? parseFloat(v).toFixed(2) : '0.00');
    const mainsVolt = `${fmt(item.mains_volt_r)} / ${fmt(item.mains_volt_y)} / ${fmt(item.mains_volt_b)}`;
    const dgVolt   = `${fmt(item.dg_volt_r)} / ${fmt(item.dg_volt_y)} / ${fmt(item.dg_volt_b)}`;
    const battVolt = item.bts_batt_volt ? `${parseFloat(item.bts_batt_volt).toFixed(2)} V` : '--';

    // Last Updated: prefer last_updated, fall back to start_time
    const lastUpdated = item.last_updated || item.start_time || null;
    const lastUpdatedStr = lastUpdated
      ? new Date(lastUpdated).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : '--';

    // Alarm description
    const alarmDesc = item.alarm_desc || item.alarm_description || item.alarm || '--';

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: color }]}
        onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: '' })}
        activeOpacity={0.85}
      >
        {/* Header: Site Name + Status badge */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: moderateScale(8) }}>
            <Text style={styles.siteName} numberOfLines={1}>{item.site_name || '--'}</Text>
            <Text style={styles.imei}>IMEI: {item.imei || '--'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{displayStatus}</Text>
          </View>
        </View>

        {/* Row 1: Comm Status + Battery Voltage */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Comm Status</Text>
            <Text style={[styles.val, { color: isOffline ? '#dc2626' : '#16a34a' }]}>{item.comm_status || '--'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Battery (V)</Text>
            <Text style={styles.val}>{battVolt}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Session</Text>
            <Text style={styles.val}>{item.current_session_duration || '--'}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.voltDivider} />

        {/* Mains Voltage */}
        <View style={styles.voltRow}>
          <Text style={styles.voltLabel}>Mains (R/Y/B)</Text>
          <Text style={styles.voltVal}>{mainsVolt}</Text>
        </View>

        {/* DG Voltage */}
        <View style={styles.voltRow}>
          <Text style={styles.voltLabel}>DG (R/Y/B)</Text>
          <Text style={styles.voltVal}>{dgVolt}</Text>
        </View>

        {/* Alarm Description - only if present */}
        {alarmDesc !== '--' && (
          <View style={styles.alarmBox}>
            <AppIcon name="alert-triangle" size={12} color="#f97316" style={{ marginTop: verticalScale(1) }} />
            <Text style={styles.alarmText} numberOfLines={1}>{alarmDesc}</Text>
          </View>
        )}

        {/* Last Updated */}
        <View style={styles.lastUpdatedRow}>
          <Text style={styles.label}>Last Updated</Text>
          <Text style={styles.lastUpdatedVal}>{lastUpdatedStr}</Text>
        </View>

        {/* Run Hours Detail Button */}
        <TouchableOpacity
          style={styles.runHoursBtn}
          onPress={() => navigation.navigate('SiteRunHoursDetail', { imei: item.imei, siteName: item.site_name || '' })}
        >
          <Text style={styles.runHoursBtnTxt}>Run Hours Detail</Text>
          <AppIcon name="arrow-right" size={14} color="#fff" style={{ marginLeft: moderateScale(6) }} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Running Status"
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          
        ]}
      />

      
      

        <View style={styles.kpiContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScrollContainer}>
            <TouchableOpacity onPress={() => handleTabChange('All')} style={[styles.kpiBox, { borderBottomColor: '#3b82f6', backgroundColor: activeTab === 'All' ? '#e2e8f0' : '#fff' }]}>
              <Text style={styles.kpiTitle}>Total</Text>
              <Text style={styles.kpiVal}>{data.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SOEB')} style={[styles.kpiBox, { borderBottomColor: '#10b981', backgroundColor: activeTab === 'SOEB' ? '#d1fae5' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SOEB</Text>
              <Text style={[styles.kpiVal, { color: '#10b981' }]}>{counts.total_soeb || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SOBT')} style={[styles.kpiBox, { borderBottomColor: '#3b82f6', backgroundColor: activeTab === 'SOBT' ? '#dbeafe' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SOBT</Text>
              <Text style={[styles.kpiVal, { color: '#3b82f6' }]}>{counts.total_sobt || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SODG')} style={[styles.kpiBox, { borderBottomColor: '#f59e0b', backgroundColor: activeTab === 'SODG' ? '#fef3c7' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SODG</Text>
              <Text style={[styles.kpiVal, { color: '#f59e0b' }]}>{counts.total_sodg || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('Non-Comm')} style={[styles.kpiBox, { borderBottomColor: '#ef4444', backgroundColor: activeTab === 'Non-Comm' ? '#fee2e2' : '#fff' }]}>
              <Text style={styles.kpiTitle}>Non-Comm</Text>
              <Text style={[styles.kpiVal, { color: '#ef4444' }]}>{counts.total_non_active || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SLREB')} style={[styles.kpiBox, { borderBottomColor: '#059669', backgroundColor: activeTab === 'SLREB' ? '#d1fae5' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SLREB</Text>
              <Text style={[styles.kpiVal, { color: '#059669' }]}>{counts.total_slreb || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SLRDG')} style={[styles.kpiBox, { borderBottomColor: '#d97706', backgroundColor: activeTab === 'SLRDG' ? '#fef3c7' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SLRDG</Text>
              <Text style={[styles.kpiVal, { color: '#d97706' }]}>{counts.total_slrdg || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('SLRBT')} style={[styles.kpiBox, { borderBottomColor: '#2563eb', backgroundColor: activeTab === 'SLRBT' ? '#dbeafe' : '#fff' }]}>
              <Text style={styles.kpiTitle}>SLRBT</Text>
              <Text style={[styles.kpiVal, { color: '#2563eb' }]}>{counts.total_slrbt || 0}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

      <TouchableOpacity
        style={styles.smallCard}
        onPress={() => navigation.navigate('BackupUsage')}
        activeOpacity={0.8}
      >
        <Text style={styles.smallCardTitle}>Today's Event</Text>
        <AppIcon name="chevron-right" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Global ID, Name, ID, or IMEI..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <AppIcon name="x" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>



      {loading ? (
        <ActivityIndicator size="large" color="#1e3c72" style={{ marginTop: verticalScale(50) }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => (item.imei || item.site_id || index).toString()}
          renderItem={renderCard}
          contentContainerStyle={{ padding: moderateScale(16) }}
          ListEmptyComponent={
            filteredData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="search" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No Data Found</Text>
                <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: moderateScale(8), marginLeft: moderateScale(5), position: 'relative' },
  activeFilterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

  kpiContainer: { paddingTop: verticalScale(12) },
  kpiScrollContainer: { paddingHorizontal: moderateScale(16), gap: moderateScale(12), paddingBottom: verticalScale(6) },
  kpiBox: { 
    backgroundColor: '#fff', 
    paddingVertical: verticalScale(12), 
    paddingHorizontal: moderateScale(20), 
    borderRadius: 12, 
    elevation: 2, 
    borderBottomWidth: 4, 
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90
  },
  kpiVal: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
  kpiTitle: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', fontWeight: '700', marginBottom: verticalScale(4), textTransform: 'uppercase' },

  // Updated Today's Event Card (matching Run Hours Button style)
  smallCard: { 
    marginHorizontal: moderateScale(16), 
    marginVertical: verticalScale(10), 
    backgroundColor: '#01497C', 
    borderRadius: 8, 
    padding: moderateScale(12), 
    elevation: 3, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  smallCardTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#fff' },

  searchContainer: {
    backgroundColor: '#fff',
    marginHorizontal: moderateScale(16),
    marginBottom: verticalScale(12),
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

  tabsContainer: { flexDirection: 'row', paddingHorizontal: moderateScale(16), marginBottom: verticalScale(10), flexWrap: 'wrap', gap: 8 },
  tab: { paddingVertical: verticalScale(6), paddingHorizontal: moderateScale(14), borderRadius: 20, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#1e3c72' },
  tabText: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', padding: moderateScale(10), borderRadius: 10, marginBottom: verticalScale(8), elevation: 2, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: verticalScale(6) },
  siteName: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
  imei: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#666', marginTop: verticalScale(2) },
  badge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(4), borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700' },

  row: { flexDirection: 'row', marginTop: verticalScale(5) },
  col: { flex: 1 },
  label: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#888', textTransform: 'uppercase', marginBottom: verticalScale(2) },
  val: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#333', fontWeight: '600' },

  // Voltage rows (full-width label : value)
  voltDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: verticalScale(6) },
  voltRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(3) },
  voltLabel: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  voltVal: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e3c72', fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Alarm description
  alarmBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 8, padding: moderateScale(8), marginTop: verticalScale(10), gap: 6, borderLeftWidth: 3, borderLeftColor: '#f97316' },
  alarmIcon: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#f97316', lineHeight: 18 },
  alarmText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#9a3412', flex: 1, fontWeight: '600' },

  // Last Updated
  lastUpdatedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: verticalScale(10), paddingTop: verticalScale(8), borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  lastUpdatedVal: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#475569', fontWeight: '500' },

  // Run Hours button
  runHoursBtn: { marginTop: verticalScale(10), backgroundColor: '#01497C', borderRadius: 8, paddingVertical: verticalScale(9), alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  runHoursBtnTxt: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(13), flexShrink: 1, },
});




