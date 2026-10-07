const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "const [isClientUser, setIsClientUser] = useState(false);",
    "const [isClientUser, setIsClientUser] = useState(false);\n  const [debugRole, setDebugRole] = useState('');"
);

code = code.replace(
    "if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);",
    "setDebugRole(String(userRole));\n      if (userRole && String(userRole).replace(/\\s/g, '').toLowerCase() !== 'superadmin') setIsClientUser(true);"
);

code = code.replace(
    "<Text style={styles.headerTitle}>Filters</Text>",
    "<Text style={styles.headerTitle}>Filters ({debugRole || 'null'})</Text>"
);

fs.writeFileSync(file, code);
console.log('Added debug text for role in FilterModal');
