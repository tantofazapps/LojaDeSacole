const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the SettingsPage component and replace ${theme. with ${currentTheme.
const settingsPageStart = content.indexOf('function SettingsPage');
if (settingsPageStart !== -1) {
  const before = content.substring(0, settingsPageStart);
  let after = content.substring(settingsPageStart);
  after = after.replace(/\$\{theme\./g, '${currentTheme.');
  content = before + after;
}

fs.writeFileSync(filePath, content);
console.log('Done');
