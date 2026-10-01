import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import { useFocusEffect } from '@react-navigation/native';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';

// ✅ Import shared utils — same logic as LiveAlarmsScreen
import { normaliseAndMerge, calcAlarmKpi } from '../../utils/alarmUtils';

const renderMiniKPI = (label: string, value: any, color: string) => {
  const displayValue =
    typeof value === 'object' && value !== null && 'count' in value ? value.count : value;
  return (
    <View style={styles.miniKpi}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color }]}>{displayValue ?? 0}</Text>
    </View>
  );
};

export default function HomeScreen({ navigation, route }: any) {
  const [fullname, setFullname] = useState('Administrator');
  const [siteKpi, setSiteKpi] = useState<any>({
    total_sites: 0,
    active_sites: 0,
    non_active_sites: 0,
  });
  const [runningKpi, setRunningKpi] = useState<any>({
    total_soeb: 0,
    total_sodg: 0,
    total_sobt: 0,
    total_slreb: 0,
    total_slrdg: 0,
    total_slrbt: 0,
  });
  const [offlineKpi, setOfflineKpi] = useState<any>({
    total_non_comm: 0,
    aging_buckets: {},
  });
  const [alarmKpi, setAlarmKpi] = useState<any>({
    major: 0,
    minor: 0,
    fire: 0,
    nightDoor: 0,
    open: 0,
    closed: 0,
  });

    const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { globalFilters } = useGlobalFilter();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [globalFilters]);
  const [isSidebarVisible, setSidebarVisible] = useState(false);

  // ── Fullname ──────────────────────────────────────────────────
  useEffect(() => {
    const manageFullname = async () => {
      const paramName = route?.params?.fullname;
      if (paramName && paramName !== 'User') {
        await AsyncStorage.setItem('user_fullname', paramName);
        setFullname(paramName);
      } else {
        const storedName = await AsyncStorage.getItem('user_fullname');
        if (storedName) setFullname(storedName);
      }
    };
    manageFullname();
  }, [route?.params?.fullname]);

  // ── Refresh on tab focus ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [JSON.stringify(globalFilters)])
  );

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [siteRes, runningRes, offlineRes, smpsRes, rmsRes, batteryRes] = await Promise.all([
        api.getSiteStatus(globalFilters).catch(() => null),
        api.getSiteRunningStatus(globalFilters).catch(() => null),
        api.getNonCommAging(globalFilters).catch(() => null),
        api.getSmpsAlarms(globalFilters).catch(() => []),
        api.getRmsAlarms(globalFilters).catch(() => []),
      ]);

      // ── Site KPI ──
      if (siteRes) {
        const raw =
          siteRes.status === 'success'
            ? siteRes.data?.kpi || siteRes.kpi || siteRes.data || siteRes
            : siteRes.kpi || siteRes.data || siteRes;
        setSiteKpi({
          total_sites: raw.total_sites ?? raw.total ?? raw.total_site ?? raw.count ?? 0,
          active_sites: raw.active_sites ?? raw.up_sites ?? raw.up ?? raw.active ?? 0,
          non_active_sites:
            raw.non_active_sites ?? raw.down_sites ?? raw.down ?? raw.non_active ?? raw.offline ?? 0,
        });
      }

      // ── Running KPI ──
      if (runningRes) {
        const raw =
          runningRes.counts ||
          (runningRes.status === 'success'
            ? runningRes.data?.counts || runningRes.data
            : runningRes);
        setRunningKpi({
          total_soeb: raw.total_soeb ?? raw.soeb ?? raw.eb ?? 0,
          total_sodg: raw.total_sodg ?? raw.sodg ?? raw.dg ?? 0,
          total_sobt: raw.total_sobt ?? raw.sobt ?? raw.bt ?? 0,
          total_slreb: raw.total_slreb ?? 0,
          total_slrdg: raw.total_slrdg ?? 0,
          total_slrbt: raw.total_slrbt ?? 0,
        });
      }

      // ── Offline KPI ──
      if (offlineRes) {
        setOfflineKpi(
          offlineRes.status === 'success' ? offlineRes.data || offlineRes : offlineRes
        );
      }

      // ── Alarm KPI  ✅ uses same logic as LiveAlarmsScreen ──
      const merged = normaliseAndMerge(smpsRes, rmsRes);
      setAlarmKpi(calcAlarmKpi(merged));


    } catch (error) {
      console.log('Home Data Fetch Error', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────
  const handleLogout = async () => {
    await AsyncStorage.removeItem('user_fullname');
    await logoutApi();
    navigation.replace('Login');
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        handleLogout={handleLogout}
        activeRoute="Home"
      />
      <SafeAreaView style={styles.container}>
        <AppHeader
          title="Home"
          leftAction="menu"
          onLeftPress={() => setSidebarVisible(true)}
        />
        
        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}>

          {/* 1. Site Status */}
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('SiteStatus')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="activity" size={20} color="#1e3c72" style={{ marginRight: moderateScale(8) }} />
                <Text style={styles.cardHeader}>Site Status</Text>
              </View>
              <AppIcon name="chevron-right" size={20} color="#1e3c72" />
            </View>
            <View style={styles.statsRow}>
              {renderMiniKPI('Total', siteKpi?.total_sites, '#1e3c72')}
              {renderMiniKPI('Active', siteKpi?.active_sites, '#10b981')}
              {renderMiniKPI('Non-Active', siteKpi?.non_active_sites, '#ef4444')}
            </View>
          </TouchableOpacity>

          {/* 2. Non-Comm Aging */}
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('NonCommSites')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="wifi-off" size={20} color="#dc2626" style={{ marginRight: moderateScale(8) }} />
                <Text style={styles.cardHeader}>Non-Comm Sites Aging</Text>
              </View>
              <AppIcon name="chevron-right" size={20} color="#1e3c72" />
            </View>
            <View style={[styles.statsRow, { marginBottom: verticalScale(15) }]}>
              {renderMiniKPI('Total', offlineKpi?.total_non_comm, '#dc2626')}
              {renderMiniKPI('0-7 Days', offlineKpi?.aging_buckets?.['0-7 days'], '#ca8a04')}
              {renderMiniKPI('8-30 Days', offlineKpi?.aging_buckets?.['8-30 days'], '#ea580c')}
            </View>
            <View style={styles.statsRow}>
              {renderMiniKPI('31-60 Days', offlineKpi?.aging_buckets?.['31-60 days'], '#dc2626')}
              {renderMiniKPI('61-90 Days', offlineKpi?.aging_buckets?.['61-90 days'], '#991b1b')}
              {renderMiniKPI('90+ Days', offlineKpi?.aging_buckets?.['90+ days'], '#7f1d1d')}
            </View>
          </TouchableOpacity>

          {/* 3. Site Running Status */}
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('SiteRunningStatus')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="play-circle" size={20} color="#1e3c72" style={{ marginRight: moderateScale(8) }} />
                <Text style={styles.cardHeader}>Site Running Status</Text>
              </View>
              <AppIcon name="chevron-right" size={20} color="#1e3c72" />
            </View>
            <View style={[styles.statsRow, { marginBottom: verticalScale(15) }]}>
              {renderMiniKPI('SOEB', runningKpi?.total_soeb, '#10b981')}
              {renderMiniKPI('SODG', runningKpi?.total_sodg, '#f59e0b')}
              {renderMiniKPI('SOBT', runningKpi?.total_sobt, '#3b82f6')}
            </View>
            <View style={styles.statsRow}>
              {renderMiniKPI('SLREB', runningKpi?.total_slreb, '#059669')}
              {renderMiniKPI('SLRDG', runningKpi?.total_slrdg, '#d97706')}
              {renderMiniKPI('SLRBT', runningKpi?.total_slrbt, '#2563eb')}
            </View>
          </TouchableOpacity>

          {/* 4. Live Alarms */}
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('LiveAlarms', { severity: 'all' })}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="bell" size={20} color="#ef4444" style={{ marginRight: moderateScale(8) }} />
                <Text style={styles.cardHeader}>Site Open Alarm Analytics</Text>
              </View>
              <AppIcon name="chevron-right" size={20} color="#1e3c72" />
            </View>
            <View style={styles.statsRow}>
              {renderMiniKPI('Total Alarms', (alarmKpi?.open || 0) + (alarmKpi?.closed || 0), '#1e3c72')}
              {renderMiniKPI('Active Alarms', alarmKpi?.open || 0, '#ef4444')}
              {renderMiniKPI('Closed Today', alarmKpi?.closed || 0, '#10b981')}
            </View>
          </TouchableOpacity>



          {loading && (
            <ActivityIndicator color="#1e3c72" style={{ marginVertical: verticalScale(20) }} />
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  scrollContent: {
    padding: moderateScale(16),
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: verticalScale(30),
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: verticalScale(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: verticalScale(8),
    marginBottom: verticalScale(12),
  },
  cardHeader: {
    fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700',
    color: '#1e3c72',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniKpi: { alignItems: 'center', flex: 1 },
  miniLabel: {
    fontSize: responsiveFontSize(11), flexShrink: 1, color: '#888',
    fontWeight: 'bold',
    marginBottom: verticalScale(4),
    textTransform: 'uppercase',
  },
  miniValue: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800' },
});


