// Taps through the whole app in a headless browser and checks the results.
// Usage: node e2e/run.js <folder made by "expo export --platform web"> [port]
// The export must be built with EXPO_PUBLIC_API_URL=http://localhost:8791:
// this script starts the test accounts server (../mobile-api) on that port.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium, devices } = require('playwright');

const root = path.resolve(process.argv[2] || 'dist-web');
const port = Number(process.argv[3] || 4173);
const URL = `http://localhost:${port}/`;
const API_PORT = 8791;
const shots = path.join(__dirname, 'screenshots');
fs.mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);
  if (!ok) failures++;
};

// A tiny web server for the exported app (any unknown path serves the app itself).
function serve() {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
  const server = http.createServer((req, res) => {
    let file = path.join(root, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// The store app's accounts server, on this computer, with an empty database each run.
function serveAccounts() {
  const child = spawn('node', [path.join(__dirname, '..', '..', 'mobile-api', 'dev-server.ts'), String(API_PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    child.stdout.once('data', () => resolve(child));
    child.once('exit', (code) => reject(new Error(`accounts server stopped (${code})`)));
  });
}

// Signs in with the emailed code (a test server shows it on screen).
async function signIn(page, email) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'EMAIL ME A CODE' }).click();
  const line = await page.getByText(/Test build: your code is \d{6}/).innerText();
  await page.getByLabel('6-digit code').fill(line.match(/\d{6}/)[0]);
}

async function firstTimeSetup(page, name) {
  await page.getByLabel('Your first name').fill(name);
  await page.getByRole('button', { name: 'START LOGGING' }).click();
}

// What the older scenarios were written against: a partner switched on and the sample data loaded.
async function partnerAndSampleData(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('switch', { name: 'Lift with a partner' }).click();
  await page.getByLabel("Partner's first name").fill('Kevin');
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.getByRole('switch', { name: 'Pro unlocked' }).click();
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
}

// Each scenario gets a brand new "phone" (empty storage, signed out).
async function scenario(browser, name, body) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  // The sample data stamps "today" at noon, so before noon a workout or weigh-in logged
  // by a check would sort ahead of it. Run every check as if it were 3 p.m. today.
  const afternoon = new Date();
  afternoon.setHours(15, 0, 0, 0);
  await ctx.clock.install({ time: afternoon });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  // The sign-in scenario types a wrong code on purpose; the browser logs the server's "no".
  const expected = (text) => name === 'sign-in' && text.includes('status of 400');
  page.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  const t = {
    page,
    dialogs,
    shot: (n) => page.screenshot({ path: path.join(shots, `${n}.png`) }),
    tab: async (label) => { await page.getByRole('tab', { name: label }).click(); await page.waitForTimeout(500); },
    count: (text) => page.getByText(text, { exact: false }).count(),
    scroll: async (dy) => { await page.mouse.move(195, 420); await page.mouse.wheel(0, dy); await page.waitForTimeout(350); },
    names: () => page.getByRole('button', { name: /^Exercise: / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/^Exercise: (.*)\. Tap to change\.$/, '$1'))),
    workouts: () => page.getByRole('button', { name: /exercises, .* sets/ }),
  };
  await page.goto(URL, { waitUntil: 'networkidle' });
  try {
    if (name !== 'sign-in') {
      await signIn(page, `${name}@example.com`);
      await firstTimeSetup(page, 'Diego');
      await page.getByRole('tab', { name: 'Log' }).waitFor();
      if (name !== 'progress') await partnerAndSampleData(page);
    }
    await body(t);
  } catch (e) {
    check(`${name}: ran to the end`, false, e.message.split('\n')[0]);
    await t.shot(`${name}-crash`);
  }
  check(`${name}: no errors in the browser console`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function reorder({ page, shot, names, scroll }) {
  await page.getByRole('button', { name: 'Start from routine 1 - Upper A' }).click();
  await page.waitForTimeout(600);
  const start = await names();
  check('plan loads 7 exercises in plan order', start.length === 7 && start[0] === 'Bench Press');

  await page.getByRole('button', { name: 'Move exercise down' }).first().click();
  await page.waitForTimeout(300);
  check('arrow moves an exercise down one place', (await names())[1] === 'Bench Press');
  check('offers to save the new order to the plan', (await page.getByRole('button', { name: 'Save this order to routine' }).count()) === 1);

  // Drag the first card by its grip and hold near the bottom edge so the page scrolls itself.
  const grip = page.getByLabel('Drag to reorder').first();
  const box = await grip.boundingBox();
  const x = box.x + 24;
  const y = box.y + 22;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x, Math.min(650, y + i * 25)); await page.waitForTimeout(16); }
  check('a tag follows the finger while dragging', (await page.getByText('Moving', { exact: true }).count()) === 1);
  await page.waitForTimeout(1500);
  await shot('reorder-01-dragging');
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await names();
  check('drag with auto-scroll moves the card several places', after.indexOf('Incline Bench Press') >= 2, after.join(' | '));
  check('the tag goes away on drop', (await page.getByText('Moving', { exact: true }).count()) === 0);

  // A plain tap on a grip must not move anything.
  await scroll(-5000);
  const before = await names();
  await page.getByLabel('Drag to reorder').first().click();
  await page.waitForTimeout(300);
  check('tapping a grip without dragging changes nothing', JSON.stringify(await names()) === JSON.stringify(before));

  await page.getByRole('button', { name: 'Save this order to routine' }).click();
  await page.waitForTimeout(500);
  check('order saved to the plan', (await page.getByText('Order saved').count()) === 1);
  await page.getByRole('button', { name: 'Start from routine 1 - Upper A' }).click();
  await page.waitForTimeout(500);
  check('the plan now opens in the saved order', JSON.stringify(await names()) === JSON.stringify(before));
}

async function logAndHistory({ page, shot, tab, count, dialogs, workouts }) {
  await shot('log-01-empty');
  await page.getByRole('button', { name: 'Start from routine 5 - Cardio + Rehab' }).click();
  await page.waitForTimeout(500);
  check('cardio plan loads 5 exercises', (await page.getByRole('button', { name: /^Exercise: / }).count()) === 5);
  check('cardio exercises get one time/intensity row', (await page.getByLabel('time in minutes').count()) === 2);
  const logBtn = page.getByRole('button', { name: 'LOG WORKOUT' });
  check('LOG WORKOUT is off until something is typed', await logBtn.isDisabled());
  await page.getByLabel('time in minutes').first().fill('30');
  await page.getByLabel('intensity, 1 to 10').first().fill('6');
  await page.getByLabel('intensity, 1 to 10').first().fill('11');
  check('intensity above 10 is refused', (await page.getByLabel('intensity, 1 to 10').first().inputValue()) === '6');
  await page.getByLabel('set 1 reps').first().fill('12');
  await page.getByLabel('set 1 weight in lbs').first().fill('22.5');
  await page.getByLabel('set 1 weight in lbs').first().fill('22.5.5');
  check('a second decimal point is refused', (await page.getByLabel('set 1 weight in lbs').first().inputValue()) === '22.5');
  await page.getByLabel('Notes for this exercise').first().fill('Felt strong today');
  await shot('log-02-filled');
  await logBtn.click();
  await page.waitForTimeout(800);
  check('form clears after logging', (await page.getByRole('button', { name: 'Choose an exercise' }).count()) === 1);

  await tab('History');
  await shot('history-01-list');
  const label = await workouts().first().getAttribute('aria-label');
  check('new workout is first in History with its plan label', /2 exercises, 2 sets.*5 - Cardio \+ Rehab/.test(label), label);
  await workouts().first().click();
  await page.waitForTimeout(400);
  await shot('history-02-open');
  check('cardio shows minutes and intensity', (await count('30 min · Intensity 6/10')) === 1);
  check('weights keep their decimals', (await count('12 reps × 22.5 lbs')) === 1);
  check('the note is attached to the workout', (await count('"Felt strong today"')) >= 1);

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForTimeout(700);
  await shot('history-03-edit');
  await page.getByLabel('time in minutes').first().fill('35');
  await page.getByRole('button', { name: 'SAVE CHANGES' }).click();
  await page.waitForTimeout(700);
  check('editing a workout saves', (await count('35 min · Intensity 6/10')) === 1);

  await page.getByRole('button', { name: 'Save as Routine' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Name this routine').fill('0 - Test Plan');
  await page.getByRole('button', { name: 'SAVE ROUTINE' }).click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Kevin', exact: true }).click();
  await page.waitForTimeout(300);
  check('Kevin filter shows only Kevin', await workouts().evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label').includes(', Kevin,'))));
  await workouts().first().click();
  await page.waitForTimeout(300);
  check("the phone's owner can edit or delete the partner's workout", (await page.getByRole('button', { name: 'Delete', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Edit', exact: true }).count()) === 1);
  await page.getByRole('button', { name: 'Repeat' }).click();
  await page.waitForTimeout(700);
  check('Repeat opens Log with the exercises, blank', (await page.getByRole('button', { name: /^Exercise: / }).count()) >= 5 && (await logBtn.isDisabled()));
  check('Repeat keeps the plan label', (await count('From routine:')) === 1);
  check('the plan saved from History is on the Log tab', (await page.getByRole('button', { name: 'Start from routine 0 - Test Plan' }).count()) === 1);

  await page.getByRole('button', { name: 'Start from routine 5 - Cardio + Rehab' }).click();
  await page.waitForTimeout(500);
  check('the typed note is now a saved note', (await count('Felt strong today')) >= 1);
  check('shows how the exercise went last time', (await count('Last time: 35min @ 6/10')) === 1);

  // Unfinished workouts survive closing and reopening the app.
  await page.getByLabel('time in minutes').first().fill('20');
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot('log-03-restored');
  check('stays signed in after reopening', (await count('Your lifting log.')) === 0);
  check('unfinished workout is restored with a banner', (await count('Unsaved workout restored')) === 1 && (await page.getByLabel('time in minutes').first().inputValue()) === '20');
  dialogs.length = 0;
  await page.getByRole('button', { name: 'Start from routine 1 - Upper A' }).click();
  await page.waitForTimeout(500);
  check('asks before replacing an unfinished workout', dialogs.some((d) => d.includes('unsaved workout')));

  await tab('History');
  // The list draws in batches: wait until it has stopped growing before counting.
  for (let seen = -1, now = await workouts().count(); now !== seen; ) {
    seen = now;
    await page.waitForTimeout(700);
    now = await workouts().count();
  }
  const total = await workouts().count();
  await workouts().first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(500);
  { const after = await workouts().count(); check('deleting asks first, then removes the workout', dialogs.some((d) => d.includes('Delete this workout')) && after === total - 1, `dialogs=${JSON.stringify(dialogs)} total=${total} after=${after}`); }
}

async function bodyStatsSettings({ page, shot, tab, count, dialogs, scroll, workouts }) {
  await tab('Body');
  await shot('body-01');
  await page.getByLabel('Weight in lbs', { exact: true }).fill('199.4');
  await page.getByRole('button', { name: 'LOG WEIGHT' }).click();
  await page.waitForTimeout(500);
  check('new weigh-in shows with the change since last', (await count('199.4')) >= 1 && (await count('-1.6 since last')) === 1);
  await page.getByRole('radio', { name: 'Show in kg' }).first().click();
  await page.waitForTimeout(300);
  check('switching to kg converts the weight', (await count('90.4')) >= 1);
  await page.getByRole('radio', { name: 'Show in lbs' }).first().click();
  await scroll(600);
  await page.getByRole('button', { name: /^Chest\./ }).click();
  await page.waitForTimeout(300);
  await page.getByLabel('Chest in in', { exact: true }).fill('43');
  await page.getByRole('button', { name: 'LOG CHEST' }).click();
  await page.waitForTimeout(500);
  await scroll(500);
  await shot('body-02-measurements');
  check('new measurement is counted in its history', (await count('Chest history (4)')) === 1);
  await scroll(-3000);
  check('Body is the owner only: no Together Mode there', (await page.getByRole('switch', { name: 'Together Mode' }).filter({ visible: true }).count()) === 0 && (await page.getByText('KEVIN', { exact: true }).filter({ visible: true }).count()) === 0, `switches=${await page.getByRole('switch', { name: 'Together Mode' }).filter({ visible: true }).count()} names=${await page.getByText('KEVIN', { exact: true }).filter({ visible: true }).count()}`);

  await tab('Log');
  await page.getByRole('switch', { name: 'Together Mode' }).click();
  await page.waitForTimeout(400);
  check('Together Mode on Log logs both', (await page.getByRole('button', { name: 'LOG BOTH WORKOUTS' }).count()) === 1);
  await page.getByRole('button', { name: 'Choose an exercise' }).click();
  await page.waitForTimeout(500);
  await shot('picker-01');
  await page.getByLabel('Search exercises').fill('Zercher Squat');
  await page.getByRole('button', { name: /Add "Zercher Squat" as a new exercise/ }).click();
  await page.waitForTimeout(600);
  check('a new exercise can be added from the search box', (await page.getByLabel('Exercise name').inputValue()) === 'Zercher Squat');
  await page.getByRole('radio', { name: 'Category: Legs' }).click();
  await page.getByLabel('Diego, set 1 reps').fill('5');
  await page.getByLabel('Diego, set 1 weight in lbs').fill('135');
  await page.getByLabel('Kevin, set 1 reps').fill('6');
  await page.getByLabel('Kevin, set 1 weight in lbs').fill('145');
  await shot('log-04-together');
  await page.getByRole('button', { name: 'LOG BOTH WORKOUTS' }).click();
  await page.waitForTimeout(800);
  await tab('History');
  const labels = await workouts().evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('aria-label')));
  check('Together Mode logs a workout for each person', labels.some((l) => l.includes('Diego') && l.includes('675 pounds')) && labels.some((l) => l.includes('Kevin') && l.includes('870 pounds')));

  await tab('Log');
  await page.getByRole('button', { name: 'Edit the exercise list' }).first().click();
  await page.waitForTimeout(700);
  await shot('manage-01');
  await page.getByLabel('Search exercises').fill('Zercher');
  await page.waitForTimeout(300);
  check('the new exercise is remembered on the list', (await page.getByRole('button', { name: 'Edit Zercher Squat' }).count()) === 1);
  await page.getByRole('button', { name: 'Edit Zercher Squat' }).click();
  await page.waitForTimeout(300);
  await page.getByLabel('Exercise name').last().fill('Zercher Squat (Barbell)');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(600);
  check('renaming asks first', dialogs.some((d) => d.includes('Rename "Zercher Squat"')));
  await page.getByLabel('Search exercises').fill('Wall Sit');
  await page.getByRole('button', { name: 'Remove Wall Sit' }).click();
  await page.waitForTimeout(500);
  check('a removed built-in exercise can be restored', (await page.getByRole('button', { name: 'Restore Wall Sit' }).count()) === 1);
  await page.getByRole('button', { name: 'Restore Wall Sit' }).click();
  await page.waitForTimeout(400);
  check('restore puts it back', (await page.getByRole('button', { name: 'Remove Wall Sit' }).count()) === 1);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  await tab('History');
  await workouts().first().click();
  await page.waitForTimeout(300);
  check('a rename follows through to past workouts', (await count('Zercher Squat (Barbell)')) >= 1);

  await tab('Stats');
  await shot('stats-01');
  check('Stats shows the total', (await count('TOTAL WORKOUTS LOGGED')) === 1);
  await scroll(900);
  await shot('stats-02-records');
  check('personal records include the new lift', (await count('Zercher Squat (Barbell)')) >= 1);

  await tab('Log');
  await page.getByRole('button', { name: 'Edit 5 - Cardio + Rehab routine' }).click();
  await page.waitForTimeout(700);
  await shot('plan-editor-01');
  await page.getByLabel('Routine name').fill('5 - Cardio + Rehab v2');
  await page.getByRole('button', { name: 'Move exercise down' }).first().click();
  await page.getByRole('button', { name: 'SAVE ROUTINE' }).click();
  await page.waitForTimeout(600);
  check('plans can be renamed and reordered', (await page.getByRole('button', { name: 'Start from routine 5 - Cardio + Rehab v2' }).count()) === 1);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await shot('settings-01');
  await page.getByRole('button', { name: '30s' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  const timer = page.getByRole('button', { name: /rest timer/i });
  check('rest length follows Settings', (await timer.getAttribute('aria-label')) === 'Start 30 second rest timer');
  await timer.click();
  await page.waitForTimeout(2300);
  check('rest timer counts down', /Rest timer, 2[78] seconds left/.test(await timer.getAttribute('aria-label')));

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Remove sample data' }).click();
  await page.waitForTimeout(600);
  check('sample data can be removed, keeping what was logged here', (await count('2 workouts ·')) === 1, await page.getByText(/workouts ·/).first().innerText().catch(() => ''));
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(400);

}

async function addExercise({ page, shot, names, count }) {
  await page.getByRole('button', { name: 'Choose an exercise' }).click();
  await page.waitForTimeout(500);
  check('the list offers "Add an exercise"', (await page.getByRole('button', { name: 'Add an exercise' }).count()) === 1);
  check('"Other (type your own)" is gone', (await count('Other (type your own)')) === 0);
  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('Exercise name').fill('Sled Push');
  await page.getByRole('radio', { name: 'Category: Legs' }).click();
  await shot('add-01-typed');
  check('a typed exercise gets the stand-in picture', (await page.locator('img').count()) >= 1);
  await page.getByRole('button', { name: 'Save to my list' }).click();
  await page.waitForTimeout(800);
  await shot('add-02-saved');
  check('"Save to my list" keeps it on the card', (await names())[0] === 'Sled Push');
  await page.getByRole('button', { name: /^Exercise: Sled Push/ }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Search exercises').fill('Sled');
  await page.waitForTimeout(300);
  await shot('add-03-on-list');
  check('it is on the list before any workout is logged', (await page.getByRole('button', { name: 'Sled Push', exact: true }).count()) === 1);
  check('a saved name is not offered as new again', (await page.getByRole('button', { name: /Add "Sled" as a new exercise/ }).count()) === 1 && (await page.getByRole('button', { name: /Add "Sled Push"/ }).count()) === 0);
}

async function signInFlow({ page, shot, count, dialogs }) {
  const email = 'sign-in@example.com';
  await shot('signin-01-start');
  check('the first screen is the sign-in, with no names on it', (await count('Your lifting log.')) === 1 && (await count('Diego')) === 0 && (await count('Kevin')) === 0);
  await page.getByRole('button', { name: 'Continue with Apple' }).click();
  check('Apple says it is coming soon', (await count('Apple sign-in is coming soon')) === 1);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  check('Google says it is coming soon', (await count('Google sign-in is coming soon')) === 1);
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByRole('button', { name: 'EMAIL ME A CODE' }).click();
  check('a bad email is caught', (await count('Enter your email address')) === 1);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'EMAIL ME A CODE' }).click();
  const line = await page.getByText(/Test build: your code is \d{6}/).innerText();
  const code = line.match(/\d{6}/)[0];
  await shot('signin-02-code');
  check('the code screen names the email', (await count(email)) >= 1);
  await page.getByLabel('6-digit code').fill(code === '000000' ? '111111' : '000000');
  await page.getByText("That code isn't right").waitFor();
  check('a wrong code is refused', true);
  await page.getByLabel('6-digit code').fill('');
  await page.getByLabel('6-digit code').fill(code);
  await page.getByText('Welcome!').waitFor();
  await shot('signin-03-setup');
  check('the right code leads to the first-time setup', true);

  await page.getByRole('button', { name: 'START LOGGING' }).click();
  check('setup asks for a name', (await count('Type your first name.')) === 1);
  await page.getByRole('radio', { name: 'Kilos' }).click();
  await firstTimeSetup(page, 'Sam');
  await page.getByRole('tab', { name: 'Log' }).waitFor();
  await page.waitForTimeout(500);
  await shot('signin-03b-first-log');
  check('after setup the app opens straight to Log, with no "who is lifting" screen', (await count("Who's lifting today?")) === 0 && (await count('Diego')) === 0 && (await count('Kevin')) === 0);
  check('a new customer sees a one-person app', (await page.getByRole('switch', { name: 'Together Mode' }).count()) === 0 && (await page.getByRole('button', { name: /Switch/ }).count()) === 0 && (await page.getByRole('button', { name: 'LOG WORKOUT' }).count()) === 1);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(500);
  await shot('signin-03c-first-history');
  check('a new customer starts with nothing logged', (await count('No workouts logged yet.')) === 1);
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);

  // The partner option: off by default, switched on in Settings.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('switch', { name: 'Lift with a partner' }).click();
  await page.getByLabel("Partner's first name").fill('Kim');
  await shot('signin-03d-partner-setting');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('switch', { name: 'Together Mode' }).click();
  await page.waitForTimeout(400);
  await shot('signin-03e-together');
  check('with a partner switched on, Together Mode logs both by name', (await page.getByRole('button', { name: 'LOG BOTH WORKOUTS' }).count()) === 1 && (await page.getByLabel('Sam, set 1 reps').count()) === 1 && (await page.getByLabel('Kim, set 1 reps').count()) === 1);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('switch', { name: 'Lift with a partner' }).click();
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  check('switching the partner off makes it a one-person app again', (await page.getByRole('switch', { name: 'Together Mode' }).count()) === 0 && (await page.getByRole('button', { name: 'LOG WORKOUT' }).count()) === 1);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(900);
  check('sample data for one person names nobody', (await page.getByRole('button', { name: /exercises, .* sets/ }).count()) > 0 && (await count('Everyone')) === 0 && (await count('Kevin')) === 0 && (await count('Partner')) === 0);
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  check('Settings shows who is signed in', (await count(`Signed in as Sam, ${email}`)) === 1);
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  await shot('signin-04-settings-account');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('closing and reopening the app stays signed in', (await count('Your lifting log.')) === 0 && (await page.getByRole('tab', { name: 'Log' }).count()) === 1);
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.waitForTimeout(500);
  check('the kilos choice from setup is kept', (await page.getByLabel('Weight in kg', { exact: true }).count()) === 1);
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByText('Your lifting log.').waitFor();
  check('Sign out asks first, then returns to the sign-in', dialogs.some((d) => d.includes('Sign out?')));

  await page.waitForTimeout(400);
  await signIn(page, email);
  await page.getByRole('tab', { name: 'Log' }).waitFor();
  // Free keeps 3 saved plans (the sample data arrives with 5).
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(900);
  const firstWorkout = page.getByRole('button', { name: /exercises, .* sets/ }).first();
  const plansNow = () => page.getByRole('button', { name: /^Start from routine / }).count();
  await firstWorkout.click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Save as Routine' }).click();
  await page.waitForTimeout(400);
  check('free: a 4th plan is refused, with the reason', dialogs.some((d) => d.includes('The free version keeps 3 saved routines')) && (await page.getByLabel('Name this routine').count()) === 0);
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);
  for (const plan of ['1 - Upper A', '2 - Lower A', '3 - Upper B']) {
    await page.getByRole('button', { name: `Delete ${plan} routine` }).click();
    await page.waitForTimeout(400);
  }
  check('plans can be deleted to make room', (await plansNow()) === 2);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Save as Routine' }).click();
  await page.getByLabel('Name this routine').fill('My third plan');
  await page.getByRole('button', { name: 'SAVE ROUTINE' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Save as Routine' }).click();
  await page.waitForTimeout(400);
  const refusedAgain = (await page.getByLabel('Name this routine').count()) === 0;
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);
  check('free: the 3rd plan saves and the next is refused', (await plansNow()) === 3 && refusedAgain, `plans=${await plansNow()} refused=${refusedAgain}`);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.getByRole('switch', { name: 'Pro unlocked' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Save as Routine' }).click();
  await page.getByLabel('Name this routine').fill('A fourth plan');
  await page.getByRole('button', { name: 'SAVE ROUTINE' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: 'Log' }).click();
  await page.waitForTimeout(400);
  check('Pro: no limit on plans', (await plansNow()) === 4, `plans=${await plansNow()}`);

  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(900);
  check('signing in again skips setup and keeps the workouts on the phone', (await count('Welcome!')) === 0 && (await page.getByRole('button', { name: /exercises, .* sets/ }).count()) > 0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByText('Your lifting log.').waitFor();
  check('Delete my account asks first, then returns to the sign-in', dialogs.some((d) => d.includes('Delete your account?')));

  await page.waitForTimeout(400);
  await signIn(page, email);
  await page.getByText('Welcome!').waitFor();
  check('after deleting, the same email starts a brand new account', true);
  await firstTimeSetup(page, 'Sam');
  await page.getByRole('tab', { name: 'Log' }).waitFor();
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(500);
  check('deleting the account erased the workouts on the phone', (await page.getByRole('button', { name: /exercises, .* sets/ }).count()) === 0);
}

// Stats: one exercise over time (free for 3 months) and the Pro charts.
async function progress({ page, shot, tab, count, dialogs, scroll }) {
  const openSettings = async () => { await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(500); await page.mouse.move(195, 420); await page.mouse.wheel(0, 3000); await page.waitForTimeout(300); };
  const done = async () => { await page.getByRole('button', { name: 'Done' }).click(); await page.waitForTimeout(500); };
  await tab('Stats');
  check('with nothing logged, Stats has no progress section yet', (await count('Exercise Progress')) === 0);
  await openSettings();
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await done();
  await tab('Stats');
  await scroll(700);
  await shot('progress-01-free');
  const chart = (what) => page.getByRole('img', { name: new RegExp(`^${what} on .* over `) });
  check('free: one exercise charted over the last 3 months', (await chart('Top weight').count()) === 1 && /over the last 3 months/.test(await chart('Top weight').getAttribute('aria-label')));
  check('free: says what Pro adds', (await count('MORE WITH PRO')) === 1 && (await page.getByText('SETS BY BODY PART', { exact: true }).count()) === 0);
  dialogs.length = 0;
  await page.getByRole('button', { name: '1Y', exact: true }).click();
  await page.getByRole('button', { name: 'Est. 1-rep max (Pro)' }).click();
  await page.waitForTimeout(300);
  check('free: other ranges and one-rep max explain they are Pro', dialogs.length === 2 && dialogs.every((d) => d.includes('Part of Pro')) && (await chart('Top weight').count()) === 1, JSON.stringify(dialogs));
  const firstLabel = await page.getByRole('button', { name: /^Progress for / }).getAttribute('aria-label');
  await page.getByRole('button', { name: /^Progress for / }).click();
  await page.waitForTimeout(500);
  await shot('progress-02-choose');
  await page.getByRole('button', { name: /, logged \d+ times?$/ }).nth(3).click();
  await page.waitForTimeout(500);
  check('another exercise can be picked', (await page.getByRole('button', { name: /^Progress for / }).getAttribute('aria-label')) !== firstLabel);

  await scroll(-3000);
  await openSettings();
  await page.getByRole('switch', { name: 'Pro unlocked' }).click();
  await done();
  await scroll(700);
  dialogs.length = 0;
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Est. 1-rep max', exact: true }).click();
  await page.waitForTimeout(400);
  check('Pro: all-time range and estimated one-rep max', dialogs.length === 0 && (await chart('Estimated one-rep max').count()) === 1 && /over all time/.test(await chart('Estimated one-rep max').getAttribute('aria-label')));
  await scroll(500);
  await shot('progress-03-pro');
  check('Pro: sets by body part and consistency', (await page.getByText('SETS BY BODY PART', { exact: true }).count()) === 1 && (await count('CONSISTENCY')) === 1 && (await count('MORE WITH PRO')) === 0 && (await page.getByLabel(/sets this week, usually/).count()) >= 3 && (await count('weeks in a row')) === 1);
}

// Two "phones" on one account: what is logged on the first shows up on the second.
async function backup(browser) {
  console.log('\n== backup ==');
  const email = 'backup@example.com';
  const phone = async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    return { ctx, page };
  };
  const workouts = (page) => page.getByRole('button', { name: /exercises, .* sets/ });
  // "20 workouts · 6 weigh-ins · 18 measurements · 5 plans", read from Settings once saved.
  const tally = async (page) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByText('Saved to your account').first().waitFor({ timeout: 15000 });
    const text = (await page.getByText(/\d+ workouts ·/).first().innerText()).replace(/\s+/g, ' ');
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(400);
    return text;
  };
  try {
    const a = await phone();
    await signIn(a.page, email);
    await firstTimeSetup(a.page, 'Sam');
    await a.page.getByRole('tab', { name: 'Log' }).waitFor();
    await a.page.getByRole('button', { name: 'Settings' }).click();
    await a.page.waitForTimeout(500);
    a.page.on('dialog', (d) => d.accept());
    await a.page.getByRole('button', { name: 'Load sample data' }).click();
    await a.page.getByRole('button', { name: 'Done' }).click();
    // The save goes out a few seconds after a change.
    await a.page.waitForTimeout(4500);
    await a.page.getByRole('button', { name: 'Settings' }).click();
    await a.page.getByText('Saved to your account just now.').waitFor({ timeout: 15000 });
    await a.page.mouse.move(195, 420);
    await a.page.mouse.wheel(0, 900);
    await a.page.waitForTimeout(400);
    await a.page.screenshot({ path: path.join(shots, 'backup-01-saved.png') });
    check('Settings says the workouts are saved to the account', true);
    await a.page.getByRole('button', { name: 'Done' }).click();
    const onFirst = await tally(a.page);

    const b = await phone();
    b.page.on('dialog', (d) => d.accept());
    await signIn(b.page, email);
    await b.page.getByRole('tab', { name: 'Log' }).waitFor();
    await b.page.getByRole('tab', { name: 'History' }).click();
    await workouts(b.page).first().waitFor({ timeout: 15000 });
    await b.page.screenshot({ path: path.join(shots, 'backup-02-second-phone.png') });
    const onSecond = await tally(b.page);
    check('signing in on a second phone brings everything back', /^[1-9]\d* workouts/.test(onFirst) && onSecond === onFirst, `first="${onFirst}" second="${onSecond}"`);

    // Delete one on the second phone; the first phone catches up when it reopens.
    await workouts(b.page).first().click();
    await b.page.waitForTimeout(300);
    await b.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await b.page.waitForTimeout(4500);
    const afterDelete = await tally(b.page);
    await a.page.reload({ waitUntil: 'networkidle' });
    await a.page.waitForTimeout(2500);
    const firstAgain = await tally(a.page);
    check('a change on one phone reaches the other', afterDelete !== onFirst && firstAgain === afterDelete, `second="${afterDelete}" first="${firstAgain}"`);
    await a.ctx.close();
    await b.ctx.close();
  } catch (e) {
    check('backup: ran to the end', false, e.message.split('\n')[0]);
  }
}

(async () => {
  const accounts = await serveAccounts();
  const server = await serve();
  const browser = await chromium.launch();
  await scenario(browser, 'sign-in', signInFlow);
  await scenario(browser, 'reorder', reorder);
  await scenario(browser, 'log-history', logAndHistory);
  await scenario(browser, 'body-stats-settings', bodyStatsSettings);
  await scenario(browser, 'add-exercise', addExercise);
  await scenario(browser, 'progress', progress);
  await backup(browser);
  await browser.close();
  server.close();
  accounts.kill();
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
