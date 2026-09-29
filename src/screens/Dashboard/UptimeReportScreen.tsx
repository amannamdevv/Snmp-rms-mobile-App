import React, { useEffect, useState, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import * as Animatable from 'react-native-animatable';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import FilterModal from '../../components/FilterModal';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../types/navigation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

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

export default function UptimeReportScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'UptimeReport'>) {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);
    const [activeFilters, setActiveFilters] = useState({});
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [summary, setSummary] = useState<any>(null);
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

    const filteredReportData = useMemo(() => {
        if (!searchQuery) return reportData;
        const q = searchQuery.toLowerCase();
        return reportData.filter(item => (item.state_name || '').toLowerCase().includes(q));
    }, [reportData, searchQuery]);

    const handleExport = async () => {
        setExporting(true);
        try {
            if (reportData.length === 0) {
                Alert.alert("No Data", "No data available to export.");
                return;
            }
            const csvString = convertToCSV(reportData);
            const fileName = `Uptime_Report_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Export Uptime Report',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Export failed.");
            }
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeFilters]);

    const fetchReport = async () => {
        if (!refreshing) setLoading(true);
        try {
            const res = await api.getUptimeSummary(activeFilters);
            if (res && res.status === 'success') {
                setReportData(res.state_report || []);
                setSummary(res.summary);
            }
        } catch (e) {
            console.error("Uptime Report Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderStateCard = ({ item, index }: { item: any, index: number }) => (
        <Animatable.View animation="fadeInLeft" delay={index * 100} style={styles.card}>
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => navigation.navigate('UptimeDetails', { 
                    state_id: item.state_id, 
                    state_name: item.state_name 
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.stateInfo}>
                        <Text style={styles.stateName}>{item.state_name}</Text>
                        <Text style={styles.totalSites}>{item.total_sites} Total Sites</Text>
                    </View>
                    <View style={styles.percentageContainer}>
                        <Text style={[styles.percentageText, { color: item.overall_uptime_percent >= 99 ? '#2E7D32' : '#C62828' }]}>
                            {item.overall_uptime_percent}%
                        </Text>
                        <Text style={styles.percentageLabel}>Overall Uptime</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <AppIcon name="check-circle" size={18} color="#4caf50" />
                        <View style={{ marginLeft: moderateScale(8) }}>
                            <Text style={styles.statVal}>{item.sites_met_sla}</Text>
                            <Text style={styles.statLab}>SLA Met</Text>
                        </View>
                    </View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statBox}>
                        <AppIcon name="alert-circle" size={18} color="#f44336" />
                        <View style={{ marginLeft: moderateScale(8) }}>
                            <Text style={styles.statVal}>{item.sites_not_met_sla}</Text>
                            <Text style={styles.statLab}>Not Met</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Tap to view site-wise details</Text>
                    <AppIcon name="arrow-right" size={14} color="#1e3c72" />
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="UPTIME & SLA"
                subtitle="Performance Dashboard"
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
                onApply={(f) => setActiveFilters(f)} 
                initialFilters={activeFilters} 
            />
            
            {summary && (
                <Animatable.View animation="fadeIn" style={styles.summaryBox}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>{summary.total_states}</Text>
                        <Text style={styles.summaryLab}>States</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>{summary.total_sites}</Text>
                        <Text style={styles.summaryLab}>Sites</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>{summary.report_date?.split('-').reverse().join('/')}</Text>
                        <Text style={styles.summaryLab}>As Of</Text>
                    </View>
                </Animatable.View>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by State Name..."
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
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#1e3c72" />
                    <Text style={styles.loadingText}>Generating Report...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredReportData}
                    keyExtractor={(item) => (item.state_id || item.state_name).toString()}
                    renderItem={renderStateCard}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(); }} colors={['#1e3c72']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <AppIcon name="search" size={60} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No Results Found</Text>
                            <Text style={styles.emptySubtitle}>Try searching for a different state.</Text>
                        </View>
                    }
                />
            )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    header: { padding: moderateScale(20), borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(20) },
    headerTitle: { color: '#fff', fontSize: responsiveFontSize(18), fontWeight: 'bold', flex: 1, marginLeft: moderateScale(15) },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    headerIcon: { padding: moderateScale(8), position: 'relative' },
    filterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },
    summaryBox: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 15, padding: moderateScale(15), marginHorizontal: moderateScale(15), marginTop: verticalScale(15), elevation: 3 },
    summaryItem: { alignItems: 'center' },
    summaryVal: { color: '#1e3c72', fontSize: responsiveFontSize(18), fontWeight: 'bold' },
    summaryLab: { color: '#64748b', fontSize: responsiveFontSize(10), textTransform: 'uppercase', marginTop: verticalScale(2) },
    
    searchContainer: { 
        backgroundColor: '#fff', 
        paddingHorizontal: moderateScale(16), 
        paddingVertical: verticalScale(10), 
        marginHorizontal: moderateScale(15),
        marginTop: verticalScale(15),
        borderRadius: 15,
        flexDirection: 'row', 
        alignItems: 'center',
        elevation: 2
    },
    searchIcon: { marginRight: moderateScale(10) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), color: '#1e293b', height: verticalScale(40), padding: moderateScale(0) },

    listContainer: { padding: moderateScale(15) },
    card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: verticalScale(15), elevation: 3, padding: moderateScale(15), borderLeftWidth: 5, borderLeftColor: '#1e3c72' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stateInfo: { flex: 1 },
    stateName: { fontSize: responsiveFontSize(18), fontWeight: 'bold', color: '#1e3c72' },
    totalSites: { fontSize: responsiveFontSize(12), color: '#64748b', marginTop: verticalScale(2) },
    percentageContainer: { alignItems: 'flex-end' },
    percentageText: { fontSize: responsiveFontSize(22), fontWeight: 'bold' },
    percentageLabel: { fontSize: responsiveFontSize(9), color: '#94a3b8', textTransform: 'uppercase' },
    
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: verticalScale(12) },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: 12 },
    statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    statVal: { fontSize: responsiveFontSize(16), fontWeight: 'bold', color: '#334155' },
    statLab: { fontSize: responsiveFontSize(10), color: '#64748b', marginLeft: moderateScale(2) },
    verticalDivider: { width: 1, height: '60%', backgroundColor: '#e2e8f0' },
    
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: verticalScale(12), paddingTop: verticalScale(10), borderTopWidth: 1, borderTopColor: '#f8fafc' },
    footerText: { fontSize: responsiveFontSize(10), color: '#64748b', fontStyle: 'italic' },
    
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: verticalScale(15), color: '#1e3c72', fontWeight: 'bold' },
    emptyContainer: { alignItems: 'center', marginTop: verticalScale(100) },
    emptyText: { marginTop: verticalScale(15), fontSize: responsiveFontSize(18), color: '#334155', fontWeight: 'bold' },
    emptySubtitle: { marginTop: verticalScale(5), fontSize: responsiveFontSize(14), color: '#94a3b8' }
});
