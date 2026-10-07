const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Overview/OverviewScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    '<AppHeader title="Overview" leftAction="back" onLeftPress={() => navigation.goBack()} />',
    '<AppHeader title="Overview" leftAction="back" onLeftPress={() => navigation.goBack()} hideGlobalFilter={true} />'
);

fs.writeFileSync(file, code);
console.log('Added hideGlobalFilter to OverviewScreen AppHeader');
