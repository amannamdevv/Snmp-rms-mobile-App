const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "<LogCard row={item} columns={columns} />",
    "<LogCard row={item} columns={columns} globalFilters={globalFilters} />"
);

fs.writeFileSync(file, code);
console.log('Fixed LogCard instantiation to pass globalFilters');
