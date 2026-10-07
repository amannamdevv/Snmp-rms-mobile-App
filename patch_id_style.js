const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "id: { fontSize: responsiveFontSize(9), flexShrink: 1, color: '#64748b', fontFamily: 'monospace' },",
    "id: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#334155', fontFamily: 'monospace', fontWeight: '500' },"
);

fs.writeFileSync(file, code);
console.log('Patched Global ID text style');
