const fs = require('fs');

// ── FIX 1: api/index.js ─ getUptimeSummary 404 fix
const apiFile = 'C:/Aman/SNMP-RMSApp/src/api/index.js';
let api = fs.readFileSync(apiFile, 'utf8');

const oldUptime = `  getUptimeSummary: async (filters) => {
      const res = await djangoApi.get('/daily-uptime-report/', { params: filters });
      return res.data;
    },`;
const newUptime = `  getUptimeSummary: async (filters) => {
      // Fixed: was missing /api/ prefix causing 404
      const res = await djangoApi.get('/api/daily-uptime-report/', { params: filters }).catch(async (e) => {
        // fallback: try without /api/ prefix in case server differs
        if (e?.response?.status === 404) {
          return await djangoApi.get('/daily-uptime-report/', { params: filters }).catch(() => null);
        }
        return null;
      });
      return res ? res.data : null;
    },`;

if (api.includes(`djangoApi.get('/daily-uptime-report/'`)) {
    api = api.replace(oldUptime, newUptime);
    fs.writeFileSync(apiFile, api);
    console.log('[1] Fixed getUptimeSummary endpoint');
} else {
    console.log('[1] getUptimeSummary already fixed or pattern not found');
}

// ── FIX 2: DashboardScreen – getSiteHealth must use ctmids too (same as fCtmids)
const dashFile = 'C:/Aman/SNMP-RMSApp/src/screens/Dashboard/DashboardScreen.tsx';
let dash = fs.readFileSync(dashFile, 'utf8');

const oldSiteHealth = `api.getSiteHealth(f, 1, 1).then(r => r ? r.kpi_data || r : null).catch((e) => { console.log('Err getSiteHealth fallback', e); return null; }),`;
const newSiteHealth = `api.getSiteHealth(fCtmids, 1, 1).then(r => r ? r.kpi_data || r : null).catch((e) => { console.log('Err getSiteHealth fallback', e); return null; }),`;

if (dash.includes(oldSiteHealth)) {
    dash = dash.replace(oldSiteHealth, newSiteHealth);
    fs.writeFileSync(dashFile, dash);
    console.log('[2] Fixed Dashboard getSiteHealth to use fCtmids (ctmids instead of customer_id)');
} else {
    console.log('[2] Already fixed or pattern not found');
}

// ── FIX 3: Dashboard getUptimeSummary & getBatteryHealthAnalytics also use fCtmids
const oldUptime2 = `api.getUptimeSummary(f).catch`;
const newUptime2 = `api.getUptimeSummary(fCtmids).catch`;
if (dash.includes(oldUptime2)) {
    dash = fs.readFileSync(dashFile, 'utf8');
    dash = dash.replace(oldUptime2, newUptime2);
    fs.writeFileSync(dashFile, dash);
    console.log('[3] Fixed Dashboard getUptimeSummary to use fCtmids');
} else {
    console.log('[3] getUptimeSummary already using fCtmids or not found');
}

const oldBatt = `api.getBatteryHealthAnalytics(f).catch`;
const newBatt = `api.getBatteryHealthAnalytics(fCtmids).catch`;
dash = fs.readFileSync(dashFile, 'utf8');
if (dash.includes(oldBatt)) {
    dash = dash.replace(oldBatt, newBatt);
    fs.writeFileSync(dashFile, dash);
    console.log('[4] Fixed Dashboard getBatteryHealthAnalytics to use fCtmids');
} else {
    console.log('[4] getBatteryHealthAnalytics already using fCtmids or not found');
}
