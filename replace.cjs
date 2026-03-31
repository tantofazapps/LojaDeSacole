const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// First, add the theme variable to each component
const components = [
  'AdminDashboard',
  'DashboardStats',
  'Orders',
  'Flavors',
  'Manufacturing',
  'ShoppingList',
  'Promotions',
  'SettingsPage'
];

components.forEach(comp => {
  const regex = new RegExp(`function ${comp}\\([^\\)]*\\)\\s*{`, 'g');
  content = content.replace(regex, match => {
    return `${match}\n  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];`;
  });
});

// Now replace all hardcoded orange classes with theme variables
content = content.replace(/bg-orange-500/g, '${theme.primary}');
content = content.replace(/hover:bg-orange-600/g, '${theme.hover}');
content = content.replace(/text-orange-500/g, '${theme.text}');
content = content.replace(/bg-orange-50/g, '${theme.light}');
content = content.replace(/border-orange-200/g, '${theme.border}');
content = content.replace(/border-orange-100/g, '${theme.border}');
content = content.replace(/text-orange-600/g, '${theme.text}');
content = content.replace(/bg-orange-100/g, '${theme.light}');
content = content.replace(/focus:ring-orange-500/g, 'focus:ring-opacity-50');

// Fix the template literals
// We need to make sure that the classes are inside template literals
// For example: className="min-h-screen ${theme.light} flex..." -> className={`min-h-screen ${theme.light} flex...`}
// This is a bit tricky with regex. Let's just use a simpler approach for className="... ${theme...} ..."
content = content.replace(/className="([^"]*\$\{theme\.[^}]+\}[^"]*)"/g, 'className={`$1`}');

fs.writeFileSync(filePath, content);
console.log('Done');
