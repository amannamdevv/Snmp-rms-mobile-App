import { FilterProvider } from './src/context/FilterContext';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import NetworkHandler from './src/components/NetworkHandler';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Auth screens — organized in their own folder
import SplashScreen from './src/screens/auth/SplashScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import OtpScreen from './src/screens/auth/OtpScreen';

// Main App screens
import OverviewScreen from './src/screens/Overview/OverviewScreen';
import HomeScreen from './src/screens/Home/HomeScreen';
import SiteStatusScreen from './src/screens/Home/SiteStatusScreen';
import SiteDetailsScreen from './src/screens/Home/SiteDetailsScreen';
import NonCommSitesScreen from './src/screens/Home/NonCommSitesScreen';
import SiteRunningStatusScreen from './src/screens/Home/SiteRunningStatusScreen';
import SiteRunHoursDetailScreen from './src/screens/Home/SiteRunHoursDetailScreen';
import BackupUsageScreen from './src/screens/Home/BackupUsageScreen';
import SiteDistributionScreen from './src/screens/Dashboard/SiteDistributionScreen';
import SiteTypeDetailsScreen from './src/screens/Dashboard/SiteTypeDetailsScreen';
import DashboardScreen from './src/screens/Dashboard/DashboardScreen';
import SiteHealthScreen from './src/screens/Dashboard/SiteHealthScreen';
import SiteVitalsScreen from './src/screens/Dashboard/SiteVitalsScreen';
import SiteAutomationScreen from './src/screens/Dashboard/SiteAutomationScreen';
import LiveAlarmsScreen from './src/screens/Home/LiveAlarmsScreen';
import UptimeDetailsScreen from './src/screens/Dashboard/UptimeDetailsScreen';
import UptimeReportScreen from './src/screens/Dashboard/UptimeReportScreen';
// Energy Management
import EnergyRunHoursScreen from './src/screens/Energy/EnergyRunHoursScreen';
import EnergyRunHoursDetailsScreen from './src/screens/Energy/EnergyRunHoursDetailsScreen';

// Uptime & SLA Analytics
import UptimeDashboardScreen from './src/screens/Uptime/UptimeDashboardScreen';
import UptimeSiteDetailsScreen from './src/screens/Uptime/UptimeSiteDetailsScreen';

// DCEM Analytics
import DCEMAnalyticsScreen from './src/screens/DCEM/DCEMAnalyticsScreen';
import DCEMMonthlyReportScreen from './src/screens/DCEM/DCEMMonthlyReportScreen';

// NOC Analytics
import NocAnalyticsScreen from './src/screens/Analytics/NocAnalyticsScreen';
import BatteryHealthAnalyticsScreen from './src/screens/Analytics/BatteryHealthAnalyticsScreen';

// Maintenance & Tools
import TTToolScreen from './src/screens/Maintenance/TTToolScreen';
import SiteMaintenanceToolScreen from './src/screens/Maintenance/SiteMaintenanceToolScreen';

// Asset Health
import Assethealthdashboard from './src/screens/AssetHealth/Assethealthdashboard';

// Specialized Reports
import CommReportScreen from './src/screens/CommReport/CommReportScreen';
import MasterReportScreen from './src/screens/MasterReport/MasterReportScreen';
import GridBillingScreen from './src/screens/GridBilling/GridBillingScreen';
import OptimizationReportsScreen from './src/screens/Optimization/OptimizationReportsScreen';
import SiteVariationScreen from './src/screens/SiteVariation/SiteVariationScreen';
import SolarAnalyticsScreen from './src/screens/Solar/SolarAnalyticsScreen';
import PMAnalyticsScreen from './src/screens/PMAnalytics/PMAnalyticsScreen';

// Resource Mapping
import ResourceMappingScreen from './src/screens/Mapping/ResourceMappingScreen';

// History Logs
import SiteLogsScreen from './src/screens/History/SiteLogsScreen';
import HistoricalAlarmsScreen from './src/screens/History/HistoricalAlarmsScreen';
import SupportRequiredScreen from './src/screens/Support/SupportRequiredScreen';
import RoboticCallStatusScreen from './src/screens/Robotic/RoboticCallStatusScreen';
import MqttWriteDataScreen from './src/screens/Mqtt/MqttWriteDataScreen';
import SnmpToolScreen from './src/screens/Snmp/SnmpToolScreen';
import UserManagementScreen from './src/screens/UserManagement/UserManagementScreen';




import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      const inAppUpdates = new SpInAppUpdates(false);
      inAppUpdates.checkNeedsUpdate().then((result) => {
        if (result.shouldUpdate) {
          inAppUpdates.startUpdate({
            updateType: IAUUpdateKind.FLEXIBLE,
          }).catch(console.log);
        }
      }).catch(console.log);
    }
  }, []);

  return (
    <NetworkHandler>
    <FilterProvider>
      <SafeAreaProvider>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          {/* ── Auth ───────────────────────────────── */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />

          {/* ── Home ───────────────────────────────── */}
          <Stack.Screen name="Overview" component={OverviewScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="SiteStatus" component={SiteStatusScreen} />
          <Stack.Screen name="SiteDetails" component={SiteDetailsScreen} />
          <Stack.Screen name="NonCommSites" component={NonCommSitesScreen} />
          <Stack.Screen name="SiteRunningStatus" component={SiteRunningStatusScreen} />
          <Stack.Screen name="SiteRunHoursDetail" component={SiteRunHoursDetailScreen} />
          <Stack.Screen name="BackupUsage" component={BackupUsageScreen} />
          <Stack.Screen name="SiteDistribution" component={SiteDistributionScreen} />
          <Stack.Screen name="SiteTypeDetails" component={SiteTypeDetailsScreen} />

          {/* ── Dashboard ──────────────────────────── */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="SiteHealth" component={SiteHealthScreen} />
          <Stack.Screen name="SiteVitals" component={SiteVitalsScreen} />
          <Stack.Screen name="SiteAutomation" component={SiteAutomationScreen} />
          <Stack.Screen name="LiveAlarms" component={LiveAlarmsScreen} />
          <Stack.Screen name="EnergyRunHours" component={EnergyRunHoursScreen} />
          <Stack.Screen name="EnergyRunHoursDetails" component={EnergyRunHoursDetailsScreen} />
          <Stack.Screen name="UptimeDetails" component={UptimeDetailsScreen} />
          <Stack.Screen name="UptimeReport" component={UptimeReportScreen} />

          {/* ── Reports & Analytics ────────────────── */}
          <Stack.Screen name="CommReport" component={CommReportScreen} />
          <Stack.Screen name="UptimeDashboard" component={UptimeDashboardScreen} />
          <Stack.Screen name="UptimeSiteDetails" component={UptimeSiteDetailsScreen} />
          <Stack.Screen name="DCEMAnalytics" component={DCEMAnalyticsScreen} />
          <Stack.Screen name="DCEMMonthlyReport" component={DCEMMonthlyReportScreen} />
          <Stack.Screen name="NocAnalytics" component={NocAnalyticsScreen} />
          <Stack.Screen name="BatteryHealthAnalytics" component={BatteryHealthAnalyticsScreen} />
          <Stack.Screen name="TTTool" component={TTToolScreen} />
          <Stack.Screen name="SiteMaintenanceTool" component={SiteMaintenanceToolScreen} />
          <Stack.Screen name="AssetHealth" component={Assethealthdashboard} />
          <Stack.Screen name="MasterReport" component={MasterReportScreen} />
          <Stack.Screen name="GridBilling" component={GridBillingScreen} />
          <Stack.Screen name="OptimizationReports" component={OptimizationReportsScreen} />
          <Stack.Screen name="ResourceMapping" component={ResourceMappingScreen} />
          <Stack.Screen name="SiteVariation" component={SiteVariationScreen} />
          <Stack.Screen name="SolarAnalytics" component={SolarAnalyticsScreen} />
          <Stack.Screen name="PMAnalytics" component={PMAnalyticsScreen} />
          <Stack.Screen name="SiteLogs" component={SiteLogsScreen} />
          <Stack.Screen name="HistoricalAlarms" component={HistoricalAlarmsScreen} />
          <Stack.Screen name="SupportRequired" component={SupportRequiredScreen} />
          <Stack.Screen name="RoboticCallStatus" component={RoboticCallStatusScreen} />
          <Stack.Screen name="MqttWriteData" component={MqttWriteDataScreen} />
          <Stack.Screen name="SnmpTool" component={SnmpToolScreen} />
          <Stack.Screen name="UserManagement" component={UserManagementScreen} />

        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </FilterProvider>
    </NetworkHandler>
  );
}
