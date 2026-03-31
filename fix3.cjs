const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/border-orange-50/g, '${theme.border}');
content = content.replace(/className="([^"]*\$\{theme\.[^}]+\}[^"]*)"/g, 'className={`$1`}');

fs.writeFileSync(filePath, content);
console.log('Done');
