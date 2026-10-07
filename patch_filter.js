const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "const userCtmid = await AsyncStorage.getItem('user_ctmid');",
    "const userRole = await AsyncStorage.getItem('user_role');"
);

code = code.replace(
    "if (userCtmid) setIsClientUser(true);",
    "if (userRole !== 'Superadmin') setIsClientUser(true);"
);

fs.writeFileSync(file, code);
console.log('Patched FilterModal to use user_role');
