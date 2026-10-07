const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/api/index.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "await AsyncStorage.multiRemove([KEYS.DJANGO_SESSION, KEYS.DJANGO_SESSION_PENDING]);",
    "await AsyncStorage.multiRemove([KEYS.DJANGO_SESSION, KEYS.DJANGO_SESSION_PENDING, 'user_role', 'user_ptye', 'user_ctmid']);"
);

fs.writeFileSync(file, code);
console.log('Patched logoutApi to clear user_role');
