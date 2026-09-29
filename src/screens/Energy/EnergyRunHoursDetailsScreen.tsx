/**
 * EnergyRunHoursDetailsScreen.tsx
 *
 * API: GET /api/energy/run-hours-details/
 * Params: category, date_from, date_to
 *
 * Response:
 * {
 *   success: true,
 *   category: "EB 22-24hrs",
 *   from_date, to_date,
 *   total_count: 25,
 *   data: [{
 *     site_id, site_name, state_name, district_name, cluster_name,
 *     eb_hours, dg_hours, bb_hours, mains_fail_hours,
 *     eb_hours_total, dg_hours_total, bb_hours_total,
 *     last_updated
 *   }]
 * }
 *
 * Route params: { category, date_from, date_to }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions,
    RefreshControl, Share, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';
import { moderateScale, responsiveFontSize, verticalScale, scale } from '../../utils/responsive';

const { width: SW } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────────
function fmtTs(ts: any) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
function fmtHours(h: any): string {
    if (h === null || h === undefined || h === '') return '—';
    return String(h).includes(':') ? String(h) : `${h}h`;
}

function getEBColor(hours: any): string {
    const raw = String(hours || '0');
    // Handle HH:MM:SS format
    let totalH = 0;
    if (raw.includes(':')) {
        const parts = raw.split(':');
        totalH = parseInt(parts[0]) + parseInt(parts[1]) / 60;
    } else {
        totalH = parseFloat(raw) || 0;
    }
    if (totalH >= 20) return '#10b981'; // green — good EB
    if (totalH >= 12) return '#f59e0b'; // yellow — moderate
    return '#ef4444';                   // red — low EB
}

// ─── Hours Cell ──────────────────────────────────────────────
function HCell({ label, value, color }: { label: string; value: any; color: string }) {
    return (
        <View style={[HC.cell, { borderTopColor: color }]}>
            <Text style={[HC.val, { color }]}>{fmtHours(value)}</Text>
            <Text style={HC.lab}>{label}</Text>
        </View>
    );
}
const HC = StyleSheet.create({
    cell: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: moderateScale(10), alignItems: 'center', borderTopWidth: 3, marginHorizontal: moderateScale(3) },
    val: { fontSize: responsiveFontSize(13), fontWeight: '800', marginBottom: verticalScale(3) },
    lab: { fontSize: responsiveFontSize(8), color: '#64748b', fontWeight: '700', textAlign: 'center' },
});

// ─── Site Card ────────────────────────────────────────────────
function SiteCard({ item, index, isSingleDay }: {
    item: any; index: number; isSingleDay: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ebColor = getEBColor(item.eb_hours);

    return (
        <TouchableOpacity
            style={styles.siteCard}
            onPress={() => setOpen(o => !o)}
            activeOpacity={0.85}
        >
            {/* Top Row */}
            <View style={styles.cardTop}>
                <View style={styles.cardNumBox}>
                    <Text style={styles.cardNum}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.siteName} numberOfLines={1}>{item.site_name || '—'}</Text>
                    <Text style={styles.siteId}>GID: {item.global_id || item.site_id || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.ebBadge, { backgroundColor: `${ebColor}15`, borderColor: ebColor }]}>
                        <Text style={[styles.ebBadgeTxt, { color: ebColor }]}>
                            EB {fmtHours(item.eb_hours)}
                        </Text>
                    </View>
                        <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#94a3b8" />
                </View>
            </View>

            {/* Location row */}
            <View style={styles.locationRow}>
                <AppIcon name="map-pin" size={10} color="#94a3b8" />
                <Text style={styles.locationTxt} numberOfLines={1}>
                    {[item.state_name, item.district_name, item.cluster_name].filter(Boolean).join('  ·  ')}
                </Text>
            </View>

            {/* Expanded detail */}
            {open && (
                <View style={styles.detailWrap}>
                    <View style={styles.detailDivider} />

                    {/* Hours grid */}
                    <View style={styles.hoursRow}>
                        <HCell label="EB Hours" value={item.eb_hours} color="#01497c" />
                        <HCell label="DG Hours" value={item.dg_hours} color="#2a6f97" />
                        <HCell label="BB Hours" value={item.bb_hours} color="#468faf" />
                        <HCell label="Mains Fail" value={item.mains_fail_hours} color="#ef4444" />
                    </View>

                    {/* Total hours — only for date range */}
                    {!isSingleDay && (
                        item.eb_hours_total !== undefined || item.dg_hours_total !== undefined
                    ) && (
                            <>
                                <Text style={styles.totalLabel}>Total Hours (Full Period)</Text>
                                <View style={styles.hoursRow}>
                                    <HCell label="Total EB" value={item.eb_hours_total} color="#01497c" />
                                    <HCell label="Total DG" value={item.dg_hours_total} color="#2a6f97" />
                                    <HCell label="Total BB" value={item.bb_hours_total} color="#468faf" />
                                    <View style={{ flex: 1 }} />
                                </View>
                            </>
                        )}

                    {/* Last updated */}
                    {!!item.last_updated && (
                        <View style={styles.lastUpdRow}>
                            <AppIcon name="clock" size={10} color="#94a3b8" />
                            <Text style={styles.lastUpdTxt}>{item.last_updated}</Text>
                        </View>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function EnergyRunHoursDetailsScreen({ navigation, route }: any) {
    const {
        category = '',
        date_from = '',
        date_to = '',
    } = route?.params || {};

    const [siteData, setSiteData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [isSingleDay, setIsSingleDay] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => { fetchDetails(); }, []);

    const fetchDetails = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const res = await (api as any).getEnergyRunHoursDetails({
                category,
                date_from,
                date_to,
            });

            if (res?.success) {
                setSiteData(res.data || []);
                setTotalCount(res.total_count || 0);
                setIsSingleDay(res.from_date === res.to_date);
            } else {
                setError(res?.error || 'Failed to load data');
            }
        } catch (e: any) {
            setError(e.message || 'Network error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [category, date_from, date_to]);

    const onRefresh = () => { setRefreshing(true); fetchDetails(true); };

    // Search filter
    const filtered = siteData.filter(s =>
        !search ||
        s.global_id?.toLowerCase().includes(search.toLowerCase()) ||
        s.site_id?.toLowerCase().includes(search.toLowerCase()) ||
        s.site_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.state_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.district_name?.toLowerCase().includes(search.toLowerCase())
    );

    // Share / Export
    const handleExport = async () => {
        if (!siteData.length) return;
        setExporting(true);
        const header = 'S.NO,GLOBAL ID,SITE ID,SITE NAME,STATE,DISTRICT,CLUSTER,EB HRS,DG HRS,BB HRS,MAINS FAIL,LAST UPDATED';

        const rows = siteData.map((s, i) => [
            `"${i + 1}"`,
            `"${s.global_id || ''}"`,
            `"${s.site_id || ''}"`,
            `"${s.site_name || ''}"`,
            `"${s.state_name || ''}"`,
            `"${s.district_name || ''}"`,
            `"${s.cluster_name || ''}"`,
            `"${s.eb_hours || ''}"`,
            `"${s.dg_hours || ''}"`,
            `"${s.bb_hours || ''}"`,
            `"${s.mains_fail_hours || ''}"`,
            `"${fmtTs(s.last_updated)}"`,
        ].join(','));

        const title = `"SITE-WISE ENERGY RUN HOURS - ${category.toUpperCase()} (${date_from}${date_from !== date_to ? ` to ${date_to}` : ''})"`;
        const csvContent = [title, '', header, ...rows].join('\n');

        const path = `${RNFS.TemporaryDirectoryPath}/energy_details_${category.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        
        try {
            await RNFS.writeFile(path, csvContent, 'utf8');
            await RNShare.open({
                url: `file://${path}`,
                type: 'text/csv',
                filename: 'Energy_Details_Report',
                title: 'Share Energy Details'
            });
        } catch (e: any) {
            console.log('Export error:', e);
            if (e?.message !== 'User did not share') {
                try { await Share.share({ message: csvContent, title: 'Energy Report' }); } catch (err) { }
            }
        } finally {
            setExporting(false);
        }
    };

    const dateLabel = date_from === date_to
        ? date_from
        : `${date_from} → ${date_to}`;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title={category}
                subtitle={dateLabel}
                leftAction="back"
                onLeftPress={() => navigation.goBack()}
                rightActions={[
                    { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                ]}
            />

            {error ? (
                <View style={styles.errorBox}>
                    <AppIcon name="alert-circle" size={32} color="#ef4444" />
                    <Text style={styles.errorTxt}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchDetails()}>
                        <Text style={styles.retryTxt}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, i) => `${item.site_id || i}`}
                        contentContainerStyle={{ padding: moderateScale(14), paddingBottom: verticalScale(30) }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#01497c']} />
                        }
                        ListHeaderComponent={
                            <View>
                                {/* Stats banner — matches website */}
                                <View style={styles.statsBanner}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statVal}>{totalCount}</Text>
                                        <Text style={styles.statLab}>TOTAL SITES</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statVal}>{filtered.length}</Text>
                                        <Text style={styles.statLab}>MATCHING</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statVal, { fontSize: responsiveFontSize(12) }]}>{dateLabel}</Text>
                                        <Text style={styles.statLab}>DATE</Text>
                                    </View>
                                </View>

                                <View style={{ marginBottom: verticalScale(10) }}>
                                    <Text style={styles.listTitle}>Site-wise Details</Text>
                                </View>

                                {/* Search */}
                                <View style={styles.searchRow}>
                                    <AppIcon name="search" size={14} color="#94a3b8" />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by Global ID or Name..."
                                        placeholderTextColor="#94a3b8"
                                        value={search}
                                        onChangeText={setSearch}
                                    />
                                    {!!search && (
                                        <TouchableOpacity onPress={() => setSearch('')}>
                                            <AppIcon name="x" size={14} color="#94a3b8" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Column header row — matches website table */}
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.thTxt, { width: moderateScale(28) }]}>#</Text>
                                    <Text style={[styles.thTxt, { flex: 1.5 }]}>SITE</Text>
                                    <Text style={[styles.thTxt, { flex: 1 }]}>EB</Text>
                                    <Text style={[styles.thTxt, { flex: 1 }]}>DG</Text>
                                    <Text style={[styles.thTxt, { flex: 1 }]}>BB</Text>
                                    <Text style={[styles.thTxt, { flex: 1 }]}>MAINS</Text>
                                </View>
                            </View>
                        }
                        renderItem={({ item, index }) => (
                            <SiteCard item={item} index={index} isSingleDay={isSingleDay} />
                        )}
                        ListFooterComponent={loading ? <ActivityIndicator size="small" color="#01497c" style={{ margin: moderateScale(20) }} /> : null}
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyBox}>
                                    <AppIcon name="inbox" size={38} color="#cbd5e1" />
                                    <Text style={styles.emptyTxt}>
                                        {search ? 'No sites match your search' : 'No sites found'}
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            )}
            </View>
        </SafeAreaView>
    );
}

// ─── STYLES ───────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    listContainer: { flex: 1, maxWidth: 650, alignSelf: 'center', width: '100%' },
    loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderTxt: { marginTop: verticalScale(12), color: '#01497c', fontWeight: '600', fontSize: responsiveFontSize(13) },

    // Stats banner — matches website "25 Sites Found"
    statsBanner: { backgroundColor: '#fff', borderRadius: 14, padding: moderateScale(16), flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(12), elevation: 2 },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: responsiveFontSize(22), fontWeight: '800', color: '#01497c', marginBottom: verticalScale(4) },
    statLab: { fontSize: responsiveFontSize(8), color: '#64748b', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
    statDivider: { width: 1, height: scale(36), backgroundColor: '#e2e8f0' },

    // Export row
    exportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) },
    listTitle: { fontSize: responsiveFontSize(13), fontWeight: '800', color: '#0f172a' },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#89C2D9', borderRadius: 8, paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8) },
    exportTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(12) },

    // Search
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(8), marginBottom: verticalScale(10), elevation: 1, gap: 8 },
    searchInput: { flex: 1, fontSize: responsiveFontSize(12), color: '#0f172a', fontWeight: '500' },

    // Table header
    tableHeader: { flexDirection: 'row', backgroundColor: '#01497c', borderRadius: 8, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(8), marginBottom: verticalScale(8), alignItems: 'center' },
    thTxt: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.3 },

    // Site Card
    siteCard: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), marginBottom: verticalScale(8), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: verticalScale(6) },
    cardNumBox: { width: scale(24), height: scale(24), borderRadius: scale(12), backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    cardNum: { fontSize: responsiveFontSize(10), fontWeight: '800', color: '#64748b' },
    siteName: { fontSize: responsiveFontSize(12), fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(2) },
    siteId: { fontSize: responsiveFontSize(9), color: '#64748b', fontFamily: 'monospace' },
    ebBadge: { paddingHorizontal: moderateScale(8), paddingVertical: verticalScale(3), borderRadius: 8, borderWidth: 1 },
    ebBadgeTxt: { fontSize: responsiveFontSize(10), fontWeight: '800' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: verticalScale(2) },
    locationTxt: { fontSize: responsiveFontSize(9), color: '#64748b', flex: 1 },

    // Detail
    detailWrap: { marginTop: verticalScale(10) },
    detailDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: verticalScale(12) },
    hoursRow: { flexDirection: 'row', marginBottom: verticalScale(10) },
    totalLabel: { fontSize: responsiveFontSize(9), fontWeight: '800', color: '#64748b', marginBottom: verticalScale(8), textTransform: 'uppercase', letterSpacing: 0.5 },
    lastUpdRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: verticalScale(4) },
    lastUpdTxt: { fontSize: responsiveFontSize(9), color: '#94a3b8' },

    // Error
    errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(30) },
    errorTxt: { color: '#ef4444', fontSize: responsiveFontSize(13), fontWeight: '600', marginTop: verticalScale(12), marginBottom: verticalScale(16), textAlign: 'center' },
    retryBtn: { backgroundColor: '#01497c', borderRadius: 10, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(10) },
    retryTxt: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(13) },

    // Empty
    emptyBox: { alignItems: 'center', paddingTop: verticalScale(50) },
    emptyTxt: { color: '#94a3b8', fontSize: responsiveFontSize(13), marginTop: verticalScale(12), fontWeight: '500', textAlign: 'center' },
});