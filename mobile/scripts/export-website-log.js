#!/usr/bin/env node
// Copies one person's workout log from flexdaddies.com into a CSV file the
// store app brings in (Settings > Bring in workouts from Hevy or Strong).
//
// READ-ONLY: it sends one SELECT to the website's database and changes nothing.
// Needs the Mac signed in to Cloudflare (npx wrangler login, once).
//
// Usage, from the mobile folder:
//   node scripts/export-website-log.js [person] [output file]
//   node scripts/export-website-log.js Diego ~/Desktop/flexdaddies-log.csv
// Or from a saved database answer (for testing):
//   node scripts/export-website-log.js Diego out.csv --from rows.json

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { websiteToCsv } = require('./website-csv');

const DATABASE = 'flexdaddies-log-db';
const QUERY =
  'SELECT id, user, date, exercises, notes, logged_at, template_name FROM workouts ORDER BY date, logged_at';

const args = process.argv.slice(2);
const fromIndex = args.indexOf('--from');
const fromFile = fromIndex >= 0 ? args.splice(fromIndex, 2)[1] : null;
const person = args[0] || 'Diego';
const out = (args[1] || `flexdaddies-com-${person.toLowerCase()}-workouts.csv`).replace(
  /^~(?=\/)/,
  os.homedir(),
);

function readRows() {
  if (fromFile) return JSON.parse(fs.readFileSync(fromFile, 'utf8'));
  // Run from a scratch folder so no project's package settings get in the way.
  const answer = execFileSync(
    'npx',
    ['--yes', 'wrangler@4', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', QUERY],
    {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const parsed = JSON.parse(answer.slice(answer.indexOf('[')));
  if (parsed.some((block) => block.meta && block.meta.changed_db)) {
    throw new Error('The database reported a change. This script only reads; stop and check.');
  }
  return parsed.flatMap((block) => block.results ?? []);
}

const rows = readRows();
const people = [...new Set(rows.map((r) => r.user))].sort();
if (!people.includes(person)) {
  console.error(`No workouts for "${person}". People in the log: ${people.join(', ') || 'none'}.`);
  process.exit(1);
}
const r = websiteToCsv(rows, person);
fs.writeFileSync(out, r.csv);
console.log(
  `${person}: ${r.workouts} workouts, ${r.sets} sets, ${r.firstDate} to ${r.lastDate}` +
    (r.skipped ? ` (${r.skipped} empty or unreadable skipped)` : '') +
    `\nWritten to ${path.resolve(out)}`,
);
