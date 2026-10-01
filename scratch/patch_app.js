const fs = require('fs');
let c = fs.readFileSync('App.tsx', 'utf8');

c = c.replace(
    "import SiteVariationScreen from './src/screens/SiteVariation/SiteVariationScreen';",
    "import SiteVariationScreen from './src/screens/SiteVariation/SiteVariationScreen';\nimport SolarAnalyticsScreen from './src/screens/Solar/SolarAnalyticsScreen';"
);

c = c.replace(
    '<Stack.Screen name="SiteVariation" component={SiteVariationScreen} />',
    '<Stack.Screen name="SiteVariation" component={SiteVariationScreen} />\n          <Stack.Screen name="SolarAnalytics" component={SolarAnalyticsScreen} />'
);

fs.writeFileSync('App.tsx', c);
