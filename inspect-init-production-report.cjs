const fs = require('fs');

const path = 'src/App.jsx';
const text = fs.readFileSync(path, 'utf8');

const start = text.indexOf('async function initProductionReport');
if (start < 0) {
  throw new Error('initProductionReport function not found');
}

let braceStart = text.indexOf('{', start);
let depth = 0;
let end = braceStart;

for (let i = braceStart; i < text.length; i++) {
  if (text[i] === '{') depth++;
  if (text[i] === '}') depth--;
  if (depth === 0) {
    end = i + 1;
    break;
  }
}

const before = text.slice(0, start).split(/\r?\n/).length;
const fn = text.slice(start, end).split(/\r?\n/);

const output = fn.map((line, idx) => `${before + idx}: ${line}`).join('\n');

fs.writeFileSync('INIT_PRODUCTION_REPORT_FUNCTION.txt', output, 'utf8');

console.log('DONE: Created INIT_PRODUCTION_REPORT_FUNCTION.txt');
