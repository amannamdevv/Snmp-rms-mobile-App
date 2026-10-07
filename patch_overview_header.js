const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Overview/OverviewScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    '<AppHeader title="Overview" navigation={navigation} />',
    '<AppHeader title="Overview" leftAction="back" onLeftPress={() => navigation.goBack()} />'
);

fs.writeFileSync(file, code);
console.log('Fixed AppHeader props in OverviewScreen');
