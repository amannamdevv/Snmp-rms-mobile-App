const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update useGlobalFilter to extract hasActiveFilters
code = code.replace(
    "const { globalFilters, setGlobalFilters } = useGlobalFilter();",
    "const { globalFilters, setGlobalFilters, hasActiveFilters } = useGlobalFilter();"
);

// Update useEffect condition
code = code.replace(
    "if (Object.keys(globalFilters).length > 0) {",
    "if (hasActiveFilters) {"
);

// Add hasActiveFilters to dependencies
code = code.replace(
    "}, [globalFilters, fetchData]);",
    "}, [globalFilters, fetchData, hasActiveFilters]);"
);

fs.writeFileSync(file, code);
console.log('Patched SiteLogsScreen to use hasActiveFilters');
