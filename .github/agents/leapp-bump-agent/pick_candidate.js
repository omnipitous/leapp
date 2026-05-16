#!/usr/bin/env node
const fs = require('fs');
const p = process.argv[2];
if (!p) process.exit(0);
try {
  const raw = fs.readFileSync(p, 'utf8') || '{}';
  const o = JSON.parse(raw);
  const keys = Object.keys(o);
  if (keys.length === 0) process.exit(0);
  const major = v => String(v || '').replace(/^[^0-9]*/, '').split('.')[0];
  const pick = keys.find(k => {
    const cur = o[k].current || '';
    const lat = o[k].latest || '';
    return major(cur) === major(lat);
  }) || keys[0];
  const cur = o[pick].current || '';
  const lat = o[pick].latest || '';
  console.log(pick, cur, lat);
} catch (e) {
  process.exit(0);
}
