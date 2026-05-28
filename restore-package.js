const fs = require('fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

if (pkg.devDependencies) {
  delete pkg.devDependencies['@vitejs/plugin-react']
  pkg.devDependencies['@vitejs/plugin-react-swc'] = '^3.0.0'
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
console.log('✅ package.json restored to @vitejs/plugin-react-swc')
