const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /useEffect\(\(\) => \{\s*if \(hasActiveFilters\) \{\s*fetchData\(1\);\s*\}\s*\}, \[globalFilters, fetchData, hasActiveFilters\]\);/,
    `useEffect(() => {
          if (hasActiveFilters) {
              fetchData(1);
          } else {
              setData([]);
              setHasLoaded(false);
              setTotalRecords(0);
              setCurrentPage(1);
              setTotalPages(1);
          }
      }, [globalFilters, fetchData, hasActiveFilters]);`
);

fs.writeFileSync(file, code);
console.log('Successfully added else block to useEffect');
