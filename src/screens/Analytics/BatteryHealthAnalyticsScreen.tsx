import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl,
    Platform, FlatList, Alert, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import Icon from 'react-native-vector-icons/Feather';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import FilterModal from '../../components/FilterModal';
import { useGlobalFilter } from '../../context/FilterContext';

let screenWidth = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') screenWidth = _d.width; } catch(_) {}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    'healthy': { label: 'Healthy & Sufficient', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', border: '#16a34a' },
    'critically-replace': { label: 'Critically: Replace', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: '#dc2626' },
    'poor-replace': { label: 'Poor: Replace', color: '#ea580c', bg: 'rgba(234,88,12,0.12)', border: '#ea580c' },
    'insufficient': { label: 'Insufficient Capacity', color: '#ca8a04', bg: 'rgba(202,138,4,0.12)', border: '#ca8a04' },
    'inefficient': { label: 'Inefficient Operation', color: '#0891b2', bg: 'rgba(8,145,178,0.12)', border: '#0891b2' },
    'no-data': { label: 'Insufficient Data', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: '#6b7280' },
};

const BACKUP_STATUS_CONFIG: Record<string, { cls: string; icon: string; bg: string; border: string; textColor: string }> = {
    'verified': { cls: 'verified', icon: '✓', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)', textColor: '#15803d' },
    'exceeds_specification': { cls: 'verified', icon: '✓', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)', textColor: '#15803d' },
    'measured_only': { cls: 'measured', icon: '📊', bg: 'rgba(42,111,151,0.08)', border: 'rgba(42,111,151,0.25)', textColor: '#1a4f70' },
    'acceptable': { cls: 'acceptable', icon: '✓', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.25)', textColor: '#0e7490' },
    'monitor': { cls: 'monitor', icon: 'ⓘ', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.25)', textColor: '#92400e' },
    'review': { cls: 'review', icon: '⚠', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', textColor: '#b91c1c' },
    'no_sessions': { cls: 'no-data', icon: '?', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', textColor: '#4b5563' },
    'no_data': { cls: 'no-data', icon: '?', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', textColor: '#4b5563' },
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function BatteryHealthAnalyticsScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

    // Data
    const [sitesData, setSitesData] = useState<any[]>([]);

    // Filters
    const [activeBatteryFilter, setActiveBatteryFilter] = useState('all');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [pendingBatteryFilter, setPendingBatteryFilter] = useState('all');

    const { globalFilters, setGlobalFilters, activeFilterCount: gFilterCount } = useGlobalFilter();

    useEffect(() => {
        fetchData();
    }, [JSON.stringify(globalFilters)]);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchData = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const res = await api.getBatteryHealthReport({ ...globalFilters });
            if (res && res.sites) {
                setSitesData(res.sites);
            }
        } catch (e) {
            console.error('Battery Health Fetch Error:', e);
            Alert.alert('Error', 'Failed to fetch battery health data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    // ── Filtering ────────────────────────────────────────────────
    const batteryFilteredSites = useMemo(() => {
        return sitesData.filter(site => {
            const bt = (site.battery_type || '').toLowerCase();
            if (activeBatteryFilter === 'all') return true;
            if (activeBatteryFilter === 'vrla') return bt.includes('vrla');
            if (activeBatteryFilter === 'lithium') return bt.includes('lithium') || bt.includes('li');
            return true;
        });
    }, [sitesData, activeBatteryFilter]);

    const dynamicStats = useMemo(() => {
        const counts: Record<string, number> = {
            'healthy': 0, 'critically-replace': 0, 'poor-replace': 0,
            'insufficient': 0, 'inefficient': 0, 'no-data': 0,
        };
        batteryFilteredSites.forEach(site => {
            const cat = site.site_category || 'no-data';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [batteryFilteredSites]);

    const finalFilteredSites = useMemo(() => {
        let filtered = batteryFilteredSites;
        if (activeCategoryFilter !== 'all') {
            filtered = filtered.filter(site => site.site_category === activeCategoryFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(site =>
                (site.site_name || '').toLowerCase().includes(q) ||
                (site.site_global_id || '').toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [batteryFilteredSites, activeCategoryFilter, searchQuery]);

    // ── Export CSV ───────────────────────────────────────────────
    const handleExport = async (category = 'all') => {
        setExporting(true);
        try {
            const dataToExport = category === 'all'
                ? finalFilteredSites
                : finalFilteredSites.filter(s => s.site_category === category);
            if (dataToExport.length === 0) {
                Alert.alert('No Data', 'No sites to export for this category'); return;
            }
            const header = [
                'Site Name', 'Site ID', 'Battery Type', 'Site Type', 'Tenants', 'DG',
                'Health Status', 'Battery Age', 'Installed AH', 'Required AH',
                'Coverage %', 'Req Backup (hrs)', 'Longest Backup (hrs)',
                'Avg EB (hrs/day)', 'Discharge Rate (V/10min)', 'Charge Rate (V/hr)'
            ].join(',');
            const rows = dataToExport.map(site => {
                const ca = site.assessment?.capacity_analysis || {};
                const ba = site.assessment?.backup_analysis || {};
                const cr = site.charge_discharge_rates || {};
                return [
                    `"${site.site_name || ''}"`,
                    `"${site.site_global_id || ''}"`,
                    `"${site.battery_type || ''}"`,
                    `"${site.site_type || ''}"`,
                    site.tenant_count || 0,
                    site.has_dg ? 'Yes' : 'No',
                    `"${site.assessment?.category || ''}"`,
                    `"${site.year_display || site.year || ''}"`,
                    site.total_ah || 0,
                    ca.required_ah || 0,
                    ca.percentage ? `${ca.percentage}%` : '0%',
                    (ba.required_backup_hours || 0).toFixed(1),
                    (site.longest_session_hours || 0).toFixed(1),
                    (site.avg_eb_hours || 0).toFixed(1),
                    (cr.discharge_rate_per_10min || 0).toFixed(4),
                    (cr.charge_rate_per_hour || 0).toFixed(2),
                ].join(',');
            });
            const csvContent = [header, ...rows].join('\n');
            const fileName = `Battery_Health_${category}_${Date.now()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvContent, 'utf8');
            await Share.open({ url: `file://${filePath}`, type: 'text/csv', title: 'Battery Health Report' });
        } catch (e) { console.error('Export Error:', e); }
        finally { setExporting(false); }
    };

    // ── Toggle card expand ───────────────────────────────────────
    const toggleExpand = (key: string) => {
        setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ── Render KPI Card ──────────────────────────────────────────
    const renderKPI = (catKey: string) => {
        const cfg = CATEGORY_CONFIG[catKey];
        const value = dynamicStats[catKey] || 0;
        const isActive = activeCategoryFilter === catKey;
        return (
            <TouchableOpacity
                key={catKey}
                style={[styles.kpiCard, { borderTopColor: cfg.color }, isActive && { borderColor: cfg.color, borderWidth: 1.5, backgroundColor: cfg.bg }]}
                onPress={() => setActiveCategoryFilter(isActive ? 'all' : catKey)}
                activeOpacity={0.75}
            >
                {isActive && <View style={[styles.activeDot, { backgroundColor: cfg.color }]} />}
                <Text style={[styles.kpiValue, { color: cfg.color }]}>{value}</Text>
                <Text style={styles.kpiLabel}>{cfg.label}</Text>
            </TouchableOpacity>
        );
    };

    // ── Render Site Card ─────────────────────────────────────────
    const renderSiteCard = ({ item }: { item: any }) => {
        const cat = item.site_category || 'no-data';
        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['no-data'];
        const assessment = item.assessment || {};
        const capAnal = assessment.capacity_analysis || {};
        const backAnal = assessment.backup_analysis || {};
        const conds = assessment.conditions_met || {};
        const cr = item.charge_discharge_rates || {};
        const capPct = capAnal.percentage || 0;
        const bvs = item.backup_verification_status || 'no_data';
        const bvCfg = BACKUP_STATUS_CONFIG[bvs] || BACKUP_STATUS_CONFIG['no_data'];
        const cardKey = item.imei_number || item.site_global_id || item.site_name;
        const isExpanded = expandedCards[cardKey] || false;

        // Battery age colour
        let ageColor = '#64748b';
        let ageBadgeText = '';
        let ageBadgeBg = 'rgba(107,114,128,0.1)';
        if (item.battery_age) {
            if (item.battery_age > 5) { ageColor = '#dc2626'; ageBadgeText = 'Replace'; ageBadgeBg = 'rgba(220,38,38,0.1)'; }
            else if (item.battery_age > 3) { ageColor = '#ca8a04'; ageBadgeText = 'Monitor'; ageBadgeBg = 'rgba(202,138,4,0.1)'; }
            else { ageColor = '#16a34a'; ageBadgeText = 'Good'; ageBadgeBg = 'rgba(22,163,74,0.1)'; }
        }

        // Parallel config
        const parallel = (item.parallel || '').toLowerCase();
        const isParallel = parallel === 'yes' || parallel === 'y';
        const banks = item.number_of_battery_banks || 0;

        const condDefs = [
            { key: 'battery_type_identified', label: 'Type ID' },
            { key: 'capacity_adequate', label: 'Capacity' },
            { key: 'backup_adequate', label: 'Backup' },
            { key: 'aging_acceptable', label: 'Aging' },
            { key: 'configuration_efficient', label: 'Config' },
        ];

        return (
            <View style={[styles.siteCard, { borderLeftColor: cfg.color }]}>

                {/* ── HEADER ─────────────────────────────────────── */}
                <View style={styles.scHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.scName} numberOfLines={1}>{item.site_name}</Text>
                        <View style={styles.scMeta}>
                            <Text style={styles.scMetaText}>ID: {item.site_global_id || '—'}</Text>
                            <Text style={styles.scMetaDot}>·</Text>
                            <Text style={styles.scMetaText}>{item.site_type || '—'}</Text>
                            <Text style={styles.scMetaDot}>·</Text>
                            <Text style={styles.scMetaText}>{item.tenant_count} tenant{item.tenant_count !== 1 ? 's' : ''}</Text>
                            <Text style={styles.scMetaDot}>·</Text>
                            <Text style={styles.scMetaText}>{item.has_dg ? 'DG' : 'Non-DG'}</Text>
                        </View>
                    </View>
                    <View style={[styles.scBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Text style={[styles.scBadgeText, { color: cfg.color }]}>
                            {assessment.category || cat}
                        </Text>
                    </View>
                </View>

                {/* ── BODY ───────────────────────────────────────── */}
                <View style={styles.scBody}>

                    {/* Row 1: Battery Type | Age | Banks */}
                    <View style={styles.row3}>
                        <View style={styles.infoBox}>
                            <Text style={styles.ibLabel}>BATTERY TYPE</Text>
                            <Text style={[styles.ibValue, {
                                color: (item.battery_type || '').toLowerCase().includes('lithium') ? '#7c3aed'
                                    : (item.battery_type || '').toLowerCase().includes('vrla') ? '#2563eb'
                                        : '#64748b'
                            }]}>{item.battery_type || 'Unknown'}</Text>
                        </View>
                        <View style={[styles.infoBox, { backgroundColor: ageBadgeBg, borderColor: ageBadgeBg }]}>
                            <Text style={styles.ibLabel}>AGE</Text>
                            <Text style={[styles.ibValue, { color: ageColor }]}>{item.year_display || item.year || 'N/A'}</Text>
                            {ageBadgeText ? (
                                <View style={[styles.ageBadge, { backgroundColor: ageBadgeBg }]}>
                                    <Text style={[styles.ageBadgeText, { color: ageColor }]}>{ageBadgeText}</Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.ibLabel}>BANKS</Text>
                            <Text style={[styles.ibValue, { color: '#0891b2' }]}>{banks} bank{banks !== 1 ? 's' : ''}</Text>
                            {banks > 1 && (
                                <Text style={{ fontSize: responsiveFontSize(9), flexShrink: 1, color: '#0891b2', marginTop: verticalScale(2), fontWeight: '700' }}>
                                    {isParallel ? '⚡ Parallel' : '→ Series'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Row 2: Installed AH | Coverage | Avg EB */}
                    <View style={styles.row3}>
                        <View style={styles.infoBox}>
                            <Text style={styles.ibLabel}>INSTALLED</Text>
                            <Text style={styles.ibValue}>{item.total_ah ? Number(item.total_ah).toFixed(0) : '—'} AH</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.ibLabel}>COVERAGE</Text>
                            <Text style={[styles.ibValue, { color: capPct >= 80 ? '#16a34a' : capPct > 0 ? '#dc2626' : '#64748b' }]}>
                                {capPct > 0 ? `${capPct}%` : '—'}
                            </Text>
                            {capAnal.required_ah > 0 && (
                                <Text style={styles.subNote}>Req: {Number(capAnal.required_ah).toFixed(0)} AH</Text>
                            )}
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.ibLabel}>AVG EB / DAY</Text>
                            <Text style={[styles.ibValue, { color: item.avg_eb_hours > 0 ? '#1e3c72' : '#64748b' }]}>
                                {item.avg_eb_hours > 0 ? `${Number(item.avg_eb_hours).toFixed(1)} h` : '—'}
                            </Text>
                        </View>
                    </View>

                    {/* Backup Verification Status Bar */}
                    <View style={[styles.statusBar, { backgroundColor: bvCfg.bg, borderColor: bvCfg.border }]}>
                        <Text style={styles.statusIcon}>{bvCfg.icon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: bvCfg.textColor }]}>
                                {bvs.replace(/_/g, ' ').toUpperCase()}
                            </Text>
                            <Text style={styles.statusMsg} numberOfLines={2}>
                                {item.backup_verification_message || 'No data available'}
                            </Text>
                            {(item.total_sessions_analyzed > 0) && (
                                <View style={styles.statusMetrics}>
                                    <View style={styles.smBox}>
                                        <Text style={styles.smVal}>{Number(item.longest_session_hours || 0).toFixed(1)}h</Text>
                                        <Text style={styles.smLbl}>LONGEST</Text>
                                    </View>
                                    <View style={styles.smBox}>
                                        <Text style={styles.smVal}>{Number(item.avg_session_hours || 0).toFixed(2)}h</Text>
                                        <Text style={styles.smLbl}>AVERAGE</Text>
                                    </View>
                                    <View style={styles.smBox}>
                                        <Text style={styles.smVal}>{item.total_sessions_analyzed}</Text>
                                        <Text style={styles.smLbl}>SESSIONS</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Charge / Discharge Rates */}
                    {cr.has_data && (
                        <View>
                            <Text style={styles.sectionLabel}>⚡ CHARGE / DISCHARGE</Text>
                            <View style={styles.rateRow}>
                                {/* Discharge */}
                                <View style={[styles.rateBox, styles.rateDischarge]}>
                                    <Text style={styles.rateIcon}>↓</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rateLbl}>DISCHARGE</Text>
                                        <Text style={[styles.rateVal, { color: '#dc2626' }]}>
                                            {Number(cr.discharge_rate_per_10min || 0).toFixed(4)} V/10min
                                        </Text>
                                    </View>
                                    {cr.time_to_depletion_hours > 0 && (
                                        <View style={[styles.rateBadge, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
                                            <Text style={[styles.rateBadgeText, { color: '#dc2626' }]}>
                                                {Number(cr.time_to_depletion_hours).toFixed(1)}h
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {/* Charge */}
                                <View style={[styles.rateBox, styles.rateCharge]}>
                                    <Text style={styles.rateIcon}>↑</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rateLbl}>CHARGE</Text>
                                        <Text style={[styles.rateVal, { color: '#16a34a' }]}>
                                            {Number(cr.charge_rate_per_hour || 0).toFixed(2)} V/hr
                                        </Text>
                                    </View>
                                    {cr.charge_duration > 0 && (
                                        <View style={[styles.rateBadge, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
                                            <Text style={[styles.rateBadgeText, { color: '#16a34a' }]}>
                                                {Number(cr.charge_duration).toFixed(1)}h
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {/* Voltage Row */}
                            {cr.max_voltage > 0 && (
                                <View style={styles.voltRow}>
                                    <View style={styles.voltItem}>
                                        <Text style={styles.voltLabel}>MAX V</Text>
                                        <Text style={styles.voltValue}>{Number(cr.max_voltage).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.voltItem}>
                                        <Text style={styles.voltLabel}>MIN V</Text>
                                        <Text style={styles.voltValue}>{Number(cr.min_voltage).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.voltItem}>
                                        <Text style={styles.voltLabel}>RANGE</Text>
                                        <Text style={styles.voltValue}>{Number(cr.max_voltage - cr.min_voltage).toFixed(2)}</Text>
                                    </View>
                                    {cr.discharge_efficiency && cr.discharge_efficiency !== 'N/A' && (
                                        <View style={styles.voltItem}>
                                            <Text style={styles.voltLabel}>EFFICIENCY</Text>
                                            <Text style={[styles.voltValue, { fontSize: responsiveFontSize(11), flexShrink: 1, }]}>{cr.discharge_efficiency}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Conditions */}
                    <View>
                        <Text style={styles.sectionLabel}>✓ CONDITIONS</Text>
                        <View style={styles.condGrid}>
                            {condDefs.map(c => {
                                const isMet = conds[c.key] === true;
                                return (
                                    <View key={c.key} style={[styles.condItem, isMet ? styles.condMet : styles.condUnmet]}>
                                        <Text style={{ fontSize: responsiveFontSize(11), flexShrink: 1, color: isMet ? '#16a34a' : '#dc2626', fontWeight: '800' }}>
                                            {isMet ? '✓' : '✗'}
                                        </Text>
                                        <Text style={[styles.condText, { color: isMet ? '#16a34a' : '#9ca3af' }]}>{c.label}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Expand / Collapse for Recommendations */}
                    <TouchableOpacity
                        style={styles.expandBtn}
                        onPress={() => toggleExpand(cardKey)}
                    >
                        <Text style={styles.expandBtnText}>
                            {isExpanded ? '▲ Hide Recommendations' : '▼ View Recommendations'}
                        </Text>
                    </TouchableOpacity>

                    {isExpanded && (
                        <View style={styles.recBox}>
                            <Text style={styles.recTitle}>💡 Recommendations</Text>
                            {assessment.recommendations?.length > 0
                                ? assessment.recommendations.map((r: string, i: number) => (
                                    <View key={i} style={styles.recItem}>
                                        <Text style={styles.recArrow}>→</Text>
                                        <Text style={styles.recText}>{r}</Text>
                                    </View>
                                ))
                                : <Text style={styles.recEmpty}>No recommendations.</Text>
                            }
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // ── Header Component for FlatList ────────────────────────────
    const ListHeader = () => (
        <View>
            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
                <View style={styles.kpiRow}>
                    {renderKPI('healthy')}
                    {renderKPI('critically-replace')}
                    {renderKPI('poor-replace')}
                </View>
                <View style={styles.kpiRow}>
                    {renderKPI('insufficient')}
                    {renderKPI('inefficient')}
                    {renderKPI('no-data')}
                </View>
            </View>
            {/* Results Bar */}
            <View style={styles.resultsBar}>
                <Text style={styles.resultsText}>
                    <Text style={{ fontWeight: '800', color: '#1e3c72' }}>{finalFilteredSites.length}</Text>
                    {' '}sites shown
                </Text>
            </View>
        </View>
    );

    // ────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Battery Health Assessment"
                leftAction="back"
                onLeftPress={() => navigation.goBack()}
                rightActions={[
                    {
                        icon: exporting ? 'loader' : 'download',
                        onPress: () => Alert.alert(
                            'Export Report',
                            'Select category to export',
                            [
                                { text: 'All Batteries', onPress: () => handleExport('all') },
                                { text: 'Healthy', onPress: () => handleExport('healthy') },
                                { text: 'Critically Replace', onPress: () => handleExport('critically-replace') },
                                { text: 'Poor Replace', onPress: () => handleExport('poor-replace') },
                                { text: 'Insufficient', onPress: () => handleExport('insufficient') },
                                { text: 'Inefficient', onPress: () => handleExport('inefficient') },
                                { text: 'No Data', onPress: () => handleExport('no-data') },
                                { text: 'Cancel', style: 'cancel' },
                            ]
                        ),
                    },
                    
                ]}
            />
            
            

            <View style={styles.filterBar}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {['all', 'vrla', 'lithium'].map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeTab,
                                activeBatteryFilter === type && styles.typeTabActive
                            ]}
                            onPress={() => {
                                setActiveBatteryFilter(type);
                                setActiveCategoryFilter('all');
                            }}
                        >
                            <Text style={[
                                styles.typeTabText,
                                activeBatteryFilter === type && styles.typeTabTextActive
                            ]}>
                                {type === 'all' ? 'All' : type.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeCategoryFilter !== 'all' && (
                    <View style={[styles.filterPill, { backgroundColor: CATEGORY_CONFIG[activeCategoryFilter]?.bg, borderColor: CATEGORY_CONFIG[activeCategoryFilter]?.color }]}>
                        <Text style={[styles.filterPillText, { color: CATEGORY_CONFIG[activeCategoryFilter]?.color }]}>
                            {CATEGORY_CONFIG[activeCategoryFilter]?.label}
                        </Text>
                        <TouchableOpacity onPress={() => setActiveCategoryFilter('all')} style={{ marginLeft: moderateScale(6) }}>
                            <Text style={{ color: CATEGORY_CONFIG[activeCategoryFilter]?.color, fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '900' }}>×</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ flex: 1 }} />
                
                <TouchableOpacity
                    style={[styles.filterBtn, { borderColor: 'rgba(220,38,38,0.2)' }]}
                    onPress={() => { setActiveBatteryFilter('all'); setActiveCategoryFilter('all'); setSearchQuery(''); }}
                >
                    <Text style={[styles.filterBtnText, { color: '#dc2626' }]}>Reset</Text>
                </TouchableOpacity>

            </View>

            {/* Search Bar */}
            <View style={styles.searchWrap}>
                <View style={styles.searchBar}>
                    <Icon name="search" size={18} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Site Name or Global ID..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="x-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Main List */}
            <FlatList
                data={finalFilteredSites}
                keyExtractor={(item, idx) => item.imei_number || item.site_global_id || String(idx)}
                renderItem={renderSiteCard}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
                ListHeaderComponent={<ListHeader />}
                contentContainerStyle={{ paddingBottom: verticalScale(60) }}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>🔋</Text>
                            <Text style={styles.emptyText}>No battery sites found.</Text>
                        </View>
                    ) : null
                }
            />

            {/* Loading overlay */}
            {loading && !refreshing && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#1e3c72" />
                    <Text style={styles.loaderText}>Analyzing battery health…</Text>
                </View>
            )}

        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4ee' },

    // Loader
    loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    loaderText: { marginTop: verticalScale(10), color: '#1e3c72', fontWeight: '700', fontSize: responsiveFontSize(13), flexShrink: 1, },

    // Filter Bar
    filterBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(10), gap: 8, backgroundColor: 'rgba(238,242,249,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(221,228,240,0.8)' },
    filterPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(42,111,151,0.1)', paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6), borderRadius: 20, gap: 4, borderWidth: 1, borderColor: '#2a6f97' },
    filterPillText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#1a4f70' },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(6), borderRadius: 8, borderWidth: 1, borderColor: 'rgba(26,36,64,0.15)', backgroundColor: 'rgba(255,255,255,0.8)' },
    filterBtnText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },

    // Type Tabs
    typeTab: { paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(6), borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde4f0' },
    typeTabActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    typeTabText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#64748b' },
    typeTabTextActive: { color: '#fff' },

    // KPI
    kpiGrid: { padding: moderateScale(14), gap: moderateScale(10) },
    kpiRow: { flexDirection: 'row', gap: moderateScale(10) },
    kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(12), borderTopWidth: 4, borderWidth: 1, borderColor: 'rgba(228,232,239,0.8)', elevation: 2, shadowColor: '#1a2440', shadowOpacity: 0.1, shadowOffset: { width: 0, height: verticalScale(2) }, shadowRadius: 6, position: 'relative', overflow: 'hidden' },
    kpiValue: { fontSize: responsiveFontSize(26), flexShrink: 1, fontWeight: '900', lineHeight: 30 },
    kpiLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: verticalScale(4), textTransform: 'uppercase', lineHeight: 13 },
    activeDot: { position: 'absolute', top: 8, right: 8, width: moderateScale(8), height: verticalScale(8), borderRadius: 4 },

    // Results
    resultsBar: { paddingHorizontal: moderateScale(16), paddingBottom: verticalScale(8) },
    resultsText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '500' },

    // Site Card
    siteCard: { backgroundColor: '#fff', marginHorizontal: moderateScale(14), marginBottom: verticalScale(16), borderRadius: 16, borderLeftWidth: 4, elevation: 3, shadowColor: '#1a2440', shadowOpacity: 0.12, shadowOffset: { width: 0, height: verticalScale(3) }, shadowRadius: 8, overflow: 'hidden' },
    scHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: moderateScale(14), backgroundColor: '#eef2f9', borderBottomWidth: 1, borderBottomColor: '#e4e8ef', gap: moderateScale(10) },
    scName: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700', color: '#1a2540', marginBottom: verticalScale(3) },
    scMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    scMetaText: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#8a96b0', fontWeight: '500' },
    scMetaDot: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#c8d0e0' },
    scBadge: { paddingHorizontal: moderateScale(10), paddingVertical: verticalScale(4), borderRadius: 20, borderWidth: 1, flexShrink: 0, maxWidth: 140 },
    scBadgeText: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

    scBody: { padding: moderateScale(14), gap: moderateScale(12) },

    // Info boxes
    row3: { flexDirection: 'row', gap: 8 },
    infoBox: { flex: 1, backgroundColor: '#f4f7fc', borderWidth: 1, borderColor: '#dde4f0', borderRadius: 8, padding: moderateScale(10) },
    ibLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '700', color: '#8a96b0', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: verticalScale(3) },
    ibValue: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#1a2540' },
    subNote: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#8a96b0', marginTop: verticalScale(2) },
    ageBadge: { marginTop: verticalScale(4), paddingHorizontal: moderateScale(6), paddingVertical: verticalScale(2), borderRadius: 8, alignSelf: 'flex-start' },
    ageBadgeText: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800' },

    // Status bar
    statusBar: { flexDirection: 'row', borderRadius: 8, padding: moderateScale(10), borderWidth: 1, gap: 8, alignItems: 'flex-start' },
    statusIcon: { fontSize: responsiveFontSize(16), flexShrink: 1, marginTop: verticalScale(1) },
    statusTitle: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: verticalScale(2) },
    statusMsg: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#4a5878', lineHeight: 16 },
    statusMetrics: { flexDirection: 'row', marginTop: verticalScale(8), paddingTop: verticalScale(8), borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', gap: 4 },
    smBox: { flex: 1, alignItems: 'center' },
    smVal: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1a2540' },
    smLbl: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#8a96b0', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: verticalScale(1) },

    // Section label
    sectionLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800', color: '#8a96b0', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: verticalScale(8) },

    // Rates
    rateRow: { flexDirection: 'row', gap: 8, marginBottom: verticalScale(8) },
    rateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: moderateScale(10), borderWidth: 1, gap: 8 },
    rateDischarge: { backgroundColor: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.18)' },
    rateCharge: { backgroundColor: 'rgba(22,163,74,0.05)', borderColor: 'rgba(22,163,74,0.18)' },
    rateIcon: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '900' },
    rateLbl: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#8a96b0', textTransform: 'uppercase', letterSpacing: 0.4 },
    rateVal: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '800', marginTop: verticalScale(1) },
    rateBadge: { paddingHorizontal: moderateScale(6), paddingVertical: verticalScale(2), borderRadius: 8 },
    rateBadgeText: { fontSize: responsiveFontSize(9), flexShrink: 1, fontWeight: '800' },

    // Voltage
    voltRow: { flexDirection: 'row', backgroundColor: 'rgba(42,111,151,0.06)', borderRadius: 8, padding: moderateScale(10), borderWidth: 1, borderColor: 'rgba(42,111,151,0.18)', gap: moderateScale(12) },
    voltItem: { flex: 1 },
    voltLabel: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#8a96b0', textTransform: 'uppercase', letterSpacing: 0.4 },
    voltValue: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#1a4f70', marginTop: verticalScale(2) },

    // Conditions
    condGrid: { flexDirection: 'row', gap: 6 },
    condItem: { flex: 1, borderRadius: 8, padding: moderateScale(7), borderWidth: 1, alignItems: 'center', gap: 3 },
    condMet: { backgroundColor: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.3)' },
    condUnmet: { backgroundColor: 'rgba(220,38,38,0.04)', borderColor: 'rgba(220,38,38,0.15)' },
    condText: { fontSize: responsiveFontSize(8), flexShrink: 1, fontWeight: '700', textAlign: 'center' },

    // Expand
    expandBtn: { padding: moderateScale(10), borderWidth: 1, borderColor: '#e4e8ef', borderRadius: 8, alignItems: 'center', backgroundColor: 'transparent' },
    expandBtnText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '700', color: '#4a5878' },

    // Recommendations
    recBox: { backgroundColor: 'rgba(202,138,4,0.06)', borderWidth: 1, borderColor: 'rgba(202,138,4,0.18)', borderRadius: 8, padding: moderateScale(12) },
    recTitle: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#92400e', marginBottom: verticalScale(8) },
    recItem: { flexDirection: 'row', gap: 6, marginBottom: verticalScale(4) },
    recArrow: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#ca8a04', fontWeight: '900' },
    recText: { flex: 1, fontSize: responsiveFontSize(11), flexShrink: 1, color: '#4a5878', lineHeight: 16 },
    recEmpty: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#8a96b0' },

    // Empty
    emptyBox: { alignItems: 'center', marginTop: verticalScale(80), gap: moderateScale(12) },
    emptyIcon: { fontSize: responsiveFontSize(48), flexShrink: 1, opacity: 0.35 },
    emptyText: { color: '#8a96b0', fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '500' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: moderateScale(20) },
    modalBox: { backgroundColor: '#fff', width: '100%', maxWidth: 420, borderRadius: 20, padding: moderateScale(24), elevation: 24 },
    modalTitle: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1a2540', marginBottom: verticalScale(6) },
    modalSub: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#8a96b0', marginBottom: verticalScale(20) },
    modalOption: { flexDirection: 'row', alignItems: 'center', padding: moderateScale(16), backgroundColor: '#f4f7fc', borderRadius: 12, borderWidth: 2, borderColor: '#e4e8ef', marginBottom: verticalScale(10), gap: moderateScale(12) },
    modalOptionSelected: { borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.05)' },
    modalOptionIcon: { fontSize: responsiveFontSize(20), flexShrink: 1, },
    modalOptionLabel: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#4a5878', flex: 1 },
    modalOptionSub: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#8a96b0', marginTop: verticalScale(2) },
    modalApplyBtn: { backgroundColor: '#1e3c72', padding: moderateScale(16), borderRadius: 12, alignItems: 'center', marginTop: verticalScale(8) },
    modalApplyText: { color: '#fff', fontWeight: '800', fontSize: responsiveFontSize(14), flexShrink: 1, },

    // Search
    searchWrap: { paddingHorizontal: moderateScale(14), paddingBottom: verticalScale(10), backgroundColor: 'rgba(238,242,249,0.9)' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: moderateScale(12), height: verticalScale(44), borderWidth: 1, borderColor: '#dde4f0' },
    searchInput: { flex: 1, marginLeft: moderateScale(8), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1a2540', fontWeight: '600', padding: moderateScale(0) },
});