const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Analytics/NocAnalyticsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `            // Fetch SMPS alarms (same endpoint as website /api/alarms/)`;
const replaceStr = `            const apiFilters = { ...globalFilters };
            if (apiFilters.customer_id) { apiFilters.client = apiFilters.customer_id; delete apiFilters.customer_id; }
            if (apiFilters.state_id) { apiFilters.state = apiFilters.state_id; delete apiFilters.state_id; }
            
            // Fetch SMPS alarms (same endpoint as website /api/alarms/)`;

if (!code.includes('apiFilters.client = apiFilters.customer_id')) {
    code = code.replace(targetStr, replaceStr);
    code = code.replace(`const smpsRes = await api.getAlarms(globalFilters);`, `const smpsRes = await api.getAlarms(apiFilters);`);
    code = code.replace(`const tpmsRes = await api.getLiveFastAlarms(globalFilters);`, `const tpmsRes = await api.getLiveFastAlarms(apiFilters);`);
    fs.writeFileSync(file, code);
    console.log('Patched NocAnalyticsScreen successfully');
} else {
    console.log('Already patched');
}
