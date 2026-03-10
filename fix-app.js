const fs = require('fs');
let content = fs.readFileSync('frontend/App.tsx', 'utf8');
content = content.replace('</Router>);', '</Router></ToastProvider>);');
fs.writeFileSync('frontend/App.tsx', content);
console.log('Done!');
