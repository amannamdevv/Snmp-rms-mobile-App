import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import FilterModal from '../../components/FilterModal';
import GlobalFilterBanner from '../../components/GlobalFilterBanner';
import { useGlobalFilter } from '../../context/FilterContext';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TABS = [
  { key: 'monitoring', label: 'Monthly / Qtrly PM' },
  { key: 'circles', label: 'Circle wise' },
  { key: 'clusters', label: 'Hub/Cluster wise' },
  { key: 'approvals', label: 'Zonal/CI approvals' },
  { key: 'openPoints', label: 'Open points tracking' },
  { key: 'fire', label: 'Fire related points' },
  { key: 'infra', label: 'Infra related points' },
  { key: 'hygiene', label: 'Hygiene related points' },
  { key: 'certification', label: 'Alarms certification' }
];

export default function PMAnalyticsScreen({ navigation, route }: any) {
    const { globalFilters, setGlobalFilters } = useGlobalFilter();
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [fullname, setFullname] = useState('Administrator');
    const [activeTab, setActiveTab] = useState('monitoring');

    useEffect(() => {
        AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
    }, []);

    const fetchData = useCallback(async () => {
        // dummy delay to simulate API
        await new Promise(r => setTimeout(r, 600));
        setRefreshing(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, activeTab, globalFilters]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Dummy Data - Web Replica
    const scheduled = 340;
    const completed = 278;
    const ontime = 239;
    const pending = 62;
    const overdue = 22;
    const completionPct = 82;
    const certTotal = 180;
    const certDone = 152;
    const certPending = 28;
    const approvalsTotal = 400;
    const approvalsApproved = 288;
    
    const fire = { open: 18, closed: 6 };
    const infra = { open: 42, closed: 10 };
    const hygiene = { open: 24, closed: 12 };
    const openPointsTotal = fire.open + infra.open + hygiene.open;

    const circles = [
      { name: "Bhopal", completed: 45, scheduled: 50 },
      { name: "Indore", completed: 38, scheduled: 48 },
      { name: "Jabalpur", completed: 32, scheduled: 44 },
      { name: "Gwalior", completed: 28, scheduled: 40 },
      { name: "Sagar", completed: 21, scheduled: 32 },
      { name: "Rewa", completed: 18, scheduled: 28 },
    ];
    const clusters = [
      { name: "MP Nagar", completed: 22, scheduled: 26 },
      { name: "Kolar", completed: 18, scheduled: 24 },
      { name: "Bairagarh", completed: 16, scheduled: 22 },
      { name: "Govindpura", completed: 14, scheduled: 20 },
      { name: "Arera Colony", completed: 12, scheduled: 18 },
      { name: "Ayodhya", completed: 10, scheduled: 16 },
    ];
    const hygieneSubs = [
      { name: "Equipment Cleanliness", completed: 18, scheduled: 28 },
      { name: "Shelter Cleanliness", completed: 22, scheduled: 30 },
      { name: "Safe Access", completed: 14, scheduled: 20 },
    ];

    const renderStaticKPIs = () => (
        <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Scheduled</Text>
                <Text style={styles.kpiVal}>{scheduled}</Text>
                <Text style={styles.kpiSub}>This period</Text>
            </View>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Completed</Text>
                <Text style={styles.kpiVal}>{completed}</Text>
                <Text style={styles.kpiSub}>On-time {ontime}</Text>
            </View>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Pending</Text>
                <Text style={styles.kpiVal}>{pending}</Text>
                <Text style={styles.kpiSub}>Includes in-progress</Text>
            </View>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Overdue</Text>
                <Text style={styles.kpiVal}>{overdue}</Text>
                <Text style={styles.kpiSub}>Needs attention</Text>
            </View>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Completion %</Text>
                <Text style={styles.kpiVal}>{completionPct}%</Text>
                <Text style={styles.kpiSub}>vs Scheduled</Text>
            </View>
            <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Cert. Pending</Text>
                <Text style={styles.kpiVal}>{certPending}</Text>
                <Text style={styles.kpiSub}>Alarms certification</Text>
            </View>
        </View>
    );

    const renderRing = (val: number, color: string, total: number, label: string) => {
        const pct = Math.round((val / (total || 1)) * 100);
        return (
            <View style={styles.ringContainer}>
                <View style={[styles.ring, { borderColor: color }]}>
                    <Text style={styles.ringValue}>{pct}%</Text>
                </View>
                <Text style={styles.ringSub}>{val} {label}</Text>
            </View>
        );
    };

    const renderBars = (data: any[]) => (
        <View style={{ marginTop: verticalScale(10), width: '100%' }}>
            {data.map((c, i) => {
                const w = Math.round((c.completed / c.scheduled) * 100) || 0;
                return (
                    <View key={i} style={styles.barRow}>
                        <View style={styles.barHeader}>
                            <Text style={styles.barLabel}>{c.name}</Text>
                            <Text style={styles.barValue}>{w}%</Text>
                        </View>
                        <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${w}%` }]} />
                        </View>
                    </View>
                );
            })}
        </View>
    );

    const renderActiveView = () => {
        switch (activeTab) {
            case 'monitoring':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Monitoring Completion</Text>
                        {renderRing(completed, '#3b82f6', scheduled, 'completed')}
                    </View>
                );
            case 'circles':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Circle wise completion</Text>
                        {renderBars(circles)}
                    </View>
                );
            case 'clusters':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Hub/Cluster wise completion</Text>
                        {renderBars(clusters)}
                    </View>
                );
            case 'approvals':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Zonal Head/ CI approvals</Text>
                        {renderRing(approvalsApproved, '#0ea5e9', approvalsTotal, 'approved')}
                    </View>
                );
            case 'openPoints':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Tracking Open points for closure</Text>
                        {renderRing(openPointsTotal, '#f43f5e', openPointsTotal + fire.closed + infra.closed + hygiene.closed, 'open points')}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: moderateScale(20) }}>
                            <Text style={styles.subStat}>Fire: {fire.open}</Text>
                            <Text style={styles.subStat}>Infra: {infra.open}</Text>
                            <Text style={styles.subStat}>Hygiene: {hygiene.open}</Text>
                        </View>
                    </View>
                );
            case 'fire':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Fire related points</Text>
                        {renderRing(fire.open, '#ef4444', fire.open + fire.closed, 'open')}
                    </View>
                );
            case 'infra':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Infra related points</Text>
                        {renderRing(infra.open, '#f59e0b', infra.open + infra.closed, 'open')}
                    </View>
                );
            case 'hygiene':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Hygiene related points</Text>
                        {renderRing(hygiene.open, '#3b82f6', hygiene.open + hygiene.closed, 'open')}
                        {renderBars(hygieneSubs)}
                    </View>
                );
            case 'certification':
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Alarms certification tracking</Text>
                        {renderRing(certDone, '#10b981', certTotal, 'certified')}
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <AppHeader
                    title="PM ANALYTICS"
                    subtitle="Preventive Maintenance Overview"
                    leftAction="menu"
                    onLeftPress={() => setSidebarVisible(true)}
                    rightActions={[
                        
                    ]}
                />
                
                

                {/* Horizontal Tabs */}
                <View style={styles.tabsWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                        {TABS.map(tab => (
                            <TouchableOpacity 
                                key={tab.key}
                                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <ScrollView 
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
                >
                    {/* The 6 Static KPIs */}
                    {renderStaticKPIs()}

                    {/* Dynamic View Section */}
                    {renderActiveView()}
                    
                </ScrollView>

                
                <Sidebar
                    isVisible={sidebarVisible}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                    fullname={fullname}
                    activeRoute="PMAnalytics"
                    handleLogout={async () => {
                        await AsyncStorage.multiRemove(['userToken', 'djangoSession', 'user_id', 'role']);
                        navigation.replace('Login');
                    }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    content: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 },
    tabsWrapper: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: verticalScale(10)
    },
    tabsContent: {
        paddingHorizontal: moderateScale(15),
        gap: moderateScale(8)
    },
    tab: {
        paddingHorizontal: moderateScale(16),
        paddingVertical: verticalScale(8),
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    tabActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#0284c7'
    },
    tabText: {
        fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b',
        fontWeight: '600'
    },
    tabTextActive: {
        color: '#0284c7',
        fontWeight: '700'
    },
    listContainer: { padding: moderateScale(15), paddingBottom: verticalScale(40) },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: verticalScale(16)
    },
    kpiBox: {
        width: '31%', // Fits 3 columns nicely
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: moderateScale(10),
        marginBottom: verticalScale(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    kpiLabel: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
    kpiVal: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#0f172a' },
    kpiSub: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#94a3b8', marginTop: 4 },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: moderateScale(16), marginBottom: verticalScale(14), elevation: 2 },
    cardTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginBottom: verticalScale(16), textAlign: 'center' },
    
    ringContainer: { alignItems: 'center', marginVertical: verticalScale(14) },
    ring: { width: 120, height: 120, borderRadius: 60, borderWidth: 12, justifyContent: 'center', alignItems: 'center' },
    ringValue: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '900', color: '#0f172a' },
    ringSub: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '700', marginTop: moderateScale(12) },
    
    subStat: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#475569' },

    barRow: { marginBottom: verticalScale(12) },
    barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    barLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#334155' },
    barValue: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', color: '#64748b' },
    barTrack: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 5 },
});
