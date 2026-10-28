import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PRODUCTS} from './catalog.mjs';

const target = fileURLToPath(new URL('../supabase/functions/public-ordering/catalog.json', import.meta.url));
const catalog = PRODUCTS.map(({id,name,price,unitLabel,piecesPerUnit,type}) =>
  ({id,name,price,unitLabel,piecesPerUnit,type}));
await writeFile(target, `${JSON.stringify(catalog,null,2)}\n`, 'utf8');
