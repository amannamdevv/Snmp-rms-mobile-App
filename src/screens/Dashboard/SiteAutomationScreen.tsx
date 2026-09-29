import React, { useEffect, useState, useMemo } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

// Helper to convert JSON array to CSV string
const convertToCSV = (objArray: any[]) => {
    if (!objArray || objArray.length === 0) return '';
    const allHeadersSet = new Set<string>();
    objArray.forEach(obj => Object.keys(obj).forEach(key => {
        if (typeof obj[key] !== 'object') {
            allHeadersSet.add(key);
        }
    }));
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

export default function SiteAutomationScreen({ navigation }: any) {
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeFilters, setActiveFilters] = useState({});
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchAutomationData();
        fetchSummary();
    }, [statusFilter, activeFilters]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return data;
        const q = searchQuery.toLowerCase();
        return data.filter((s: any) => 
            (s.global_id || '').toLowerCase().includes(q) ||
            (s.site_id || '').toLowerCase().includes(q) ||
            (s.site_name || '').toLowerCase().includes(q) ||
            (s.imei || '').toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    const fetchSummary = async () => {
        try {
            const res = await api.getAutomationStatus(activeFilters);
            if (res) setSummary(res.status === 'success' ? res.data : res);
        } catch (e) { console.log("Summary Fetch Error", e); }
    };

    const fetchAutomationData = async () => {
        if (!refreshing) setLoading(true);
        try {
            const res = await api.getAutomationDetails({ status: statusFilter, ...activeFilters });
            if (res && res.status === 'success') {
                setData(res.data);
            }
        } catch (e) {
            console.error("Automation Fetch Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Fetch comprehensive set for export
            const res = await api.getAutomationDetails({ status: statusFilter, ...activeFilters }, 1, 10000);
            const exportData = (res && res.status === 'success') ? res.data : [];

            if (exportData.length === 0) {
                Alert.alert("No Data", "Export ke liye koi data nahi mil raha.");
                return;
            }

            const csvString = convertToCSV(exportData);
            const fileName = `Automation_Details_${new Date().getTime()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Export Automation Details',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Export fail ho gaya.");
            }
        } finally {
            setExporting(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const renderSequenceItem = (seq: any, idx: number) => {
        const isCorrect = seq.status === 'correct';
        return (
            <View key={idx} style={[styles.seqBox, { borderLeftColor: isCorrect ? '#4caf50' : '#f44336' }]}>
                <View style={styles.seqHeader}>
                    <Text style={[styles.seqStatus, { color: isCorrect ? '#4caf50' : '#f44336' }]}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                    </Text>
                    <Text style={styles.seqTime}>{seq.timestamp}</Text>
                </View>

                {seq.time_to_battery !== undefined && (
                    <Text style={styles.seqText}>
                        Time to Battery: <Text style={styles.bold}>{seq.time_to_battery === 'instant' ? 'Instant' : seq.time_to_battery + 's'}</Text> |
                        Time to DG: <Text style={styles.bold}>{seq.time_to_dg === 'instant' ? 'Instant' : seq.time_to_dg + 's'}</Text>
                    </Text>
                )}

                {seq.note && <Text style={styles.note}>Note: {seq.note}</Text>}
                {seq.issue && <Text style={styles.issue}>Issue: {seq.issue}</Text>}
            </View>
        );
    };

    const renderCard = ({ item }: { item: any }) => {
        const isExpanded = expandedId === item.site_id;
        const totalChecked = (item.sequence_analysis.correct_sequences || 0) + (item.sequence_analysis.incorrect_sequences || 0);

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
                >
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1, marginRight: moderateScale(8) }}>
                            <Text style={styles.siteName}>{item.site_name}</Text>
                            <Text style={styles.subText}>Global ID: {item.global_id || item.site_id || '—'} | ID: {item.site_id}</Text>
                        </View>
                        <View style={[styles.tag, item.is_automated ? styles.tagAuto : styles.tagNotAuto]}>
                            <Text style={[styles.tagText, { color: item.is_automated ? '#4caf50' : '#f44336' }]}>
                                {item.is_automated ? 'UNDER AUTO' : 'NOT AUTO'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.locRow}>
                        <Text style={styles.locText}><AppIcon name="map-pin" size={10} /> {item.state_name} / {item.district_name}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.label}>Auto Rate</Text>
                            <Text style={[styles.val, { color: '#2196f3' }]}>{item.sequence_analysis.automation_rate}%</Text>
                        </View>

                        <View style={styles.infoCol}>
                            <Text style={styles.label}>Sequences</Text>
                            <Text style={styles.val}>
                                {item.sequence_analysis.correct_sequences}/{totalChecked} Correct
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.expandBtn}
                            onPress={() => toggleExpand(item.site_id)}
                        >
                            <Text style={styles.expandText}>{isExpanded ? 'Hide' : 'Details'}</Text>
                            <AppIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#2196f3" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.detailsContainer}>
                        <Text style={styles.analysisTitle}>Analysis Feedback:</Text>
                        <Text style={styles.feedbackText}>{item.sequence_analysis.feedback}</Text>

                        <Text style={[styles.analysisTitle, { marginTop: verticalScale(10) }]}>Recent Sequences (Last 5):</Text>
                        {item.sequence_analysis.sequence_details && item.sequence_analysis.sequence_details.length > 0 ? (
                            item.sequence_analysis.sequence_details.slice(0, 5).map((seq: any, idx: number) =>
                                renderSequenceItem(seq, idx)
                            )
                        ) : (
                            <Text style={styles.emptyText}>No sequence data available</Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="Automation Details"
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

                <View style={styles.statusFilterContainer}>
                    {[
                        { id: 'all', label: 'Total Sites', count: summary?.total_sites },
                        { id: 'automated', label: 'Under Automation', count: summary?.under_automation },
                        { id: 'not_automated', label: 'Not Under Automation', count: summary?.not_under_automation }
                    ].map((f) => (
                        <TouchableOpacity
                            key={f.id}
                            style={[styles.statusFilterBtn, statusFilter === f.id && styles.statusFilterBtnActive]}
                            onPress={() => {
                                setStatusFilter(f.id);
                                setSearchQuery(''); // Clear search on tab change
                            }}
                        >
                            <Text style={[styles.statusFilterText, statusFilter === f.id && styles.statusFilterTextActive]}>
                                {f.label} {f.count !== undefined ? `(${f.count})` : ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Global ID or Name..."
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
                        keyExtractor={(item, index) => (item.site_id || index).toString()}
                        renderItem={renderCard}
                        contentContainerStyle={{ padding: moderateScale(16) }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => { setRefreshing(true); fetchAutomationData(); }}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <AppIcon name="search" size={48} color="#cbd5e1" />
                                <Text style={styles.emptyTextMain}>No Data Found</Text>
                                <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
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
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { padding: moderateScale(8), position: 'relative' },
    activeFilterDot: { position: 'absolute', top: 6, right: 6, width: moderateScale(8), height: verticalScale(8), borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

    statusFilterContainer: { flexDirection: 'row', backgroundColor: '#fff', padding: moderateScale(10), gap: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    statusFilterBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: 20, backgroundColor: '#f0f4f8' },
    statusFilterBtnActive: { backgroundColor: '#1e3c72' },
    statusFilterText: { fontSize: responsiveFontSize(12), color: '#1e3c72', fontWeight: '600' },
    statusFilterTextActive: { color: '#fff' },

    searchContainer: { 
        backgroundColor: '#fff', 
        paddingHorizontal: moderateScale(14), 
        paddingVertical: verticalScale(6), 
        flexDirection: 'row', 
        alignItems: 'center',
        marginHorizontal: moderateScale(14),
        marginVertical: verticalScale(10),
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    searchIcon: { marginRight: moderateScale(10) },
    searchInput: { flex: 1, fontSize: responsiveFontSize(13), color: '#1e293b', height: verticalScale(38), padding: moderateScale(0), fontWeight: '500' },

    emptyContainer: { alignItems: 'center', marginTop: verticalScale(50) },
    emptyTextMain: { fontSize: responsiveFontSize(18), fontWeight: '700', color: '#334155', marginTop: verticalScale(12) },
    emptySubtitle: { fontSize: responsiveFontSize(14), color: '#94a3b8', marginTop: verticalScale(4) },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(16), marginBottom: verticalScale(12), elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    siteName: { fontSize: responsiveFontSize(15), fontWeight: '700', color: '#1e3c72' },
    subText: { fontSize: responsiveFontSize(12), color: '#475569', marginTop: verticalScale(2) },
    locRow: { marginTop: verticalScale(4) },
    locText: { fontSize: responsiveFontSize(12), color: '#64748b' },
    tag: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(4), borderRadius: 6 },
    tagAuto: { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
    tagNotAuto: { backgroundColor: 'rgba(244, 67, 54, 0.1)' },
    tagText: { fontSize: responsiveFontSize(12), fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: verticalScale(12) },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoCol: { flex: 1 },
    label: { fontSize: responsiveFontSize(12), color: '#64748b', textTransform: 'uppercase' },
    val: { fontSize: responsiveFontSize(12), fontWeight: '700', marginTop: verticalScale(1) },
    expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: moderateScale(5) },
    expandText: { fontSize: responsiveFontSize(12), color: '#2196f3', fontWeight: '600' },
    detailsContainer: { marginTop: verticalScale(15), padding: moderateScale(12), backgroundColor: '#f8fafc', borderRadius: 8, borderTopWidth: 1, borderTopColor: '#eee' },
    analysisTitle: { fontSize: responsiveFontSize(12), fontWeight: 'bold', color: '#475569', marginBottom: verticalScale(5) },
    feedbackText: { fontSize: responsiveFontSize(12), color: '#334155', lineHeight: 18 },
    seqBox: { backgroundColor: '#fff', padding: moderateScale(10), borderRadius: 6, marginBottom: verticalScale(8), borderLeftWidth: 3, elevation: 1 },
    seqHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(5) },
    seqStatus: { fontSize: responsiveFontSize(12), fontWeight: 'bold' },
    seqTime: { fontSize: responsiveFontSize(12), color: '#64748b' },
    seqText: { fontSize: responsiveFontSize(12), color: '#444' },
    bold: { fontWeight: 'bold' },
    note: { fontSize: responsiveFontSize(12), color: '#475569', fontStyle: 'italic', marginTop: verticalScale(4) },
    issue: { fontSize: responsiveFontSize(12), color: '#dc2626', marginTop: verticalScale(4), fontWeight: '500' },
    emptyText: { fontSize: responsiveFontSize(12), color: '#64748b', fontStyle: 'italic', textAlign: 'center' }
});
