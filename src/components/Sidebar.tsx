import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, TouchableWithoutFeedback, Modal, SafeAreaView, Easing
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { scale, verticalScale, moderateScale, responsiveFontSize, SCREEN_WIDTH as width } from '../utils/responsive';

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  navigation: any;
  fullname: string;
  handleLogout: () => void;
  activeRoute?: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning' };
  if (hour < 17) return { text: 'Good Afternoon' };
  if (hour < 21) return { text: 'Good Evening' };
  return { text: 'Good Night' };
};

const getAvatarColor = (name: string) => {
  const colors = [
    '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899',
    '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Sidebar({ isVisible, onClose, navigation, fullname, handleLogout, activeRoute }: SidebarProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const slideAnim = React.useRef(new Animated.Value(-width * 0.75)).current;

  // Sub-routes tracking for auto-open dropdowns
  const isSitesSubActive = ['SiteVitals', 'NonCommSites'].includes(activeRoute || '');
  const isAlarmsSubActive = ['LiveAlarms'].includes(activeRoute || '');
  const isUptimeSubActive = ['UptimeDashboard', 'UptimeSiteDetails'].includes(activeRoute || '');
  const isAssetSubActive = ['AssetHealth'].includes(activeRoute || '');
  const isEnergySubActive = ['EnergyRunHours', 'EnergyRunHoursDetails'].includes(activeRoute || '');
  const isHistorySubActive = ['SiteLogs', 'HistoricalAlarms'].includes(activeRoute || '');
  const isMaintenanceSubActive = ['TTTool', 'SiteMaintenanceTool'].includes(activeRoute || '');
  const isOptimizationSubActive = ['OptimizationReports'].includes(activeRoute || '');
  const isMqttSubActive = ['MqttWriteData', 'SnmpTool'].includes(activeRoute || '');

  useEffect(() => {
    if (isSitesSubActive) {
      setExpandedMenu('Live Sites Status');
    } else if (isAlarmsSubActive) {
      setExpandedMenu('Alarms Management');
    } else if (isUptimeSubActive) {
      setExpandedMenu('Uptime & SLA Analytics');
    } else if (isAssetSubActive) {
      setExpandedMenu('Asset Health');
    } else if (isEnergySubActive) {
      setExpandedMenu('Energy Management');
    } else if (isHistorySubActive) {
      setExpandedMenu('History Logs');
    } else if (isMaintenanceSubActive) {
      setExpandedMenu('Site Maintenance Tool');
    } else if (isOptimizationSubActive) {
      setExpandedMenu('Optimization Reports');
    }
  }, [activeRoute]);

  useEffect(() => {
    if (isVisible) {
      // Only slide open — do NOT auto-expand any menu
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad)
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width * 0.75,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad)
      }).start();
    }
  }, [isVisible]);

  const toggleAccordion = (menuName: string) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };

  const navigateTo = (route: string, params?: any) => {
    onClose();
    // Snappy delay for transition
    setTimeout(() => navigation.navigate(route, params), 150);
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.background} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>

            {/* Profile Section */}
            <View style={styles.profileSection}>
              <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(fullname || 'A') }]}>
                <Text style={styles.avatarText}>{fullname ? fullname.charAt(0).toUpperCase() : 'A'}</Text>
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={styles.profileGreeting}>{getGreeting().text}</Text>
                <Text style={styles.profileName} numberOfLines={1}>{fullname || 'Guest'}</Text>

              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon name="chevron-left" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

              {/* 1. HOME */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'Home' && styles.itemActive]}
                onPress={() => navigateTo('Home')}
              >
                <Icon name="home" size={20} color={activeRoute === 'Home' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'Home' && { color: '#61A5C2' }]}>Home</Text>
              </TouchableOpacity>

              {/* 2. DASHBOARD */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'Dashboard' && styles.itemActive]}
                onPress={() => navigateTo('Dashboard')}
              >
                <Icon name="grid" size={20} color={activeRoute === 'Dashboard' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'Dashboard' && { color: '#61A5C2' }]}>Dashboard</Text>
              </TouchableOpacity>

              {/* 3. LIVE SITES STATUS DROP-DOWN */}
              <TouchableOpacity style={styles.accordion} onPress={() => toggleAccordion('Live Sites Status')} activeOpacity={0.7}>
                <View style={styles.row}>
                  <Icon name="activity" size={20} color={(isSitesSubActive || expandedMenu === 'Live Sites Status') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isSitesSubActive || expandedMenu === 'Live Sites Status') && { color: '#61A5C2' }]}>Live Sites Status</Text>
                </View>
                <Icon name={expandedMenu === 'Live Sites Status' ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </TouchableOpacity>

              {expandedMenu === 'Live Sites Status' && (
                <View style={styles.subMenu}>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('SiteVitals', { range: 'critical', source: 'sidebar' })}>
                    <Text style={styles.subText}>• Critical Sites</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('SiteVitals', { range: 'low', source: 'sidebar' })}>
                    <Text style={styles.subText}>• Sites at Risk</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('SiteVitals', { range: 'normal', source: 'sidebar' })}>
                    <Text style={styles.subText}>• Operational Sites</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('SiteVitals', { range: 'noncomm', source: 'sidebar' })}>
                    <Text style={styles.subText}>• Non-Communicating</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 4. ALARMS MANAGEMENT DROP-DOWN */}
              <TouchableOpacity style={styles.accordion} onPress={() => toggleAccordion('Alarms Management')} activeOpacity={0.7}>
                <View style={styles.row}>
                  <Icon name="bell" size={20} color={(isAlarmsSubActive || expandedMenu === 'Alarms Management') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isAlarmsSubActive || expandedMenu === 'Alarms Management') && { color: '#61A5C2' }]}>Alarms Management</Text>
                </View>
                <Icon name={expandedMenu === 'Alarms Management' ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </TouchableOpacity>

              {expandedMenu === 'Alarms Management' && (
                <View style={styles.subMenu}>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('LiveAlarms', { severity: 'Fire' })}>
                    <Text style={styles.subText}>• Fire & Smoke</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('LiveAlarms', { severity: 'Major' })}>
                    <Text style={styles.subText}>• Major Alarms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('LiveAlarms', { severity: 'Minor' })}>
                    <Text style={styles.subText}>• Minor Alarms</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 5. AMF SMPS LAST COM */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'CommReport' && styles.itemActive]}
                onPress={() => navigateTo('CommReport')}
                activeOpacity={0.7}
              >
                <Icon name="file-text" size={20} color={activeRoute === 'CommReport' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'CommReport' && { color: '#61A5C2' }]}>Amf Smps Last Com</Text>
              </TouchableOpacity>

              {/* 6. ENERGY MANAGEMENT */}
              <TouchableOpacity
                style={[styles.item, isEnergySubActive && styles.itemActive]}
                onPress={() => navigateTo('EnergyRunHours')}
              >
                <Icon name="zap" size={20} color={isEnergySubActive ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, isEnergySubActive && { color: '#61A5C2' }]}>Energy Management</Text>
              </TouchableOpacity>

              {/* 7. MASTER REPORT */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'MasterReport' && styles.itemActive]}
                onPress={() => navigateTo('MasterReport')}
                activeOpacity={0.7}
              >
                <Icon name="database" size={20} color={activeRoute === 'MasterReport' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'MasterReport' && { color: '#61A5C2' }]}>Master Report</Text>
              </TouchableOpacity>

              {/* 8. SITE VARIATION ANALYSIS */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'SiteVariation' && styles.itemActive]}
                onPress={() => navigateTo('SiteVariation')}
                activeOpacity={0.7}
              >
                <Icon name="activity" size={20} color={activeRoute === 'SiteVariation' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'SiteVariation' && { color: '#61A5C2' }]}>Site Variation Analysis</Text>
              </TouchableOpacity>

              {/* 9. DCEM ANALYTICS */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'DCEMAnalytics' && styles.itemActive]}
                onPress={() => navigateTo('DCEMAnalytics')}
              >
                <Icon name="bar-chart-2" size={20} color={activeRoute === 'DCEMAnalytics' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'DCEMAnalytics' && { color: '#61A5C2' }]}>DCEM Analytics</Text>
              </TouchableOpacity>

              {/* 10. UPTIME & SLA ANALYTICS DROP-DOWN */}
              <TouchableOpacity style={styles.accordion} onPress={() => toggleAccordion('Uptime & SLA Analytics')} activeOpacity={0.7}>
                <View style={styles.row}>
                  <Icon name="trending-up" size={20} color={(isUptimeSubActive || expandedMenu === 'Uptime & SLA Analytics') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isUptimeSubActive || expandedMenu === 'Uptime & SLA Analytics') && { color: '#61A5C2' }]}>Uptime & SLA Analytics</Text>
                </View>
                <Icon name={expandedMenu === 'Uptime & SLA Analytics' ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </TouchableOpacity>

              {expandedMenu === 'Uptime & SLA Analytics' && (
                <View style={styles.subMenu}>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'circle' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Circle-wise Uptime</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'opco' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• OPCO-wise Analysis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'attribute' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Attribute Analysis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'repeat' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Repeat Outages</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'seasonal' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Seasonal Preparedness</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'monthly' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Monthly History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => navigateTo('UptimeDashboard', { tab: 'quarterly' })}>
                    <Text style={[styles.subText, activeRoute === 'UptimeDashboard' && styles.activeSubText]}>• Quarterly History</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 11. NOC ANALYTICS */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'NocAnalytics' && styles.itemActive]}
                onPress={() => navigateTo('NocAnalytics')}
              >
                <Icon name="pie-chart" size={20} color={activeRoute === 'NocAnalytics' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'NocAnalytics' && { color: '#61A5C2' }]}>NOC Analytics</Text>
              </TouchableOpacity>

              {/* 12. ASSET HEALTH MANAGEMENT DROP-DOWN */}
              <TouchableOpacity
                style={[styles.accordion, (isAssetSubActive || expandedMenu === 'Asset Health') && styles.itemActive]}
                onPress={() => toggleAccordion('Asset Health')}
                activeOpacity={0.7}
              >
                <View style={styles.row}>
                  <Icon name="activity" size={20} color={(isAssetSubActive || expandedMenu === 'Asset Health') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isAssetSubActive || expandedMenu === 'Asset Health') && { color: '#61A5C2' }]}>Asset Health Management</Text>
                </View>
                <Icon name={expandedMenu === 'Asset Health' ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </TouchableOpacity>

              {expandedMenu === 'Asset Health' && (
                <View style={styles.subMenu}>
                  {[
                    { name: 'Battery', tab: 'battery' },
                    { name: 'DG', tab: 'dg' },
                    { name: 'Rectifier', tab: 'rectifier' },
                    { name: 'Solar', tab: 'solar' },
                    { name: 'DG Battery', tab: 'dg_battery' },
                    { name: 'LA (Lightning)', tab: 'lightning' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.tab}
                      style={styles.subItem}
                      onPress={() => navigateTo('AssetHealth', { tab: item.tab })}
                    >
                      <Text style={[styles.subText, activeRoute === 'AssetHealth' && styles.activeSubText]}>• {item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 13. ROBOTIC CALL STATUS */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'RoboticCallStatus' && styles.itemActive]}
                onPress={() => navigateTo('RoboticCallStatus')}
                activeOpacity={0.7}
              >
                <Icon name="phone-call" size={20} color={activeRoute === 'RoboticCallStatus' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'RoboticCallStatus' && { color: '#61A5C2' }]}>Robotic Call Status</Text>
              </TouchableOpacity>

              {/* 15. SITE MAINTENANCE TOOL dropdown */}
              <TouchableOpacity
                style={styles.accordion}
                onPress={() => toggleAccordion('Site Maintenance Tool')}
                activeOpacity={0.7}
              >
                <View style={styles.row}>
                  <Icon name="settings" size={20} color={(isMaintenanceSubActive || expandedMenu === 'Site Maintenance Tool') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isMaintenanceSubActive || expandedMenu === 'Site Maintenance Tool') && { color: '#61A5C2' }]}>Site Maintenance Tool</Text>
                </View>
                <Icon
                  name={expandedMenu === 'Site Maintenance Tool' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#94a3b8"
                />
              </TouchableOpacity>

              {expandedMenu === 'Site Maintenance Tool' && (
                <View style={[styles.subMenu, { backgroundColor: '#0a1629' }]}>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('TTTool', { initialTab: 'equipment' }); }}>
                    <Text style={styles.subText}>• Equipment History Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('SiteMaintenanceTool', { initialTab: 'infra' }); }}>
                    <Text style={styles.subText}>• Infrastructure Upgrade</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('SiteMaintenanceTool', { initialTab: 'smps' }); }}>
                    <Text style={styles.subText}>• SMPS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('SiteMaintenanceTool', { initialTab: 'dcem' }); }}>
                    <Text style={styles.subText}>• DCEM Calibration</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('TTTool', { initialTab: 'repairs' }); }}>
                    <Text style={styles.subText}>• Major Repairs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.subItem} onPress={() => { onClose(); navigation.navigate('TTTool', { initialTab: 'tickets' }); }}>
                    <Text style={styles.subText}>• Raise Ticket & Closure</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 16. GRID POWER ANALYTICS */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'GridBilling' && styles.itemActive]}
                onPress={() => navigateTo('GridBilling')}
              >
                <Icon name="zap" size={20} color={activeRoute === 'GridBilling' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'GridBilling' && { color: '#61A5C2' }]}>Grid Power Analytics</Text>
              </TouchableOpacity>

              {/* 17. OPTIMIZATION REPORTS DROP-DOWN */}
              <TouchableOpacity
                style={styles.accordion}
                onPress={() => toggleAccordion('Optimization Reports')}
                activeOpacity={0.7}
              >
                <View style={styles.row}>
                  <Icon name="pie-chart" size={20} color={(isOptimizationSubActive || expandedMenu === 'Optimization Reports') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isOptimizationSubActive || expandedMenu === 'Optimization Reports') && { color: '#61A5C2' }]}>Optimization Reports</Text>
                </View>
                <Icon
                  name={expandedMenu === 'Optimization Reports' ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#94a3b8"
                />
              </TouchableOpacity>

              {expandedMenu === 'Optimization Reports' && (
                <View style={styles.subMenu}>
                  {[
                    { name: 'Energy KPIs', tab: 'energy' },
                    { name: 'High Loss Sites', tab: 'losses' },
                    { name: 'Low Voltage Sites', tab: 'voltage' },
                    { name: 'Revenue Leakage', tab: 'leakage' },
                    { name: 'SO vs Actual', tab: 'power' },
                    { name: 'Power Factor', tab: 'powerfactor' },
                    { name: 'Load Optimization', tab: 'sanctioned' },
                    { name: 'Event Monitoring', tab: 'events' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.tab}
                      style={styles.subItem}
                      onPress={() => { onClose(); navigation.navigate('OptimizationReports', { initialTab: item.tab }); }}
                    >
                      <Text style={[styles.subText, activeRoute === 'OptimizationReports' && styles.activeSubText]}>• {item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 18. TT TOOL */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'TTTool' && !isMaintenanceSubActive && styles.itemActive]}
                onPress={() => { onClose(); navigation.navigate('TTTool', { initialTab: 'raise' }); }}
              >
                <Icon name="tool" size={20} color={activeRoute === 'TTTool' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'TTTool' && { color: '#61A5C2' }]}>TT Tool</Text>
              </TouchableOpacity>

              {/* 19. SUPPORT REQUIRED */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'SupportRequired' && styles.itemActive]}
                onPress={() => navigateTo('SupportRequired')}
                activeOpacity={0.7}
              >
                <Icon name="life-buoy" size={20} color={activeRoute === 'SupportRequired' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'SupportRequired' && { color: '#61A5C2' }]}>Support Required</Text>
              </TouchableOpacity>

              {/* 20. MAPPING OF RESOURCES */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'ResourceMapping' && styles.itemActive]}
                onPress={() => navigateTo('ResourceMapping')}
                activeOpacity={0.7}
              >
                <Icon name="map" size={20} color={activeRoute === 'ResourceMapping' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'ResourceMapping' && { color: '#61A5C2' }]}>Mapping of Resources</Text>
              </TouchableOpacity>

              {/* 21. MQTT WRITE DATA */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'MqttWriteData' && styles.itemActive]}
                onPress={() => navigateTo('MqttWriteData')}
                activeOpacity={0.7}
              >
                <Icon name="terminal" size={20} color={activeRoute === 'MqttWriteData' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'MqttWriteData' && { color: '#61A5C2' }]}>MQTT Write Data</Text>
              </TouchableOpacity>

              {/* 21b. SNMP TOOL */}
              <TouchableOpacity
                style={[styles.item, activeRoute === 'SnmpTool' && styles.itemActive]}
                onPress={() => navigateTo('SnmpTool')}
                activeOpacity={0.7}
              >
                <Icon name="cpu" size={20} color={activeRoute === 'SnmpTool' ? "#61A5C2" : "#fff"} style={styles.icon} />
                <Text style={[styles.text, activeRoute === 'SnmpTool' && { color: '#61A5C2' }]}>SNMP Tool</Text>
              </TouchableOpacity>

              {/* 22. HISTORY LOGS DROP-DOWN */}
              <TouchableOpacity style={styles.accordion} onPress={() => toggleAccordion('History Logs')} activeOpacity={0.7}>
                <View style={styles.row}>
                  <Icon name="clock" size={20} color={(isHistorySubActive || expandedMenu === 'History Logs') ? "#61A5C2" : "#fff"} style={styles.icon} />
                  <Text style={[styles.text, (isHistorySubActive || expandedMenu === 'History Logs') && { color: '#61A5C2' }]}>History Logs</Text>
                </View>
                <Icon name={expandedMenu === 'History Logs' ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </TouchableOpacity>

              {expandedMenu === 'History Logs' && (
                <View style={styles.subMenu}>
                  {[
                    { name: 'Site Logs', route: 'SiteLogs' },
                    { name: 'Historical Alarms', route: 'HistoricalAlarms' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.route}
                      style={styles.subItem}
                      onPress={() => navigateTo(item.route)}
                    >
                      <Text style={[styles.subText, activeRoute === item.route && styles.activeSubText]}>• {item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            </ScrollView>

            {/* Logout Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                <Icon name="log-out" size={18} color="#fff" style={styles.icon} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  background: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.75,
    backgroundColor: '#0f203c',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    zIndex: 9999
  },
  profileSection: {
    padding: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3c72',
    backgroundColor: '#0a1629' // Deepened background
  },
  avatarCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  avatarText: { color: '#fff', fontSize: responsiveFontSize(22), fontWeight: '900' },
  profileGreeting: { color: '#89C2D9', fontSize: responsiveFontSize(13), fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileName: { color: '#fff', fontSize: responsiveFontSize(20), fontWeight: '900', letterSpacing: 0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 6, borderWidth: 1.5, borderColor: 'rgba(16, 185, 129, 0.3)' },
  statusText: { color: '#10b981', fontSize: responsiveFontSize(11), fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  scroll: { flex: 1, paddingVertical: verticalScale(10) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(15),
    paddingHorizontal: moderateScale(20)
  },
  itemActive: { backgroundColor: '#1e3c72', borderLeftWidth: 4, borderLeftColor: '#61A5C2' },
  accordion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(15),
    paddingHorizontal: moderateScale(20)
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: moderateScale(15) },
  text: { color: '#fff', fontSize: responsiveFontSize(15), fontWeight: '500' },
  subMenu: { backgroundColor: '#0a1629', paddingBottom: verticalScale(10) },
  subItem: { padding: moderateScale(10), paddingLeft: moderateScale(55) },
  subText: { color: '#89C2D9', fontSize: responsiveFontSize(13) },
  activeSubText: { color: '#fff', fontWeight: 'bold' },
  footer: {
    padding: moderateScale(20),
    borderTopWidth: 1,
    borderTopColor: '#1e3c72',
    paddingBottom: verticalScale(30)
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    padding: moderateScale(12),
    borderRadius: moderateScale(8),
    justifyContent: 'center'
  },
  logoutText: { color: '#fca5a5', fontSize: responsiveFontSize(16), fontWeight: 'bold' }
});
