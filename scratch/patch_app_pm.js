const fs = require('fs');
let c = fs.readFileSync('App.tsx', 'utf8');

if (!c.includes('PMAnalyticsScreen')) {
  c = c.replace(
      "import SolarAnalyticsScreen from './src/screens/Solar/SolarAnalyticsScreen';",
      "import SolarAnalyticsScreen from './src/screens/Solar/SolarAnalyticsScreen';\nimport PMAnalyticsScreen from './src/screens/PMAnalytics/PMAnalyticsScreen';"
  );

  c = c.replace(
      '<Stack.Screen name="SolarAnalytics" component={SolarAnalyticsScreen} />',
      '<Stack.Screen name="SolarAnalytics" component={SolarAnalyticsScreen} />\n          <Stack.Screen name="PMAnalytics" component={PMAnalyticsScreen} />'
  );

  fs.writeFileSync('App.tsx', c);
  console.log("App.tsx patched for PMAnalytics");
} else {
  console.log("PMAnalytics already added");
}
