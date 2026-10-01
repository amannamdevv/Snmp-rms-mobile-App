import { useGlobalFilter } from '../../context/FilterContext';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  ScrollView,
  Alert,
  Platform,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutApi } from '../../api';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import FilterModal from '../../components/FilterModal';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../utils/responsive';
import LinearGradient from 'react-native-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'RoboticCallStatus'>;

export default function RoboticCallStatusScreen({ navigation }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total: 0,
    answered: 0,
    unanswered: 0,
    busy: 0,
    na: 0,
    pending: 0
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const { globalFilters } = useGlobalFilter();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('Administrator');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const name = await AsyncStorage.getItem('user_fullname');
      if (name) setFullname(name);
    };
    loadUser();
  }, []);

  const fetchData = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (loading && !isRefresh) return;
    setLoading(true);
    try {
      const res = await api.getRoboticCalls({ 
        status: statusFilter, 
        page: pageNum, 
        limit: 20,
        ...globalFilters 
      });

      if (res && res.status === 'success') {
        const { calls, summary: resSummary, pagination } = res.data;
        
        if (isRefresh) {
          setData(calls);
        } else {
          setData(prev => [...prev, ...calls]);
        }

        setSummary(resSummary);
        setHasNext(pagination.has_next);
        setPage(pageNum);
      }
    } catch (e) {
      console.error("Robotic calls load error:", e);
      Alert.alert("Error", "Failed to fetch robotic call data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, globalFilters, loading]);

  useEffect(() => {
    fetchData(1, true);
  }, [statusFilter, globalFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(1, true);
  };

  const handleExport = async () => {
    if (data.length === 0) {
      Alert.alert("Notice", "No data available to export.");
      return;
    }

    try {
      setExporting(true);
      let allExportData: any[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        // Fetch data for export page by page (due to backend capping page_size)
        const exportParams: any = { 
          status: statusFilter,
          page: currentPage, 
          page_size: 500, // Try 500 but expect cap at backend limit (e.g. 200)
          limit: 500, 
          ...globalFilters 
        };
        
        const res = await api.getRoboticCalls(exportParams);

        if (res && res.status === 'success') {
          const { calls, pagination } = res.data;
          if (calls && calls.length > 0) {
            allExportData = [...allExportData, ...calls];
          }
          
          if (pagination && pagination.has_next && currentPage < 50) {
            currentPage++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
          if (currentPage === 1) throw new Error("API failed to return success status.");
        }
      }

      if (allExportData.length === 0) {
        Alert.alert("Notice", "No data available to export.");
        return;
      }

      const exportData = allExportData;
      
      // Construct CSV
      const headers = ["IMEI NO", "SITE ID", "SITE NAME", "PHONE", "ALARM", "RESULT", "CREATED", "CALL TIME", "TRY", "LEVEL"];
        const rows = exportData.map((item: any) => [
          item.imei_no || '',
          item.site_id || '',
          item.site_name || '',
          item.call_number || '',
          item.alarm_name || '',
          item.call_result || '',
          item.create_dt || '',
          item.call_time || '',
          item.call_try || '',
          item.level || ''
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row: any[]) => row.join(','))
        ].join('\n');

        const fileName = `RoboticCalls_${statusFilter}_${new Date().getTime()}.csv`;
        const safePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        await RNFS.writeFile(safePath, csvContent, 'utf8');

        await Share.open({
          url: `file://${safePath}`,
          type: 'text/csv'
        });
      } catch (error: any) {
      console.error("Export error:", error);
      Alert.alert("Export Error", error.message || "Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const renderKPICard = (label: string, value: number, icon: string, colors: string[], status: string) => {
    const isActive = statusFilter === status;
    return (
      <TouchableOpacity 
        style={[styles.kpiCard, isActive && styles.kpiCardActive]} 
        onPress={() => setStatusFilter(status)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={colors} style={styles.kpiIconContainer}>
          <AppIcon name={icon} size={scale(20)} color="#fff" />
        </LinearGradient>
        <Text style={styles.kpiValueText}>{value}</Text>
        <Text style={styles.kpiLabelText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View>
          <Text style={styles.imeiText}>{item.imei_no}</Text>
          <Text style={styles.phoneText}>{item.call_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status_class === 'status-success' ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={[styles.statusText, { color: item.status_class === 'status-success' ? '#166534' : '#991b1b' }]}>
            {item.call_result}
          </Text>
        </View>
      </View>

      <View style={styles.recordDetailRow}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Site ID</Text>
          <Text style={styles.detailValue}>{item.site_id}</Text>
        </View>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Site Name</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{item.site_name}</Text>
        </View>
      </View>

      <View style={styles.recordDetailRow}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Alarm</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{item.alarm_name}</Text>
        </View>
      </View>

      <View style={styles.recordDetailRow}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{item.create_dt}</Text>
        </View>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>Call Time</Text>
          <Text style={styles.detailValue}>{item.call_time}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>Try: {item.call_try}</Text>
        </View>
        {item.level && (
          <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.tagText, { color: '#1e40af' }]}>Level: {item.level}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const filteredData = data.filter(item => 
    (item.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.site_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.imei_no || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
      <AppHeader 
        title="Robotic Call Status" 
        leftAction="menu"
        onLeftPress={() => setSidebarVisible(true)}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          
        ]}
      />

      

      <View style={styles.kpiWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.kpiContainer}
          contentContainerStyle={styles.kpiContent}
        >
          {renderKPICard("Total", summary.total, "phone", ['#667eea', '#764ba2'], 'all')}
          {renderKPICard("Answered", summary.answered, "check-circle", ['#38ef7d', '#11998e'], 'answered')}
          {renderKPICard("No Answer", summary.unanswered, "x-circle", ['#f9a120', '#f9a120'], 'unanswered')}
          {renderKPICard("Busy", summary.busy, "clock", ['#764ba2', '#6f42c1'], 'busy')}
          {renderKPICard("Channel Unavailable", summary.na, "alert-triangle", ['#ef4444', '#dc2626'], 'na')}
          {renderKPICard("Blocked", summary.pending, "slash", ['#6c757d', '#6c757d'], 'pending')}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID or Site Name..."
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
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item, index) => (item.id || index).toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => hasNext && fetchData(page + 1)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && filteredData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="search" size={scale(48)} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Data Found</Text>
              <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
            </View>
          ) : null
        }
      />
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        handleLogout={async () => {
          await AsyncStorage.removeItem('user_fullname');
          await logoutApi();
          navigation.replace('Login');
        }}
        activeRoute="RoboticCallStatus"
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  kpiWrapper: { 
    backgroundColor: '#fff', 
    borderBottomWidth:1, 
    borderBottomColor: '#e2e8f0',
    paddingVertical: verticalScale(10)
  },
  kpiContainer: { 
    flexGrow: 0
  },
  kpiContent: { 
    paddingHorizontal: moderateScale(15), 
    paddingBottom: verticalScale(10)
  },
  kpiCard: { 
    backgroundColor: '#fff', 
    width: scale(105), 
    marginRight: moderateScale(12), 
    borderRadius: moderateScale(16), 
    padding: moderateScale(14),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  kpiCardActive: { 
    borderColor: '#667eea', 
    backgroundColor: '#f5f8ff',
    transform: [{ scale: 1.02 }]
  },
  kpiIconContainer: { 
    width: scale(35), 
    height: scale(35), 
    borderRadius: scale(18), 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: verticalScale(8)
  },
  kpiValueText: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: 'bold', color: '#1e293b' },
  kpiLabelText: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', textTransform: 'uppercase' },

  searchContainer: {
    backgroundColor: '#fff',
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(12),
    paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(12),
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

  listContent: { padding: moderateScale(15) },
  recordCard: { 
    backgroundColor: '#fff', 
    borderRadius: moderateScale(12), 
    padding: moderateScale(15), 
    marginBottom: verticalScale(12),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12) },
  imeiText: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: 'bold', color: '#1e3c72' },
  phoneText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b' },
  statusBadge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(8) },
  statusText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700' },
  
  recordDetailRow: { flexDirection: 'row', marginBottom: verticalScale(10) },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#94a3b8', textTransform: 'uppercase' },
  detailValue: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#334155', fontWeight: '500' },

  footerRow: { flexDirection: 'row', marginTop: verticalScale(5) },
  tag: { 
    backgroundColor: '#f1f5f9', 
    paddingHorizontal: moderateScale(10), 
    paddingVertical: verticalScale(4), 
    borderRadius: moderateScale(15), 
    marginRight: moderateScale(8) 
  },
  tagText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '600' },

  emptyContainer: { alignItems: 'center', marginTop: verticalScale(50) },
  emptyText: { marginTop: verticalScale(10), color: '#334155', fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700' },
  emptySubtitle: { marginTop: verticalScale(4), color: '#94a3b8', fontSize: responsiveFontSize(13), flexShrink: 1, }
});
