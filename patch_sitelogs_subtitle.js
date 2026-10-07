const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /subtitle=\{hasLoaded \? `\$\{totalRecords\} records .*?` : 'Apply filters to load'\}/,
    ""
);

fs.writeFileSync(file, code);
console.log('Removed subtitle from SiteLogsScreen AppHeader');
