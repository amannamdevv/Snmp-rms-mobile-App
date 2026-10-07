const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);",
    "if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() === 'superadmin') { setIsClientUser(false); } else { setIsClientUser(true); }"
);
code = code.replace("else setIsClientUser(false);", "");

fs.writeFileSync(file, code);
console.log('Patched to aggressively HIDE if not superadmin');
