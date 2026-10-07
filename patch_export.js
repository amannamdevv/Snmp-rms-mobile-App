const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Dashboard/SiteHealthScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStrExport = `const res = await api.getSiteHealth({ status: statusFilter, ...globalFilters }, 1, 10000);`;
const replaceStrExport = `const exportFilters = { status: statusFilter, ...globalFilters } as any;
      if (exportFilters.customer_id) { exportFilters.ctmids = exportFilters.customer_id; delete exportFilters.customer_id; }
      const res = await api.getSiteHealth(exportFilters, 1, 10000);`;

if (code.includes(targetStrExport)) {
    code = code.replace(targetStrExport, replaceStrExport);
    fs.writeFileSync(file, code);
    console.log('Patched export in SiteHealthScreen successfully');
} else {
    console.log('Already patched export');
}
