// Build step 1: copy both notebooks and the 17 recorded figures into public/generated and
// write src/generated/data.json from the notebook outputs. Run by `npm run build` and `npm run dev`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './extract.js';
import { census } from './notebook.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const pub = path.resolve(here, '../public/generated');
const gen = path.resolve(here, 'generated');
for (const d of [path.join(pub, 'nb'), path.join(pub, 'fig'), gen]) fs.mkdirSync(d, { recursive: true });

export const NOTEBOOKS = ['assignment2DataCleaning_final_original.ipynb', 'AutoReport.ipynb'];
const books = {};
for (const f of NOTEBOOKS) {
  fs.copyFileSync(path.join(repo, f), path.join(pub, 'nb', f));
  books[f] = JSON.parse(fs.readFileSync(path.join(repo, f), 'utf8'));
}
const clean = books[NOTEBOOKS[0]];
const data = extract(clean);
for (const fig of data.figures) fs.writeFileSync(path.join(pub, 'fig', fig.file), Buffer.from(clean.cells[fig.cell].outputs[fig.k].data['image/png'].replace(/\s/g, ''), 'base64'));
data.notebooks = NOTEBOOKS.map((f) => ({ file: f, bytes: fs.statSync(path.join(repo, f)).size, census: census(books[f]) }));
fs.writeFileSync(path.join(gen, 'data.json'), JSON.stringify(data, null, 1));
console.log(`prepared ${data.figures.length} figures, ${NOTEBOOKS.length} notebooks, data.json`);
