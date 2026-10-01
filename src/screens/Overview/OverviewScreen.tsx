import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import AppIcon from '../../components/AppIcon';
import AppHeader from '../../components/AppHeader';
import { responsiveFontSize, moderateScale } from '../../utils/responsive';

let width = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') width = _d.width; } catch(_) {}
// ... [rest of file as it is]
// Number of columns for the grid
const numColumns = 2;
const cardWidth = (width - 48) / numColumns; // 48 is padding (16*2 sides + 16 gap)

const MENU_ITEMS = [
  { name: 'Home', icon: 'home', route: 'Home' },
  { name: 'Dashboard', icon: 'grid', route: 'Dashboard' },
  { name: 'Live Sites Status', icon: 'activity', route: 'NonCommSites' },
  { name: 'Alarms Management', icon: 'bell', route: 'LiveAlarms' },
  { name: 'Amf Smps Last Com', icon: 'cast', route: 'CommReport' },
  { name: 'Energy Management', icon: 'zap', route: 'EnergyRunHours' },
  { name: 'Site Variation Analysis', icon: 'bar-chart-2', route: 'SiteVariation' },
  { name: 'DCEM Analytics', icon: 'zap', route: 'DCEMAnalytics' },
  { name: 'Uptime & SLA Analytics', icon: 'bar-chart', route: 'UptimeDashboard' },
  { name: 'NOC Analytics', icon: 'activity', route: 'NocAnalytics' },
  { name: 'Asset Health Management', icon: 'clipboard', route: 'AssetHealth' },
  { name: 'RobotiC Call Status', icon: 'list', route: 'RoboticCallStatus' },
  { name: 'PM Analytics', icon: 'file-text', route: 'PMAnalytics' },
  { name: 'Site Maintenance Tool', icon: 'tool', route: 'SiteMaintenanceTool' },
  { name: 'Grid Power Analytics', icon: 'battery', route: 'GridBilling' },
  // { name: 'Optimization Reports', icon: 'file', route: 'OptimizationReports' },
  { name: 'TT Tools', icon: 'tool', route: 'TTTool' },
  { name: 'Support Required', icon: 'headphones', route: 'SupportRequired' },
  { name: 'Mapping Of Resources', icon: 'map-pin', route: 'ResourceMapping' },
  { name: 'User Management', icon: 'users', route: 'UserManagement' },
  { name: 'History Logs', icon: 'clock', route: 'SiteLogs' },
  { name: 'Quality Analytics', icon: 'check-circle', route: 'Overview', locked: true },
  { name: 'Permit To Work Analytics', icon: 'user-check', route: 'Overview', locked: true },
];

export default function OverviewScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <AppHeader title="Overview" navigation={navigation} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>DOORDRISHTI OVERVIEW</Text>
        
        <View style={styles.grid}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={() => {
                if (!item.locked) {
                  navigation.navigate(item.route);
                }
              }}
              activeOpacity={item.locked ? 1 : 0.7}
            >
              {item.locked && (
                <Text style={styles.lockedText}>User Data Required</Text>
              )}
              <View style={styles.iconContainer}>
                <AppIcon name={item.icon} size={28} color="#2563eb" />
              </View>
              <Text style={styles.cardText} numberOfLines={2}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  title: {
    fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700',
    color: '#3b82f6',
    marginBottom: moderateScale(20),
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  card: {
    backgroundColor: '#fff',
    width: cardWidth,
    borderRadius: 12,
    padding: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    minHeight: 120,
  },
  iconContainer: {
    marginBottom: moderateScale(12),
  },
  cardText: {
    fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b',
    textAlign: 'center',
    fontWeight: '500',
  },
  lockedText: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: responsiveFontSize(8), flexShrink: 1, color: '#2563eb',
    fontWeight: '700',
  },
});
