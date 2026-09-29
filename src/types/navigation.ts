export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Otp: { whatsappUrl: string, username: string };
  Home: { fullname: string };
  SiteStatus: undefined;
  SiteDetails: { imei: string, siteId: string };
  NonCommSites: undefined;
  SiteRunningStatus: undefined;
  SiteRunHoursDetail: { imei: string; siteName: string };
  BackupUsage: undefined;
  SiteDistribution: undefined;
  SiteTypeDetails: { siteType: string, title: string, filters: any };
  Dashboard: { fullname?: string } | undefined;
  SiteHealth: { status?: string } | undefined;
  SiteVitals: { range?: string, source?: string } | undefined;
  SiteAutomation: undefined;
  LiveAlarms: { severity?: string } | undefined;
  UptimeDetails: { state_id: string, state_name: string };
  UptimeReport: undefined;
  CommReport: undefined;
  UptimeDashboard: undefined;
  UptimeSiteDetails: { circle_id: string };
  MasterReport: undefined;
  GridBilling: undefined;
  ResourceMapping: undefined;
  SiteVariation: undefined;
  NocAnalytics: undefined;
  AssetHealth: { tab?: string } | undefined;
  DCEMAnalytics: undefined;
  DCEMMonthlyReport: undefined;
  EnergyRunHours: { preset?: string } | undefined;
  EnergyRunHoursDetails: { category: string, date_from: string, date_to: string };
  SiteLogs: undefined;
  HistoricalAlarms: undefined;
  BatteryHealthAnalytics: undefined;

  TTTool: { initialTab?: 'equipment' | 'repairs' | 'tickets' | 'raise' };
  SiteMaintenanceTool: { initialTab?: 'infra' | 'smps' | 'dcem' };

  OptimizationReports: { initialTab?: string };
  SupportRequired: undefined;
  RoboticCallStatus: undefined;
  MqttWriteData: undefined;
  SnmpTool: undefined;
};

