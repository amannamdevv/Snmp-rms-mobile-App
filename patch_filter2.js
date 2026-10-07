const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "if (userRole !== 'Superadmin') setIsClientUser(true);",
    "if (String(userRole || '').replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);"
);

fs.writeFileSync(file, code);
console.log('Made userRole check case-insensitive and space-insensitive');
