import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// â”€â”€â”€ Constants & Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DJANGO_BASE_URL = 'https://snmp-rms.shrotitele.com';
const DJANGO_AUTH_URL = `${DJANGO_BASE_URL}/api/auth`;

const KEYS = {
  DJANGO_SESSION: 'djangoSession',
  DJANGO_SESSION_PENDING: 'djangoSessionPending',
};

// â”€â”€â”€ Helper: extract sessionid from Set-Cookie response header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const extractSessionId = (headers) => {
  const raw = headers['set-cookie'] ?? headers['Set-Cookie'];
  if (!raw) return null;
  const cookies = Array.isArray(raw) ? raw : [raw];
  for (const cookie of cookies) {
    const match = cookie.match(/sessionid=([^;]+)/);
    if (match) return match[1];
  }
  return null;
};

// Safely convert any response shape into an array
const toArray = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  if (Array.isArray(data?.data)) return data.data;
  console.log(
    '[toArray] Unexpected response shape:',
    typeof data === 'string' ? data.slice(0, 150) : JSON.stringify(data)?.slice(0, 200)
  );
  return [];
};

// â”€â”€â”€ Django Axios Instance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const attachDjangoAuth = async (config) => {
  try {
    const session = await AsyncStorage.getItem(KEYS.DJANGO_SESSION);
    if (session) {
      // Axios handles Cookie header on both iOS/Android
      config.headers['Cookie'] = `sessionid=${session}`;
      // Some server configurations might also look for this header
      config.headers['X-Requested-With'] = 'XMLHttpRequest';

      // Clean up UI-only query params so Django doesn't throw 500 errors on certain endpoints
      if (config.params) {
        const p = { ...config.params };

        // Some endpoints crash (500) if they receive state_name or customer_name
        // Others (like /api/alarms/) require them. Delete conditionally.
        const urlStr = config.url || '';
        if (urlStr.includes('site-health') || urlStr.includes('grid-analytics')) {
          delete p.state_name;
          delete p.district_name;
          delete p.cluster_name;
          delete p.customer_name;
          delete p.search_type;
        }

        // Ensure ctmids, client_id, and client are populated if customer_id exists
        if (p.customer_id) {
          p.ctmids = p.ctmids || p.customer_id;
          p.client_id = p.client_id || p.customer_id;
          p.client = p.client || p.customer_id;
        }

        // Alias state_id, district_id, cluster_id just in case some APIs expect state, district, cluster
        if (p.state_id) p.state = p.state || p.state_id;
        if (p.district_id) p.district = p.district || p.district_id;
        if (p.cluster_id) p.cluster = p.cluster || p.cluster_id;

        config.params = p;
      }

      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} - sessionid attached`);
    } else {
      console.log('[API Request] WARNING: No djangoSession found in AsyncStorage!');
    }
  } catch (error) {
    console.error('[API Interceptor Error]', error);
  }
  return config;
};

const djangoApi = axios.create({
  baseURL: DJANGO_BASE_URL,
  timeout: 60000, // 60 seconds
  withCredentials: true
});
djangoApi.interceptors.request.use(attachDjangoAuth, (error) => Promise.reject(error));

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ AUTHENTICATION (Login, OTP, Logout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const loginApi = async (username, password) => {
  const djangoRes = await axios.post(`${DJANGO_AUTH_URL}/login/`, { username, password }, { timeout: 15000 });
  const sessionId = extractSessionId(djangoRes.headers);
  console.log('[loginApi] sessionId from Set-Cookie:', sessionId ? sessionId.slice(0, 8) + '...' : 'NONE');
  if (sessionId) {
    await AsyncStorage.setItem(KEYS.DJANGO_SESSION_PENDING, sessionId);
  }
  if (djangoRes.data.status === 'success' && djangoRes.data.skip_otp) {
    // No OTP required â€” promote session immediately
    if (sessionId) {
      await AsyncStorage.setItem(KEYS.DJANGO_SESSION, sessionId);
      await AsyncStorage.removeItem(KEYS.DJANGO_SESSION_PENDING);
      console.log('[loginApi] skip_otp=true, session saved directly');
    }
  }
  return djangoRes.data;
};

export const verifyOtpApi = async (otp, username) => {
  const pendingSession = await AsyncStorage.getItem(KEYS.DJANGO_SESSION_PENDING);
  const headers = {};
  if (pendingSession) {
    headers['Cookie'] = `sessionid=${pendingSession}`;
  }
  const djangoRes = await axios.post(`${DJANGO_AUTH_URL}/verify-otp/`, { otp }, { headers });
  const newSession = extractSessionId(djangoRes.headers);

  console.log('[verifyOtpApi] response status:', djangoRes.data.status);
  console.log('[verifyOtpApi] newSession from Set-Cookie:', newSession ? newSession.slice(0, 8) + '...' : 'NONE');
  console.log('[verifyOtpApi] pendingSession:', pendingSession ? pendingSession.slice(0, 8) + '...' : 'NONE');

  if (newSession) {
    // Server issued a new session after OTP verification â€” use it
    await AsyncStorage.setItem(KEYS.DJANGO_SESSION, newSession);
    console.log('[verifyOtpApi] Saved NEW session to djangoSession');
  } else if (pendingSession && djangoRes.data.status === 'success') {
    // Server reused the same session â€” promote pending session to main session
    await AsyncStorage.setItem(KEYS.DJANGO_SESSION, pendingSession);
    console.log('[verifyOtpApi] No new session issued, promoted pendingSession to djangoSession');
  }
  await AsyncStorage.removeItem(KEYS.DJANGO_SESSION_PENDING);
  return djangoRes.data;
};

export const logoutApi = async () => {
  await AsyncStorage.multiRemove([KEYS.DJANGO_SESSION, KEYS.DJANGO_SESSION_PENDING, 'user_role', 'user_ptye', 'user_ctmid']);
};


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ MAIN API OBJECT (Grouped for Clarity) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const api = {
  getMe: async () => {
    const response = await djangoApi.get('/api/auth/me/');
    return response.data;
  },

  // â”€â”€ HOME Related â”€â”€
  getSiteStatus: async (filters, page, pageSize) => {
    const response = await djangoApi.get('/api/status/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getSiteRunningStatus: async (filters, page = 1, pageSize = 1000) => {
    const response = await djangoApi.get('/api/get-running-status-from-energy-logs/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getDatewiseRunningDuration: async (imei, startDate, endDate) => {
    const response = await djangoApi.get('/api/get-datewise-running-duration/', { params: { imei, start_date: startDate, end_date: endDate } });
    return response.data;
  },
  getSitesWentOnBackupCount: async (date) => {
    const response = await djangoApi.get('/api/sites-went-on-backup-count/', { params: { date } });
    return response.data;
  },
  getSiteDistributionCounts: async (filters) => {
    const response = await djangoApi.get('/api/site-type-distribution/', { params: filters });
    return response.data;
  },
  getDgPresence: async (filters) => {
    const response = await djangoApi.get('/api/dg-presence/', { params: filters });
    return response.data;
  },
  getEbPresence: async (filters) => {
    const response = await djangoApi.get('/api/eb-presence/', { params: filters });
    return response.data;
  },

  // â”€â”€ SOLAR ANALYTICS â”€â”€
  getSolarAnalyticsMonthly: async (filters) => {
    const response = await djangoApi.get('/api/solar-report/monthly/', { params: filters });
    return response.data;
  },
  getSolarAnalyticsDaily: async (filters) => {
    const response = await djangoApi.get('/api/solar-report/daily/', { params: filters });
    return response.data;
  },
  getNonCommAging: async (filters) => {
    const response = await djangoApi.get('/api/site-communication-statuss/', { params: filters });
    const sites = response.data.sites || [];
    const buckets = {
      '0-7 days': 0,
      '8-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '90+ days': 0,
    };
    sites.forEach(site => {
      const days = site.days_since_comm ?? 0;
      if (days <= 7) buckets['0-7 days']++;
      else if (days <= 30) buckets['8-30 days']++;
      else if (days <= 60) buckets['31-60 days']++;
      else if (days <= 90) buckets['61-90 days']++;
      else buckets['90+ days']++;
    });
    return {
      status: 'success',
      data: {
        total_non_comm: sites.length,
        aging_buckets: buckets,
        bucket_labels: Object.keys(buckets),
        bucket_values: Object.values(buckets)
      }
    };
  },
  getNonCommSitesList: async (filters, page = 1, pageSize = 10) => {
    const response = await djangoApi.get('/api/site-communication-statuss/', { params: filters });
    const allSites = response.data.sites || [];
    const startIdx = (page - 1) * pageSize;
    const paginatedSites = allSites.slice(startIdx, startIdx + pageSize);
    return {
      sites: paginatedSites,
      total_sites: allSites.length,
      has_next: startIdx + pageSize < allSites.length,
      meta: {
        current_page: page,
        total_records: allSites.length
      }
    };
  },
  getSiteDetails: async (id) => {
    const response = await djangoApi.get(`/api/site/${id}/`);
    return response.data;
  },
  getSitesByType: async (siteType, filters, page = 1, pageSize = 1000) => {
    const response = await djangoApi.get(`/api/sites-by-type/${siteType}/`, { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },

  // â”€â”€ DASHBOARD Related â”€â”€
  getSiteHealthCounts: async (filters) => {
    const response = await djangoApi.get('/api/site-health-status/', { params: filters });
    return response.data;
  },
  getSiteHealth: async (filters, page = 1, pageSize = 20) => {
    const response = await djangoApi.get('/api/site-health-details/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getBatteryVitalsCounts: async (filters) => {
    try {
      const response = await djangoApi.get('/api/site-status/', { params: { ...filters, page: 1, page_size: 1 } });
      const body = response.data;
      if (body.status === 'success') {
        // Safe check for where analytics might be located
        return body.battery_analytics || (body.data && body.data.battery_analytics) || body.data;
      }
      return body.battery_analytics || body.data || body;
    } catch (error) {
      console.log('API Error getBatteryVitalsCounts:', error);
      return null;
    }
  },
  // Dashboard tab Site Vitals - single API with range filter param
  getSiteVitals: async (filters, page = 1, pageSize) => {
    const response = await djangoApi.get('/api/site-vitals-details/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  // â”€â”€ Sidebar specific APIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getSitesAtRisk: async (filters, page = 1, pageSize) => {
    const response = await djangoApi.get('/api/sites-at-risk/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getCriticalSites: async (filters, page = 1, pageSize) => {
    const response = await djangoApi.get('/api/critical-sites/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getOperationalSites: async (filters, page = 1, pageSize) => {
    const response = await djangoApi.get('/api/operational-sites/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getSiteNonComm: async (filters, page = 1, pageSize) => {
    const response = await djangoApi.get('/api/site-communication-statuss/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getAutomationStatus: async (filters) => {
    const response = await djangoApi.get('/api/automation-status/', { params: filters });
    return response.data;
  },
  getAutomationDetails: async (filters, page = 1, pageSize = 1000) => {
    const response = await djangoApi.get('/api/automation-details/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getAlarms: async (filters, pageSize = 100) => {
    const response = await djangoApi.get('/api/alarms/', { params: { ...filters, page_size: pageSize } });
    return response.data;
  },

  // âœ… FIX: SMPS alarms â†’ /api/alarms/  (was incorrectly hitting live-fast-alarms before)
  getLiveAlarmsSnmp: async (filters, pageSize = 1000) => { const response = await djangoApi.get('/api/live-alarms-snmp/', { params: { ...filters, page_size: pageSize } }); return response.data; },

  getSmpsAlarms: async (filters, pageSize = 1000) => {
    const response = await djangoApi.get('/api/alarms/', { params: { ...filters, page_size: pageSize } });
    return response.data;
  },

  // âœ… TPMS / RMS alarms â†’ /api/live-fast-alarms/ (correct endpoint)
  getLiveFastAlarms: async (filters, pageSize = 100) => {
    const response = await djangoApi.get('/api/live-fast-alarms/', { params: { ...filters, page_size: pageSize } });
    return response.data;
  },
  getRmsAlarms: async (filters, pageSize = 1000) => {
    const response = await djangoApi.get('/api/live-fast-alarms/', { params: { ...filters, page_size: pageSize } });
    return response.data;
  },

  // â”€â”€ UPTIME & SLA â”€â”€
  getUptimeSummary: async (filters) => {
    const res = await djangoApi.get('/daily-uptime-report/', { params: filters });
    return res.data;
  },
  getUptimeDetails: async (filters) => {
    const ctmid = await AsyncStorage.getItem('user_ctmid');
    const aid = await AsyncStorage.getItem('user_id');
    const response = await djangoApi.get('/api/home-uptime-detail/', { params: { ...filters, ctmid, user_id: aid } });
    return response.data;
  },
  getSlaCompliance: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/sla-compliance/', { params: filters });
    return response.data;
  },
  getUptimeComparison: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/comparison/', { params: filters });
    return response.data;
  },
  getCircleUptime: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/circle-wise/', { params: filters });
    return response.data;
  },
  getOpcoUptime: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/opco-wise/', { params: filters });
    return response.data;
  },
  getAttributeAnalysis: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/attribute-wise/', { params: filters });
    return response.data;
  },
  getRepeatOutages: async (filters, threshold = 2) => {
    const response = await djangoApi.get('/api/uptime-sla/repeat-outages/', { params: { ...filters, threshold } });
    return response.data;
  },
  getSeasonalPreparedness: async (filters, season = 'Summer') => {
    const response = await djangoApi.get('/api/uptime-sla/seasonal-preparedness/', { params: { ...filters, season } });
    return response.data;
  },
  getSiteWiseUptime: async (filters) => {
    const response = await djangoApi.get('/api/uptime-sla/site-wise/', { params: filters });
    return response.data;
  },
  getMonthlyUptimeHistory: async (filters, groupby = 'site') => {
    const response = await djangoApi.get('/api/uptime-sla/monthly-history/', { params: { ...filters, groupby } });
    return response.data;
  },
  getQuarterlyUptimeHistory: async (filters, groupby = 'site') => {
    const response = await djangoApi.get('/api/uptime-sla/quarterly-history/', { params: { ...filters, groupby } });
    return response.data;
  },

  // â”€â”€ DCEM & ENERGY â”€â”€
  getDCEMAnalytics: async (params = {}) => {
    const response = await djangoApi.get('/api/dcem/analytics/', { params });
    return response.data;
  },
  getDCEMMonthlyReport: async (params = {}) => {
    const response = await djangoApi.get('/api/dcem/monthly-report/', { params });
    return response.data;
  },
  getEnergyRunHours: async (params = {}) => {
    const response = await djangoApi.get('/api/energy/run-hours/', { params });
    return response.data;
  },
  getEnergyRunHoursDetails: async (params = {}) => {
    const response = await djangoApi.get('/api/energy/run-hours-details/', { params });
    return response.data;
  },
  getGridAnalytics: async (params = {}) => {
    const response = await djangoApi.get('/api/grid-analytics/', { params });
    return response.data;
  },

  // â”€â”€ MAINTENANCE & TOOLS â”€â”€
  getTTTools: async () => {
    const response = await djangoApi.get('/api/tt_tools/');
    return response.data;
  },
  submitTTTool: async (formData) => {
    const response = await djangoApi.post('/api/tt_tools/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  getToolData: async (params = {}) => {
    const response = await djangoApi.get('/api/tool/', { params });
    return response.data;
  },

  // â”€â”€ REPORTS & HISTORY â”€â”€
  getMasterReport: async (filters, page = 1, pageSize = 25) => {
    const response = await djangoApi.get('/api/rms/master-report/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getRevenueData: async (params = {}) => {
    const response = await djangoApi.get('/api/revenue-data/', { params });
    return response.data;
  },
  getSiteLogs: async (params = {}) => {
    const response = await djangoApi.get('/api/site-logs/', { params });
    return response.data;
  },
  getHistoricalAlarms: async (params = {}) => {
    console.log('Sending params:', params);
    try {
      const response = await djangoApi.get('/api/historical-alarms-snmp/', { params });
      console.log('API Response:', JSON.stringify(response.data).substring(0, 200));
      return response.data;
    } catch (e) {
      console.log('API Error:', e.message, e.response?.data);
      throw e;
    }
  },
  exportFilteredData: async (filters) => {
    const response = await djangoApi.get('/api/site-status/', { params: { ...filters, page: 1, page_size: 10000 } });
    return response.data;
  },
  exportNonCommSites: async (filters) => {
    return await djangoApi.get('/non-communicating-sites/export/', { params: filters, responseType: 'arraybuffer' });
  },
  getCommunicationData: async (imei) => {
    const response = await djangoApi.get(`/api/communication/${imei}/`);
    return response.data;
  },

  // â”€â”€ ANALYTICS â”€â”€
  getNocAnalytics: async (period = 'today', filter = 'all') => {
    const response = await djangoApi.get('/api/noc-analytics/', { params: { period, filter } });
    return response.data;
  },
  getSiteSummary: async (filters = {}) => {
    const response = await djangoApi.get('/api/site-summary/', { params: filters });
    return response.data;
  },
  getSiteVariationData: async (filters = {}, page = 1, pageSize = 2000) => {
    const response = await djangoApi.get('/api/site-variation-data/', { params: { ...filters, page, page_size: pageSize } });
    return response.data;
  },
  getGridAnalytics: async (params = {}) => {
    const response = await djangoApi.get('/api/grid-analytics/', { params });
    return response.data;
  },

  // â”€â”€ BATTERY HEALTH â”€â”€
  getBatteryHealthAnalytics: async (params = {}) => {
    const response = await djangoApi.get('/api/battery-health-analytics/', { params });
    return response.data;
  },
  getBatteryHealthReport: async (params = {}) => {
    const response = await djangoApi.get('/api/battery-health-report/', { params });
    return response.data;
  },





  // â”€â”€ METADATA & DROPDOWNS â”€â”€
  getClients: async () => {
    const response = await djangoApi.get('/client-data/');
    const list = toArray(response.data, 'clients', 'client_data');
    const data = list.map(c => ({
      client_id: c.client_id ?? c.ctmids ?? c.ctmid ?? c.id,
      client_name: c.client_name ?? c.companyname ?? c.name,
    }));
    return { status: 'success', data };
  },
  getStates: async () => {
    const response = await djangoApi.get('/api/filters/states/');
    const list = toArray(response.data, 'data', 'states');
    const data = list.map(s => ({
      state_id: s.state_id ?? s.id,
      state_name: s.state_name ?? s.name,
    }));
    return { status: 'success', data };
  },
  getDistricts: async (state_id) => {
    const response = await djangoApi.get(`/get_districts_for_filter/${state_id}/`);
    const list = toArray(response.data, 'districts');
    const data = list.map(d => ({
      district_id: d.dist_id ?? d.district_id ?? d.id,
      district_name: d.dist_name ?? d.district_name ?? d.name,
    }));
    return { status: 'success', data };
  },
  getClusters: async (dist_id) => {
    const response = await djangoApi.get(`/get_clusters_for_filter/${dist_id}/`);
    const list = toArray(response.data, 'clusters');
    const data = list.map(c => ({
      cluster_id: c.cluster_id ?? c.id,
      cluster_name: c.cluster_name ?? c.name,
    }));
    return { status: 'success', data };
  },
  getMetadata: async (type) => {
    const response = await djangoApi.get('/api/location-dropdowns/', {
      params: { type },
    });
    return response.data;
  },

  // â”€â”€ ASSET HEALTH â”€â”€
  getAssetHealthOverview: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/overview/', { params });
    return response.data;
  },
  getAssetHealthBattery: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/battery/', { params });
    return response.data;
  },
  getAssetHealthDG: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/dg/', { params });
    return response.data;
  },
  getAssetHealthRectifier: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/rectifier/', { params });
    return response.data;
  },
  getAssetHealthSolar: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/solar/', { params });
    return response.data;
  },
  getAssetHealthDGBattery: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/dg-battery/', { params });
    return response.data;
  },
  getAssetHealthLightning: async (params = {}) => {
    const response = await djangoApi.get('/api/asset-health/lightning-arrester/', { params });
    return response.data;
  },

  // â”€â”€ SUPPORT â”€â”€
  submitSupportTicket: async (formData) => {
    const response = await djangoApi.post('/api/support/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // â”€â”€ ROBOTIC CALLS â”€â”€
  getRoboticCalls: async (params = {}) => {
    const response = await djangoApi.get('/api/robotic-calls/', { params });
    return response.data;
  },
  exportRoboticCalls: async (params = {}) => {
    return await djangoApi.get('/api/robotic-calls/export/', { params, responseType: 'arraybuffer' });
  },

  // â”€â”€ MQTT Related â”€â”€
  getDeviceSettings: async (imei, device_type) => {
    const response = await djangoApi.get('/get_device_settings/', { params: { imei, device_type } });
    return response.data;
  },
  sendDeviceCommand: async (formData) => {
    const response = await djangoApi.post('/send_device_command/', formData);
    return response.data;
  },
  getCommandStatus: async (imei) => {
    const response = await djangoApi.get('/get_command_status/', { params: { imei } });
    return response.data;
  },
  getAllMqttMessages: async (imei, limit = 50) => {
    const response = await djangoApi.get('/get_all_mqtt_messages/', { params: { imei, limit } });
    return response.data;
  },

  // â”€â”€ SNMP Related â”€â”€
  getSnmpSites: async (params = {}) => {
    const response = await djangoApi.get('/api/sites/', { params });
    return response.data;
  },
  getSnmpDeviceParameters: async (imei) => {
    const response = await djangoApi.get('/snmp/api/device-parameters/', { params: { imei } });
    return response.data;
  },
  getSnmpCurrentValues: async (imei) => {
    const response = await djangoApi.get('/snmp/api/current-values/', { params: { imei } });
    return response.data;
  },
  sendSnmpGet: async (formData) => {
    const response = await djangoApi.post('/snmp/api/get/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  sendSnmpSet: async (formData) => {
    const response = await djangoApi.post('/snmp/api/set/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  // â”€â”€ User Management â”€â”€
  submitUserManagementData: async (payload) => {
    const response = await djangoApi.post('/api/user-management-input/', payload);
    return response.data;
  },
};
