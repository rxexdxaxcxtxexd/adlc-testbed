// Keep the deployed ROI constants in sync with the documented inputs.
// Run: node scripts/sync-roi.js
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const target = path.join(root,'src/Roi.gs');
const inputs = JSON.parse(fs.readFileSync(path.join(root,'docs/roi-inputs.json'),'utf8'));
const current = fs.readFileSync(target,'utf8');
const start = current.indexOf('// ROI arithmetic is pure.');
if (start < 0) throw new Error('The ROI arithmetic marker is missing.');
fs.writeFileSync(target,'// Generated from docs/roi-inputs.json by scripts/sync-roi.js.\nvar ROI_INPUTS = '+JSON.stringify(inputs,null,2)+';\n\n'+current.slice(start));
console.log('Synced ROI inputs.');
