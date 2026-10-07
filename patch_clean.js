const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// Also adding a console log in case we need it later
code = code.replace(
    "if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() === 'superadmin') { setIsClientUser(false); } else { setIsClientUser(true); }",
    "if (String(userRole || '').replace(/\\s/g, '').toLowerCase() === 'superadmin') { setIsClientUser(false); } else { setIsClientUser(true); }"
);

fs.writeFileSync(file, code);
console.log('Cleaned up aggressive patch');
