import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl, Platform, Modal, TextInput, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import Icon from 'react-native-vector-icons/Feather';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

let screenWidth = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') screenWidth = _d.width; } catch(_) {}

export default function MasterReport({ navigation }: any) {
    const { globalFilters, setGlobalFilters } = useGlobalFilter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [listData, setListData] = useState<any[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isSidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');

    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [gIdFilter, setGIdFilter] = useState('');

    const [activeFilters, setActiveFilters] = useState<any>(globalFilters)
  // SYNC_GLOBAL_FILTER: Keep local activeFilters in sync with global on mount
  React.useEffect(() => {
    setActiveFilters(globalFilters);
  }, [JSON.stringify(globalFilters)]);
;
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadUser = async () => {
            const name = await AsyncStorage.getItem('user_fullname');
            if (name) setFullname(name);
        };
        loadUser();
    }, []);

    const filteredData = React.useMemo(() => {
        if (!searchQuery) return listData;
        const q = searchQuery.toLowerCase();
        return listData.filter(item =>
            (item.global_id || '').toLowerCase().includes(q) ||
            (item.site_id || '').toLowerCase().includes(q) ||
            (item.site_name || '').toLowerCase().includes(q) ||
            (item.imei || '').toLowerCase().includes(q)
        );
    }, [listData, searchQuery]);

    const fetchReportData = async (page = 1, currentFilters = activeFilters) => {
        setLoading(true);
        try {
            const params = {
                date: (currentFilters.date || date.toISOString().split('T')[0]),
                global_id: gIdFilter,
                ...currentFilters,
            };

            const res = await api.getMasterReport(params, page);

            if (res.results) {
                setListData(res.results);
                setTotalRecords(res.count);
                setTotalPages(res.total_pages);
                setCurrentPage(res.current_page);
            } else {
                setListData([]);
                setTotalRecords(0);
                setTotalPages(1);
            }
        } catch (e) {
            console.log("Master Report Fetch Error", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApplyFilters = (newFilters: any) => {
    setGlobalFilters(newFilters); // persist globally
        setActiveFilters(newFilters);
        setCurrentPage(1);
        fetchReportData(1, newFilters);
    };

    const handleExport = async () => {
        if (!listData.length) return Alert.alert('No data', 'Nothing to export.');
        setExporting(true);
        try {
            const params = new URLSearchParams({
                export: 'excel',
                date: (activeFilters.date_from || date.toISOString().split('T')[0]),
                ...activeFilters,
            }).toString();

            const url = `https://snmp-rms.shrotitele.com/api/rms/master-report/?${params}&format=csv`;
            
            // For Master Report, since it's a large dataset, we'll fetch the CSV URL and download it or just link it.
            // But the user wants consistency, so we'll try to fetch the CSV content if possible.
            // However, the existing Linking.openURL is safer for huge blobs.
            // We'll just keep the Linking but maintain the loader for a consistent feel.
            await Linking.openURL(url);
        } catch (e) {
            console.log("Master Report Export Error", e);
        } finally {
            setTimeout(() => setExporting(false), 2000);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const renderItem = (item: any, index: number) => {
        const uniqueId = `${item.imei}-${index}`;
        const isExpanded = expandedIds.includes(uniqueId);

        return (
            <TouchableOpacity
                key={uniqueId}
                style={[styles.reportCard, item.active_alarms_count > 0 && styles.alarmCard]}
                onPress={() => toggleExpand(uniqueId)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.siteName}>{item.site_name}</Text>
                        <Text style={styles.siteId}>
                            <Text style={{ color: '#334155', fontWeight: 'bold' }}>Global ID: {item.global_id || '—'}</Text>
                            {'  |  '}Site ID: {item.site_id}
                        </Text>
                        <Text style={[styles.siteId, { marginTop: 4 }]}>
                            <Text style={{ color: '#334155', fontWeight: 'bold' }}>IMEI: {item.imei || '—'}</Text>
                        </Text>
                    </View>
                    <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
                </View>

                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Batt Volt</Text>
                        <Text style={[styles.summaryValue, { color: '#2ecc71' }]}>{item.bts_volt}V</Text>
                    </View>
                    <View style={[styles.summaryItem, { flex: 1.5 }]}>
                        <Text style={styles.summaryLabel}>Updated At</Text>
                        <Text style={styles.summaryValue}>{item.updated_time ? new Date(item.updated_time).toLocaleString() : '-'}</Text>
                    </View>
                </View>

                <View style={styles.durationRow}>
                    <View style={styles.durBox}>
                        <Icon name="zap" size={14} color="#3498db" />
                        <Text style={styles.durText}>Mains: {item.mains_duration}</Text>
                    </View>
                    <View style={styles.durBox}>
                        <Icon name="activity" size={14} color="#e67e22" />
                        <Text style={styles.durText}>DG: {item.dg_duration}</Text>
                    </View>
                    <View style={styles.durBox}>
                        <Icon name="battery" size={14} color="#2ecc71" />
                        <Text style={styles.durText}>Batt: {item.bts_duration}</Text>
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.divider} />

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Mains R/Y/B:</Text>
                            <Text style={styles.detailValue}>{item.mains_r}/{item.mains_y}/{item.mains_b}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>DG R/Y/B:</Text>
                            <Text style={styles.detailValue}>{item.dg_r}/{item.dg_y}/{item.dg_b}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Active Alarms:</Text>
                            <Text style={[styles.detailValue, { color: item.active_alarms_count > 0 ? '#e74c3c' : '#2ecc71' }]}>
                                {item.active_alarms_count || 0} ({item.active_alarms || 'None'})
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Active Alarm Start:</Text>
                            <Text style={styles.detailValueSmall}>
                                {item.active_alarm_start_time ? new Date(item.active_alarm_start_time).toLocaleString() : '-'}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Last Alarm:</Text>
                            <Text style={styles.detailValue}>{item.last_alarm || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Alarm Start/End:</Text>
                            <Text style={styles.detailValueSmall}>
                                {item.alarm_start ? new Date(item.alarm_start).toLocaleString() : '-'} / {item.alarm_end ? new Date(item.alarm_end).toLocaleString() : '-'}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Volt Start/End:</Text>
                            <Text style={styles.detailValue}>{item.start_volt || '-'} / {item.end_volt || '-'}</Text>
                        </View>

                        <Text style={styles.sectionTitle}>System Settings</Text>
                        <View style={styles.settingsGrid}>
                            <View style={styles.settingItem}>
                                <Text style={styles.settingLabel}>Batt LVD Trip</Text>
                                <Text style={styles.settingValue}>{item.battery_lvd_trip || '-'}</Text>
                            </View>
                            <View style={styles.settingItem}>
                                <Text style={styles.settingLabel}>Load LVD Trip</Text>
                                <Text style={styles.settingValue}>{item.load_lvd_trip || '-'}</Text>
                            </View>
                            <View style={styles.settingItem}>
                                <Text style={styles.settingLabel}>Batt Low Alm</Text>
                                <Text style={styles.settingValue}>{item.battery_low_alarm || '-'}</Text>
                            </View>
                            <View style={styles.settingItem}>
                                <Text style={styles.settingLabel}>VRLA AH</Text>
                                <Text style={styles.settingValue}>{item.vrla_ah_setting || '-'}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="SNMP-RMS Master Report"
                    leftAction="menu"
                    onLeftPress={() => setSidebarVisible(true)}
                    rightActions={[
                        { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                        
                    ]}
                />

            <View style={styles.inlineFilterBar}>
                <View style={styles.filterGroup}>
                   <Text style={styles.filterLabel}>Date</Text>
                   <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                       <Text style={styles.datePickerText}>{date.toISOString().split('T')[0]}</Text>
                       <Icon name="calendar" size={14} color="#1e3c72" />
                   </TouchableOpacity>
                </View>
                <View style={[styles.filterGroup, { flex: 1 }]}>
                   <Text style={styles.filterLabel}>Global ID</Text>
                   <View style={styles.gIdInputBox}>
                       <TextInput 
                           style={styles.gIdInput}
                           placeholder="GID..."
                           value={gIdFilter}
                           onChangeText={setGIdFilter}
                           placeholderTextColor="#94a3b8"
                       />
                       {!!gIdFilter && <TouchableOpacity onPress={() => setGIdFilter('')}><Icon name="x" size={14} color="#94a3b8" /></TouchableOpacity>}
                   </View>
                </View>
                <TouchableOpacity 
                    style={styles.searchIconButton} 
                    onPress={() => fetchReportData(1, { ...activeFilters, date: date.toISOString().split('T')[0], global_id: gIdFilter })}
                    activeOpacity={0.8}
                >
                    <Icon name="search" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                    }}
                />
            )}

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Icon name="search" size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Global ID or Name..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="x" size={20} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            
      

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.countBar}>
                    <Text style={styles.countText}>{totalRecords} RECORDS FOUND FOR THE DAY</Text>
                    <View style={styles.countLine} />
                </View>

                <View style={styles.listContainer}>
                    {loading ? (
                        <ActivityIndicator color="#1e3c72" size="large" style={{ marginTop: verticalScale(50) }} />
                    ) : filteredData.length > 0 ? (
                        filteredData.map((item, idx) => renderItem(item, idx))
                    ) : (
                        <View style={styles.noData}>
                            <Icon name={searchQuery ? "search" : "database"} size={50} color="#cbd5e1" />
                            <Text style={styles.noDataText}>
                                {searchQuery ? `No results found for "${searchQuery}"` : "Enter filters and search"}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Pagination */}
                {totalPages > 1 && (
                    <View style={styles.pagination}>
                        <TouchableOpacity
                            disabled={currentPage === 1}
                            onPress={() => fetchReportData(currentPage - 1)}
                            style={[styles.pageBtn, currentPage === 1 && { opacity: 0.5 }]}
                        >
                            <Icon name="chevron-left" size={20} color="#1e3c72" />
                        </TouchableOpacity>
                        <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
                        <TouchableOpacity
                            disabled={currentPage === totalPages}
                            onPress={() => fetchReportData(currentPage + 1)}
                            style={[styles.pageBtn, currentPage === totalPages && { opacity: 0.5 }]}
                        >
                            <Icon name="chevron-right" size={20} color="#1e3c72" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: verticalScale(100) }} />
            </ScrollView>


            <Sidebar
                isVisible={isSidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation}
                fullname={fullname} activeRoute="MasterReport"
                handleLogout={async () => { await AsyncStorage.removeItem('user_fullname'); await logoutApi(); navigation.replace('Login'); }}
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    countBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(20), marginTop: verticalScale(15), gap: moderateScale(10) },
    countText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
    countLine: { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
    headerStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: moderateScale(15), backgroundColor: '#fff', marginHorizontal: moderateScale(15), marginTop: moderateScale(15), borderRadius: moderateScale(15), elevation: 3 },
    searchContainer: { paddingHorizontal: moderateScale(15), marginTop: moderateScale(15) },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: moderateScale(12), paddingHorizontal: moderateScale(12), height: moderateScale(45), elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: verticalScale(2) }, shadowOpacity: 0.1, shadowRadius: 4 },
    searchIcon: { marginRight: moderateScale(8) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', paddingVertical: verticalScale(0) },
    statBox: { backgroundColor: '#f1f5f9', paddingHorizontal: moderateScale(15), paddingVertical: moderateScale(8), borderRadius: moderateScale(12) },
    inlineFilterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(10), padding: moderateScale(12), backgroundColor: '#fff', marginHorizontal: moderateScale(15), marginTop: verticalScale(15), borderRadius: 15, alignItems: 'flex-end', elevation: 3 },
    filterGroup: { gap: 4 },
    filterLabel: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: moderateScale(10), height: verticalScale(40), gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    datePickerText: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
    gIdInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: moderateScale(10), height: verticalScale(40), borderWidth: 1, borderColor: '#e2e8f0' },
    gIdInput: { flex: 1, fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '600', color: '#1e3c72', height: '100%', padding: moderateScale(0) },
    searchIconButton: { width: moderateScale(40), height: verticalScale(40), backgroundColor: '#1e3c72', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    statVal: { color: '#1e3c72', fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: 'bold' },
    statLab: { color: '#64748b', fontSize: responsiveFontSize(11), flexShrink: 1, textTransform: 'uppercase' },
    listContainer: { padding: moderateScale(15) },
    reportCard: { backgroundColor: '#fff', borderRadius: moderateScale(15), padding: moderateScale(15), marginBottom: moderateScale(15), elevation: 3, borderLeftWidth: 5, borderLeftColor: '#3498db' },
    alarmCard: { borderLeftColor: '#e74c3c', backgroundColor: '#fff5f5' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(12) },
    siteName: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '900', color: '#1e293b' },
    siteId: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b', marginTop: moderateScale(2) },

    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(10), marginBottom: moderateScale(12) },
    summaryItem: { width: '30%', minWidth: 90 },
    summaryLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#94a3b8', textTransform: 'uppercase' },
    summaryValue: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },

    durationRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: moderateScale(10), backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: moderateScale(8) },
    durBox: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(6) },
    durText: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#475569', fontWeight: 'bold' },

    expandedContent: { marginTop: moderateScale(15) },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: moderateScale(15) },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(8), flexWrap: 'wrap' },
    detailLabel: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b' },
    detailValue: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: 'bold', flex: 1, textAlign: 'right', marginLeft: moderateScale(10) },
    detailValueSmall: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#1e293b', fontWeight: 'bold', flex: 1, textAlign: 'right', marginLeft: moderateScale(10) },

    sectionTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: 'bold', color: '#1e3c72', marginTop: moderateScale(15), marginBottom: moderateScale(10), textTransform: 'uppercase' },
    settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: moderateScale(10) },
    settingItem: { width: '47%', backgroundColor: '#f1f5f9', padding: moderateScale(10), borderRadius: moderateScale(8) },
    settingLabel: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', textTransform: 'uppercase' },
    settingValue: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },

    pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: moderateScale(30), paddingVertical: moderateScale(10) },
    pageBtn: { width: moderateScale(40), height: moderateScale(40), backgroundColor: '#fff', borderRadius: moderateScale(20), justifyContent: 'center', alignItems: 'center', elevation: 2 },
    pageInfo: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#64748b', fontWeight: 'bold' },

    noData: { alignItems: 'center', marginTop: moderateScale(50) },
    noDataText: { color: '#64748b', fontSize: responsiveFontSize(14), flexShrink: 1, marginTop: moderateScale(10) }
});

