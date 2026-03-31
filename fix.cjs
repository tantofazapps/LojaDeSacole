const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\$\{theme\.primary\}/g, '${theme.primary}'); // this is just a check
content = content.replace(/className={`([^`]+)`}/g, (match, p1) => {
  // Fix nested template literals that were broken
  let fixed = p1.replace(/'\$\{theme\.primary\} text-white'/g, '`${theme.primary} text-white`');
  fixed = fixed.replace(/'text-gray-600 hover:\$\{theme\.light\}'/g, '`text-gray-600 ${theme.hoverLight}`');
  fixed = fixed.replace(/'\$\{theme\.text\}'/g, '`${theme.text}`');
  fixed = fixed.replace(/'\$\{theme\.border\}'/g, '`${theme.border}`');
  fixed = fixed.replace(/'hover:\$\{theme\.light\}\/50'/g, '`${theme.hoverLight}/50`');
  return `className={\`${fixed}\`}`;
});

fs.writeFileSync(filePath, content);
console.log('Done');
