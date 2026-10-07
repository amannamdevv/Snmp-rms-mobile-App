const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Dashboard/SiteHealthScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `      const reqFilters = { ...globalFilters };
      if (statusFilter !== 'all') {
         reqFilters.status = statusFilter;
      }`;
const replaceStr = `      // getSiteHealth expects ctmids instead of customer_id (same as other StatusAPIView endpoints)
      const reqFilters = { ...globalFilters } as any;
      if (reqFilters.customer_id) {
          reqFilters.ctmids = reqFilters.customer_id;
          delete reqFilters.customer_id;
      }
      
      if (statusFilter !== 'all') {
         reqFilters.status = statusFilter;
      }`;

if (code.includes('const reqFilters = { ...globalFilters };')) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync(file, code);
    console.log('Patched client identifier mapping in SiteHealthScreen successfully');
} else {
    console.log('Already patched client identifier mapping');
}
