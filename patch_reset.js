const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "useEffect(() => {\n          if (Object.keys(globalFilters).length > 0) {\n              fetchData(1);\n          }\n      }, [globalFilters, fetchData]);",
    "useEffect(() => {\n          if (Object.keys(globalFilters).length > 0) {\n              fetchData(1);\n          } else {\n              setData([]);\n              setHasLoaded(false);\n              setTotalRecords(0);\n              setCurrentPage(1);\n              setTotalPages(1);\n          }\n      }, [globalFilters, fetchData]);"
);

fs.writeFileSync(file, code);
console.log('Patched useEffect for clear/reset state');
