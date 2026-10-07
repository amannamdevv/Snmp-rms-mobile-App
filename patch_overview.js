const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Overview/OverviewScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /\{\s*name:\s*'Quality Analytics',\s*icon:\s*'check-circle',\s*route:\s*'Overview',\s*locked:\s*true\s*\},/g,
    "// { name: 'Quality Analytics', icon: 'check-circle', route: 'Overview', locked: true },"
);

code = code.replace(
    /\{\s*name:\s*'Permit To Work Analytics',\s*icon:\s*'user-check',\s*route:\s*'Overview',\s*locked:\s*true\s*\},/g,
    "// { name: 'Permit To Work Analytics', icon: 'user-check', route: 'Overview', locked: true },"
);

fs.writeFileSync(file, code);
console.log('Removed Quality Analytics and Permit To Work Analytics from OverviewScreen');
