const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /\{\!hasLoaded \? \(\s*<View style=\{styles\.emptyBox\}>\s*<AppIcon name="database" size=\{40\} color="#cbd5e1" \/>\s*<Text style=\{styles\.emptyTxt\}>Apply filters to load site logs<\/Text>\s*<Text style=\{\[styles\.emptyTxt, \{marginTop: 8, fontSize: 12\}\]\}>Click the filter icon in the top right<\/Text>\s*<\/View>\s*\) : loading \? \(\s*<View style=\{styles\.loaderBox\}>\s*<ActivityIndicator size="large" color="#5B9BD5" \/>\s*<Text style=\{styles\.loaderTxt\}>Loading site logs\.\.\.<\/Text>\s*<\/View>\s*\) : \(/g,
    "loading ? (\n                  <View style={styles.loaderBox}>\n                      <ActivityIndicator size=\"large\" color=\"#5B9BD5\" />\n                      <Text style={styles.loaderTxt}>Loading site logs...</Text>\n                  </View>\n              ) : !hasLoaded ? (\n                  <View style={styles.emptyBox}>\n                      <AppIcon name=\"database\" size={40} color=\"#cbd5e1\" />\n                      <Text style={styles.emptyTxt}>Apply filters to load site logs</Text>\n                      <Text style={[styles.emptyTxt, {marginTop: 8, fontSize: 12}]}>Click the filter icon in the top right</Text>\n                  </View>\n              ) : ("
);

// Fallback in case regex doesn't match perfectly
if (code.includes('loading ? (')) {
    fs.writeFileSync(file, code);
    console.log('Fixed loading check order');
} else {
    console.log('Regex failed, trying simpler replace');
}
