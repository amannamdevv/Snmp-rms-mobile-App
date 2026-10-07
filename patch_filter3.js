const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "if (String(userRole || '').replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);",
    "if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);\n      else setIsClientUser(false);"
);

fs.writeFileSync(file, code);
console.log('Patched FilterModal to default to showing dropdown if userRole is null');
