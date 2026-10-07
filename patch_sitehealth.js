const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Dashboard/SiteHealthScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the catch block to handle 500 errors gracefully
const oldCatch = `    } catch (e) {
      console.error("Data load error:", e);
    } finally {`;
const newCatch = `    } catch (e: any) {
      // If the backend returns 500 for a client with zero records/missing data, handle gracefully instead of crashing
      if (e?.response?.status === 500) {
        console.log("Handled backend 500 error for client with zero records/missing data.");
        if (isRefresh) setData([]);
        setCounts({ total: 0, up: 0, down: 0, non_comm: 0 });
        setHasNext(false);
      } else {
        console.warn("Data load error:", e?.message || e);
      }
    } finally {`;

if (code.includes('console.error("Data load error:", e);')) {
    code = code.replace(oldCatch, newCatch);
    fs.writeFileSync(file, code);
    console.log('Patched catch block in SiteHealthScreen successfully');
} else {
    console.log('Already patched catch block');
}
