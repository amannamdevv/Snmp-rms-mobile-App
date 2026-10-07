const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Snmp/SnmpToolScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /if \(param\) \{\s*handleGet\(param\);\s*\}/g,
    "// if (param) { handleGet(param); } // Disabled to prevent 500 error"
);

fs.writeFileSync(file, code);
console.log('Disabled handleGet in handleParamSelect');
