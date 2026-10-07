const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix `filters` to `globalFilters` in fetchData
code = code.replace(
    "const params = { ...filters, page, page_size: 20 };",
    "const params = { ...globalFilters, page, page_size: 20 };"
);

// 2. Add useEffect to fetch data when globalFilters change
code = code.replace(
    "const onRefresh = () => { setRefreshing(true); fetchData(currentPage, true); };",
    "useEffect(() => {\n        if (Object.keys(globalFilters).length > 0) {\n            fetchData(1);\n        }\n    }, [globalFilters, fetchData]);\n\n    const onRefresh = () => { setRefreshing(true); fetchData(currentPage, true); };"
);
code = code.replace("import React, { useState, useCallback", "import React, { useState, useCallback, useEffect");

// 3. The empty state button uses setFilterVisible(true). I should remove that button and just say "Click the filter icon in the top right".
code = code.replace(
    "<TouchableOpacity style={styles.filterPromptBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.8}>\n                          <AppIcon name=\"sliders\" size={14} color=\"#fff\" />\n                          <Text style={styles.filterPromptTxt}>Open Filters</Text>\n                      </TouchableOpacity>",
    "<Text style={[styles.emptyTxt, {marginTop: 8, fontSize: 12}]}>Click the filter icon in the top right</Text>"
);

fs.writeFileSync(file, code);
console.log('Fixed SiteLogsScreen to fetch automatically on filter apply');
