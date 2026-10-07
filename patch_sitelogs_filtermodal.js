const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const filterModalComponent = `
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                initialFilters={globalFilters}
                onApply={(f) => {
                    setGlobalFilters(f);
                    setFilterVisible(false);
                }}
            />
            <Sidebar`;

code = code.replace("<Sidebar", filterModalComponent);

// Also fix the loading state order properly so that loading shows first!
code = code.replace(
    /\{\!hasLoaded \? \(\s*<View style=\{styles\.emptyBox\}>[\s\S]*?<\/View>\s*\) : loading \? \(\s*<View style=\{styles\.loaderBox\}>\s*<ActivityIndicator size="large" color="#5B9BD5" \/>\s*<Text style=\{styles\.loaderTxt\}>Loading site logs\.\.\.<\/Text>\s*<\/View>\s*\) : \(/,
    `{loading ? (
                  <View style={styles.loaderBox}>
                      <ActivityIndicator size="large" color="#5B9BD5" />
                      <Text style={styles.loaderTxt}>Loading site logs...</Text>
                  </View>
              ) : !hasLoaded ? (
                  <View style={styles.emptyBox}>
                      <AppIcon name="database" size={40} color="#cbd5e1" />
                      <Text style={styles.emptyTxt}>Apply filters to load site logs</Text>
                      <TouchableOpacity style={styles.filterPromptBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.8}>
                          <AppIcon name="sliders" size={14} color="#fff" />
                          <Text style={styles.filterPromptTxt}>Open Filters</Text>
                      </TouchableOpacity>
                  </View>
              ) : (`
);

fs.writeFileSync(file, code);
console.log('Patched SiteLogsScreen to add FilterModal and fix loading state order');
