const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Overview/OverviewScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "      </ScrollView>\n    </View>\n  );\n}",
    "      </ScrollView>\n    </SafeAreaView>\n  );\n}"
);

fs.writeFileSync(file, code);
console.log('Fixed SafeAreaView closing tag');
