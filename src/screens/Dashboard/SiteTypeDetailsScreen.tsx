import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteTypeDetails'>;

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

export default function SiteTypeDetailsScreen({ route, navigation }: Props) {
  const { siteType: initialType, title: initialTitle, filters } = route.params;
  
  const [activeType, setActiveType] = useState(initialType);
  const [activeTitle, setActiveTitle] = useState(initialTitle);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters || {});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<any>(null);

  const DIST_CATEGORIES = useMemo(() => [
    { label: 'BSC', value: 'bsc', icon: 'layers' },
    { label: 'HUB', value: 'hub', icon: 'server' },
    { label: 'DG', value: 'dg', icon: 'cpu' },
    { label: 'EB', value: 'eb', icon: 'zap' },
    { label: 'Indoor', value: 'indoor', icon: 'home' },
    { label: 'Outdoor', value: 'outdoor', icon: 'sun' },
    { label: 'RTT', value: 'rtt', icon: 'radio' },
    { label: 'RTP', value: 'rtp', icon: 'radio' },
    { label: 'GBT', value: 'gbt', icon: 'radio' },
    { label: 'Small Cell', value: 'small-cell', icon: 'radio' },
  ], []);

  useEffect(() => {
    fetchData();
    fetchCounts();
  }, [activeType, localFilters]);

  useEffect(() => {
    if (route.params?.siteType) {
      setActiveType(route.params.siteType);
      setActiveTitle(route.params.title);
    }
  }, [route.params?.siteType]);

  const fetchCounts = async () => {
    try {
      const [distRes, dgRes, ebRes] = await Promise.all([
        api.getSiteDistributionCounts(localFilters),
        api.getDgPresence(localFilters),
        api.getEbPresence(localFilters)
      ]);
      
      let merged: any = {};
      if (distRes && distRes.status === 'success') merged = { ...distRes.data };
      else merged = { ...distRes };

      if (dgRes) {
        const d = dgRes.status === 'success' ? (dgRes.data?.counts || dgRes.data) : dgRes;
        merged.dg = d.dg_sites || d.dg || d.dg_count || 0;
      }
      if (ebRes) {
        const e = ebRes.status === 'success' ? (ebRes.data?.counts || ebRes.data) : ebRes;
        merged.eb = e.eb_sites || e.eb || e.eb_count || 0;
      }
      setCounts(merged);
    } catch (e) {
      console.log("Counts Fetch Error", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getSitesByType(activeType, localFilters);
      if (res && res.status === 'success' && res.data) {
        setData(res.data);
      } else if (Array.isArray(res)) {
        setData(res);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.getSitesByType(activeType, localFilters, 1, 10000);
      const sitesToExport = (res && res.status === 'success') ? res.data : (Array.isArray(res) ? res : []);
      if (sitesToExport.length === 0) {
        Alert.alert("No Data", "Nothing to export.");
        return;
      }
      const csvString = convertToCSV(sitesToExport);
      const fileName = `Sites_${activeTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(filePath, csvString, 'utf8');
      await Share.open({
        title: 'Export Site List',
        url: `file://${filePath}`,
        type: 'text/csv',
        filename: fileName,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert("Export Error", "Failed to export.");
      }
    } finally {
      setExporting(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(item =>
      (item.site_name || '').toLowerCase().includes(q) ||
      (item.site_global_id || item.global_id || '').toString().toLowerCase().includes(q) ||
      (item.site_id || '').toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const renderCard = ({ item }: { item: any }) => {
    const globalId = item.site_global_id || item.global_id || item.site_id || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: globalId.toString() })}
      >
        <View style={styles.headerRow}>
          <Text style={styles.siteName} numberOfLines={1}>{item.site_name || 'Unnamed Site'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.site_type || 'SITE'}</Text>
          </View>
        </View>
        <Text style={styles.subIdText}>Global ID: {globalId}</Text>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>DG Status</Text>
            <Text style={styles.infoValue}>{item.dg_presence || 'N/A'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>EB Status</Text>
            <Text style={styles.infoValue}>{item.eb_presence || 'N/A'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getCountFor = (key: string) => {
    if (!counts) return '';
    const val = counts[key] || counts[key.replace('-', '_')];
    return val !== undefined ? ` (${val})` : '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Distribution Status"
        subtitle={activeTitle}
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          { icon: 'filter', onPress: () => setFilterModalVisible(true), badge: Object.keys(localFilters).length > 0 },
        ]}
      />

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={(f: any) => { setLocalFilters(f); setFilterModalVisible(false); }}
        initialFilters={localFilters}
      />

      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: moderateScale(12) }}>
          {DIST_CATEGORIES.map((cat) => {
            const isActive = activeType === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catPill, isActive && styles.catPillActive]}
                onPress={() => {
                  setActiveType(cat.value);
                  setActiveTitle(cat.label);
                  setSearchQuery('');
                }}
              >
                <AppIcon name={cat.icon as any} size={14} color={isActive ? '#fff' : '#64748b'} style={{ marginRight: moderateScale(6) }} />
                <Text style={[styles.catLabel, isActive && styles.catLabelActive]}>
                  {cat.label}{getCountFor(cat.value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <AppIcon name="search" size={18} color="#64748b" style={{ marginRight: moderateScale(8) }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search site name or ID..."
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

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#1e3c72" style={{ marginTop: verticalScale(50) }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => (item.id || item.site_global_id || index).toString()}
          renderItem={renderCard}
          contentContainerStyle={{ padding: moderateScale(16), paddingBottom: verticalScale(100) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); fetchCounts(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppIcon name="search" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No sites found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  categoryBar: { backgroundColor: '#fff', paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  catPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8), borderRadius: 20, backgroundColor: '#f1f5f9', marginHorizontal: moderateScale(5), borderWidth: 1, borderColor: '#e2e8f0' },
  catPillActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  catLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#64748b' },
  catLabelActive: { color: '#fff' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: moderateScale(16), marginTop: verticalScale(12), paddingHorizontal: moderateScale(12), borderRadius: 12, height: verticalScale(48), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', padding: moderateScale(0), fontWeight: '500' },
  card: { backgroundColor: '#fff', padding: moderateScale(16), borderRadius: 12, marginBottom: verticalScale(12), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(4) },
  siteName: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700', color: '#1e3c72', flex: 1 },
  badge: { backgroundColor: '#e2e8f0', paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 12 },
  badgeText: { fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
  subIdText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', marginBottom: verticalScale(8) },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: verticalScale(10) },
  infoRow: { flexDirection: 'row' },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: verticalScale(2) },
  infoValue: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#334155' },
  empty: { alignItems: 'center', marginTop: verticalScale(50) },
  emptyText: { color: '#94a3b8', marginTop: verticalScale(12), fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '600' }
});