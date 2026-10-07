const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "{clients.length > 1 && (",
    "{(!isClientUser) && ("
);

fs.writeFileSync(file, code);
console.log('Patched FilterModal conditional rendering.');
