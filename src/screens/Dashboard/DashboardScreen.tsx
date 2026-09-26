import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { api, logoutApi } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import { moderateScale, responsiveFontSize, verticalScale, scale } from '../../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const DIST_CONFIG: any = {
  bsc: { icon: 'layers', color: '#0ea5e9' },
  hub: { icon: 'server', color: '#3b82f6' },
  dg: { icon: 'cpu', color: '#f59e0b' },
  eb: { icon: 'zap', color: '#10b981' },
  indoor: { icon: 'home', color: '#8b5cf6' },
  outdoor: { icon: 'sun', color: '#ec4899' },
  rtt: { icon: 'radio', color: '#0ea5e9' },
  rtp: { icon: 'radio', color: '#3b82f6' },
  gbt: { icon: 'radio', color: '#6366f1' },
  'small-cell': { icon: 'radio', color: '#8b5cf6' },
};

export default function DashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('Administrator');

  const [healthKpi, setHealthKpi] = useState<any>(null);
  const [vitalsCounts, setVitalsCounts] = useState<any>(null);
  const [autoKpi, setAutoKpi] = useState<any>(null);
  const [uptimeKpi, setUptimeKpi] = useState<any>(null);
  const [distKpi, setDistKpi] = useState<any>({ bsc: 0, hub: 0, indoor: 0, outdoor: 0, eb: 0, dg: 0, rtt: 0, rtp: 0, gbt: 0, 'small-cell': 0 });
  const [batteryKpi, setBatteryKpi] = useState<any>({
    healthy: 0,
    critically_replace: 0,
    poor_replace: 0,
    insufficient: 0,
    inefficient: 0,
    no_data: 0,
  });

  useEffect(() => {
    const loadName = async () => {
      const storedName = await AsyncStorage.getItem('user_fullname');
      if (storedName) setFullname(storedName);
    };
    loadName();
  }, []);

  useFocusEffect(
    useCallback(() => { fetchDashboardData(); }, [])
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let results = await Promise.all([
        api.getSiteHealthCounts({}).catch((e) => { console.log('Err getSiteHealthCounts', e); return null; }),
        api.getBatteryVitalsCounts({}).catch((e) => { console.log('Err getBatteryVitalsCounts', e); return null; }),
        api.getAutomationStatus({}).catch((e) => { console.log('Err getAutomationStatus', e); return null; }),
        api.getUptimeSummary({}).catch((e) => { console.log('Err getUptimeSummary', e); return null; }),
        api.getSiteDistributionCounts({}).catch((e) => { console.log('Err getSiteDistributionCounts', e); return null; }),
        api.getDgPresence({}).catch((e) => { console.log('Err getDgPresence', e); return null; }),
        api.getEbPresence({}).catch((e) => { console.log('Err getEbPresence', e); return null; }),
        api.getBatteryHealthAnalytics({}).catch((e) => { console.log('Err getBatteryHealthAnalytics', e); return null; }),
      ]);

      const [healthRes, vitalsRes, autoRes, uptimeRes, distRes, dgRes, ebRes, batteryRes] = results;

      const extractData = (res: any) => {
        if (!res) return null;
        let data = res;
        if (res.status === 'success' || res.success === true) {
          data = res.data || res.counts || res;
        }
        return data.counts || data.battery_analytics || data;
      };

      if (healthRes) {
        setHealthKpi(extractData(healthRes));
      }
      if (vitalsRes) {
        setVitalsCounts(extractData(vitalsRes));
      }
      if (autoRes) {
        setAutoKpi(extractData(autoRes));
      }
      if (uptimeRes) {
        const upMain = extractData(uptimeRes);
        const report = upMain.state_report || uptimeRes.state_report || [];
        const summary = upMain.summary || uptimeRes.summary || upMain;
        setUptimeKpi({
          ...summary,
          total_met: report.reduce((s: number, r: any) => s + (r.sites_met_sla || 0), 0),
          total_not_met: report.reduce((s: number, r: any) => s + (r.sites_not_met_sla || 0), 0),
          total_states: summary.total_states ?? summary.count ?? report.length ?? 0
        });
      }

      // Distribution
      let distRaw = extractData(distRes);
      let mergedDist: any = {};
      if (distRaw && typeof distRaw === 'object' && !Array.isArray(distRaw)) {
        Object.values(distRaw).forEach(val => { if (val && typeof val === 'object' && !Array.isArray(val)) mergedDist = { ...mergedDist, ...val }; });
        mergedDist = { ...mergedDist, ...distRaw };
      }
      if (dgRes) {
        const dgRaw = extractData(dgRes);
        mergedDist.dg = dgRaw.dg_sites ?? dgRaw.dg ?? dgRaw.total_dg ?? dgRaw.dg_count ?? 0;
      }
      if (ebRes) {
        const ebRaw = extractData(ebRes);
        mergedDist.eb = ebRaw.eb_sites ?? ebRaw.eb ?? ebRaw.total_eb ?? ebRaw.eb_count ?? 0;
      }
      setDistKpi(mergedDist);

      // Battery Health KPI
      if (batteryRes) {
        const battData = extractData(batteryRes);
        const cats = battData.categories || battData || {};
        setBatteryKpi({
          healthy: cats.healthy?.count || 0,
          critically_replace: cats.critically_replace?.count || 0,
          poor_replace: cats.poor_replace?.count || 0,
          insufficient: cats.insufficient?.count || 0,
          inefficient: cats.inefficient?.count || 0,
          no_data: cats.no_data?.count || 0,
        });
      }

    } catch (e) {
      console.log('Dashboard Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderMiniKPI = (label: string, value: any, color: string, screen: string, params?: any) => (
    <TouchableOpacity style={styles.miniKpi} onPress={() => navigation.navigate(screen as any, params || {})}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color }]}>{value ?? 0}</Text>
    </TouchableOpacity>
  );

  const renderDistItem = (label: string, value: any, key: string) => {
    const config = DIST_CONFIG[key] || { icon: 'radio', color: '#64748b' };
    return (
      <TouchableOpacity
        style={styles.miniKpi}
        onPress={() => navigation.navigate('SiteTypeDetails', { siteType: key, title: label + ' Sites', filters: {} })}
      >
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={[styles.miniValue, { color: config.color }]}>{value ?? 0}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Sidebar isVisible={isSidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation} fullname={fullname} handleLogout={async () => { await AsyncStorage.removeItem('user_fullname'); await logoutApi(); navigation.replace('Login'); }} activeRoute="Dashboard" />
      <SafeAreaView style={styles.container}>
        <AppHeader title="DASHBOARD" leftAction="menu" onLeftPress={() => setSidebarVisible(true)} />

        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />}>

          {/* 1. SITE HEALTH */}
          <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteHealth')}>
            <View style={styles.cardHeaderRow}><View style={styles.headerLeft}><AppIcon name="heart" size={20} color="#10b981" style={{ marginRight: 10 }} /><Text style={styles.cardTitle}>Site Health</Text></View><AppIcon name="chevron-right" size={20} color="#1e3c72" /></View>
            <View style={styles.statsRow}>{renderMiniKPI('UP', healthKpi?.up_sites, '#10b981', 'SiteHealth', { status: 'up' })}{renderMiniKPI('DOWN', healthKpi?.down_sites, '#ef4444', 'SiteHealth', { status: 'down' })}{renderMiniKPI('NON-COMM', healthKpi?.non_comm_sites, '#f59e0b', 'SiteHealth', { status: 'non_comm' })}</View>
          </TouchableOpacity>

          {/* 2. SITE VITALS */}
          <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteVitals', { range: 'all' })}>
            <View style={styles.cardHeaderRow}><View style={styles.headerLeft}><AppIcon name="activity" size={20} color="#3b82f6" style={{ marginRight: 10 }} /><Text style={styles.cardTitle}>Site Vitals</Text></View><AppIcon name="chevron-right" size={20} color="#1e3c72" /></View>
            <View style={styles.statsRow}>{renderMiniKPI('Critical', vitalsCounts?.critical?.count ?? vitalsCounts?.critical, '#ed4040', 'SiteVitals', { range: 'critical' })}{renderMiniKPI('At Risk', vitalsCounts?.low?.count ?? vitalsCounts?.low, '#014F86', 'SiteVitals', { range: 'low' })}{renderMiniKPI('Operational', vitalsCounts?.normal?.count ?? vitalsCounts?.normal, '#2A6F97', 'SiteVitals', { range: 'normal' })}</View>
            <View style={{ height: 15 }} /><View style={styles.statsRow}>{renderMiniKPI('Normal', vitalsCounts?.high?.count ?? vitalsCounts?.high, '#61A5C2', 'SiteVitals', { range: 'high' })}{renderMiniKPI('NA', vitalsCounts?.nc?.count ?? vitalsCounts?.nc, '#9e9e9e', 'SiteVitals', { range: 'na' })}{renderMiniKPI('Offline', vitalsCounts?.noncomm?.count ?? vitalsCounts?.noncomm, '#ef4444', 'SiteVitals', { range: 'noncomm' })}</View>
          </TouchableOpacity>

          {/* 2.5 Battery Health Analytics */}
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('BatteryHealthAnalytics')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerLeft}>
                <AppIcon name="battery" size={20} color="#1e3c72" style={{ marginRight: 8 }} />
                <Text style={styles.cardTitle}>Battery Health Analytics</Text>
              </View>
              <AppIcon name="chevron-right" size={20} color="#1e3c72" />
            </View>
            <View style={[styles.statsRow, { marginBottom: 15 }]}>
              {renderMiniKPI('Healthy', batteryKpi.healthy, '#16a34a', 'BatteryHealthAnalytics')}
              {renderMiniKPI('Critical', batteryKpi.critically_replace, '#dc2626', 'BatteryHealthAnalytics')}
              {renderMiniKPI('Poor', batteryKpi.poor_replace, '#ea580c', 'BatteryHealthAnalytics')}
            </View>
            <View style={styles.statsRow}>
              {renderMiniKPI('Insufficient', batteryKpi.insufficient, '#ca8a04', 'BatteryHealthAnalytics')}
              {renderMiniKPI('Inefficient', batteryKpi.inefficient, '#0891b2', 'BatteryHealthAnalytics')}
              {renderMiniKPI('No Data', batteryKpi.no_data, '#6b7280', 'BatteryHealthAnalytics')}
            </View>
          </TouchableOpacity>

          {/* 3. UPTIME SUMMARY */}
          <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('UptimeReport')}>
            <View style={styles.cardHeaderRow}><View style={styles.headerLeft}><AppIcon name="trending-up" size={20} color="#01497C" style={{ marginRight: 10 }} /><Text style={styles.cardTitle}>Uptime Summary (RMS Data-MTD)</Text></View><AppIcon name="chevron-right" size={20} color="#1e3c72" /></View>
            <View style={styles.statsRow}><View style={styles.miniKpi}><Text style={styles.miniLabel}>States</Text><Text style={[styles.miniValue, { color: '#1e3c72' }]}>{uptimeKpi?.total_states || 0}</Text></View><View style={styles.miniKpi}><Text style={styles.miniLabel}>SLA Met</Text><Text style={[styles.miniValue, { color: '#4caf50' }]}>{uptimeKpi?.total_met || 0}</Text></View><View style={styles.miniKpi}><Text style={styles.miniLabel}>SLA Not Met</Text><Text style={[styles.miniValue, { color: '#f44336' }]}>{uptimeKpi?.total_not_met || 0}</Text></View></View>
          </TouchableOpacity>

          {/* 4. SITE AUTOMATION STATUS */}
          <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteAutomation')}>
            <View style={styles.cardHeaderRow}><View style={styles.headerLeft}><AppIcon name="cpu" size={20} color="#61A5C2" style={{ marginRight: 10 }} /><Text style={styles.cardTitle}>Site Automation Status</Text></View><AppIcon name="chevron-right" size={20} color="#1e3c72" /></View>
            <View style={styles.statsRow}><View style={styles.miniKpi}><Text style={styles.miniLabel}>Automated</Text><Text style={[styles.miniValue, { color: '#61A5C2' }]}>{autoKpi?.under_automation || 0}</Text></View><View style={styles.miniKpi}><Text style={styles.miniLabel}>Manual</Text><Text style={[styles.miniValue, { color: '#64748b' }]}>{autoKpi?.not_under_automation || 0}</Text></View><View style={styles.miniKpi}><Text style={styles.miniLabel}>Rate</Text><Text style={[styles.miniValue, { color: '#10b981' }]}>{autoKpi?.automation_percentage || 0}%</Text></View></View>
          </TouchableOpacity>

          {/* --- DISTRIBUTION STATUS CARD --- */}
          <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteTypeDetails', { siteType: 'bsc', title: 'BSC Sites', filters: {} })}>
            <View style={styles.cardHeaderRow}><View style={styles.headerLeft}><AppIcon name="grid" size={20} color="#0ea5e9" style={{ marginRight: 10 }} /><Text style={styles.cardTitle}>Site Type Distribution</Text></View><AppIcon name="chevron-right" size={20} color="#1e3c72" /></View>
            <View style={styles.distGrid}>
              <View style={styles.distRow}>{renderDistItem('BSC Site', distKpi.bsc, 'bsc')}{renderDistItem('Hub Site', distKpi.hub, 'hub')}{renderDistItem('DG Present', distKpi.dg, 'dg')}{renderDistItem('EB Present', distKpi.eb, 'eb')}</View>
              <View style={styles.distRow}>{renderDistItem('Indoor Site', distKpi.indoor, 'indoor')}{renderDistItem('Outdoor Site', distKpi.outdoor, 'outdoor')}{renderDistItem('RTT Site', distKpi.rtt, 'rtt')}{renderDistItem('RTP Site', distKpi.rtp, 'rtp')}</View>
              <View style={styles.distRow}>{renderDistItem('GBT Site', distKpi.gbt, 'gbt')}{renderDistItem('Small Cell', distKpi['small-cell'] || distKpi['small_cell'], 'small-cell')}<View style={styles.miniKpi} /><View style={styles.miniKpi} /></View>
            </View>
          </TouchableOpacity>

          {loading && <ActivityIndicator color="#1e3c72" style={{ marginVertical: 20 }} />}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  scrollContent: { padding: moderateScale(16), maxWidth: 650, alignSelf: 'center', width: '100%', paddingBottom: verticalScale(30) },
  sectionTitle: { fontSize: responsiveFontSize(16), fontWeight: '700', color: '#1e3c72', marginBottom: verticalScale(16), textTransform: 'uppercase', letterSpacing: 0.5 },
  mainCard: { backgroundColor: '#fff', borderRadius: moderateScale(12), padding: moderateScale(16), marginBottom: verticalScale(16), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: verticalScale(8), marginBottom: verticalScale(12) },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: responsiveFontSize(16), fontWeight: '700', color: '#1e3c72' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniKpi: { alignItems: 'center', flex: 1 },
  miniLabel: { fontSize: responsiveFontSize(11), color: '#888', fontWeight: 'bold', marginBottom: verticalScale(4), textTransform: 'uppercase', textAlign: 'center' },
  miniValue: { fontSize: responsiveFontSize(18), fontWeight: '800' },

  distGrid: { width: '100%' },
  distRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(20) }
});