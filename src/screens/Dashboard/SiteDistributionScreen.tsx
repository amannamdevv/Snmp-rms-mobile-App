import React, { useEffect, useState } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import Icon from 'react-native-vector-icons/Feather';
import AppHeader from '../../components/AppHeader';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Alert } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteDistribution'>;

export default function SiteDistributionScreen({ navigation }: Props) {
  const [counts, setCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeFilters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getSiteDistributionCounts(activeFilters);
      if (res.status === 'success') {
        setCounts(res.data);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!counts) return;
    setExporting(true);
    try {
      const rows = [
        { Metric: 'Total Analyzed Sites', Count: counts.total },
        { Metric: 'BSC Sites', Count: counts.bsc },
        { Metric: 'Hub Sites', Count: counts.hub },
        { Metric: 'Sites with DG', Count: counts.dg },
        { Metric: 'Sites without DG', Count: counts.non_dg },
        { Metric: 'Sites with EB', Count: counts.eb },
        { Metric: 'Sites without EB', Count: counts.non_eb },
        { Metric: 'Indoor Sites', Count: counts.indoor },
        { Metric: 'Outdoor Sites', Count: counts.outdoor },
        { Metric: 'RTT Sites', Count: counts.rtt },
        { Metric: 'RTP Sites', Count: counts.rtp },
        { Metric: 'GBT Sites', Count: counts.gbt },
        { Metric: 'Small Cell Sites', Count: counts.small_cell },
      ];

      const csvString = `Metric,Count\n` + rows.map(r => `"${r.Metric}",${r.Count}`).join('\n');
      const fileName = `Site_Distribution_${new Date().getTime()}.csv`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, csvString, 'utf8');
      await Share.open({
        title: 'Export Site Distribution',
        url: `file://${filePath}`,
        type: 'text/csv',
        filename: fileName,
        showAppsToView: true,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Error', 'Failed to generate CSV.');
      }
    } finally {
      setExporting(false);
    }
  };

  const MetricCard = ({ title, val1, label1, key1, val2, label2, key2, color1, color2 }: any) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.row}>
        <TouchableOpacity 
            style={[styles.box, { borderTopColor: color1 }]}
            onPress={() => navigation.navigate('SiteTypeDetails', { siteType: key1, title: label1, filters: activeFilters })}
        >
          <Text style={[styles.boxVal, { color: color1 }]}>{val1 || 0}</Text>
          <Text style={styles.boxLabel}>{label1}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
            style={[styles.box, { borderTopColor: color2 }]}
            onPress={() => navigation.navigate('SiteTypeDetails', { siteType: key2, title: label2, filters: activeFilters })}
        >
          <Text style={[styles.boxVal, { color: color2 }]}>{val2 || 0}</Text>
          <Text style={styles.boxLabel}>{label2}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Site Distribution"
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
        rightActions={[
          { icon: exporting ? 'loader' : 'download', onPress: handleExport },
          { icon: 'filter', onPress: () => setFilterModalVisible(true), badge: Object.keys(activeFilters).length > 0 },
        ]}
      />

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={setActiveFilters}
        initialFilters={activeFilters}
      />

      {loading || !counts ? (
        <ActivityIndicator size="large" color="#1e3c72" style={{ marginTop: verticalScale(50) }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          <MetricCard title="BSC vs Hub Sites" 
            val1={counts.bsc} label1="BSC" key1="bsc" color1="#0ea5e9"
            val2={counts.hub} label2="Hub" key2="hub" color2="#3b82f6" />

          <MetricCard title="DG Presence Status" 
            val1={counts.dg} label1="With DG" key1="dg" color1="#f59e0b"
            val2={counts.non_dg} label2="Without DG" key2="non_dg" color2="#ef4444" />

          <MetricCard title="EB Presence Status" 
            val1={counts.eb} label1="With EB" key1="eb" color1="#10b981"
            val2={counts.non_eb} label2="Without EB" key2="non_eb" color2="#64748b" />

          <MetricCard title="Indoor vs Outdoor" 
            val1={counts.indoor} label1="Indoor" key1="indoor" color1="#8b5cf6"
            val2={counts.outdoor} label2="Outdoor" key2="outdoor" color2="#6366f1" />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tower Type Distribution</Text>
            <View style={styles.grid}>
              {[
                {k: 'rtt', l: 'RTT', c: '#0ea5e9'}, {k: 'rtp', l: 'RTP', c: '#3b82f6'},
                {k: 'gbt', l: 'GBT', c: '#6366f1'}, {k: 'small_cell', l: 'Small Cell', c: '#8b5cf6'}
              ].map(t => (
                <TouchableOpacity key={t.k} style={[styles.gridBox, { borderColor: t.c, backgroundColor: t.c + '10' }]} onPress={() => navigation.navigate('SiteTypeDetails', { siteType: t.k, title: t.l, filters: activeFilters })}>
                    <Text style={[styles.boxVal, { color: t.c }]}>{counts[t.k] || 0}</Text>
                    <Text style={styles.boxLabel}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  iconBtn: { padding: moderateScale(8), position: 'relative' },
  activeFilterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },
  
  content: { padding: moderateScale(16) },
  totalText: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1e3c72', marginBottom: verticalScale(20), textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(16), marginBottom: verticalScale(16), elevation: 3 },
  cardTitle: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#64748b', marginBottom: verticalScale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: moderateScale(12) },
  box: { flex: 1, backgroundColor: '#f8fafc', padding: moderateScale(16), borderRadius: 10, alignItems: 'center', borderTopWidth: 4, elevation: 1 },
  boxVal: { fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '800', marginBottom: verticalScale(4) },
  boxLabel: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(10) },
  gridBox: { width: '48.5%', backgroundColor: '#f8fafc', borderRadius: 12, padding: moderateScale(16), alignItems: 'center', borderTopWidth: 4, elevation: 1 },
});