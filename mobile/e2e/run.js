// Taps through the whole app in a headless browser and checks the results.
// Usage: node e2e/run.js <folder made by "expo export --platform web"> [port]
// The export must be built with EXPO_PUBLIC_API_URL=http://localhost:8791
// (this script starts the test accounts server, ../mobile-api, on that port)
// and EXPO_PUBLIC_TEST_BUILD=1, so the test-only Settings card is there.
// Add "store" after the port to check an export built WITHOUT
// EXPO_PUBLIC_TEST_BUILD instead: the App Store build, with no test tools.
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
  // A "See Pro" offer gets "Not now" unless a check asks for the Go Pro screen.
  const pro = { acceptOffers: false };
  // The sign-in scenario types a wrong code on purpose; the browser logs the server's "no".
  const expected = (text) => name === 'sign-in' && text.includes('status of 400');
  page.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  const isProOffer = (text) => /Part of Pro|The free version keeps/.test(text);
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    if (isProOffer(d.message()) && !pro.acceptOffers) d.dismiss();
    else d.accept();
  });
  const t = {
    page,
    dialogs,
    pro,
    shot: (n) => page.screenshot({ path: path.join(shots, `${n}.png`) }),
    tab: async (label) => { await page.getByRole('tab', { name: label }).click(); await page.waitForTimeout(500); },
    count: (text) => page.getByText(text, { exact: false }).count(),
    scroll: async (dy) => { await page.mouse.move(195, 420); await page.mouse.wheel(0, dy); await page.waitForTimeout(350); },
    names: () => page.getByRole('button', { name: /^Exercise: / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/^Exercise: (.*)\. Tap to change\.$/, '$1'))),
    workouts: () => page.getByRole('button', { name: /exercises?, .* sets?/ }),
  };
  await page.goto(URL, { waitUntil: 'networkidle' });
  try {
    if (name !== 'sign-in') {
      await signIn(page, `${name}@example.com`);
      await firstTimeSetup(page, 'Diego');
      await page.getByRole('tab', { name: 'Log' }).waitFor();
      if (!['progress', 'transfer', 'go-pro', 'store-build'].includes(name)) await partnerAndSampleData(page);
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

  // The count ring and the set checks.
  const strip = page.getByLabel(/of 7 exercises done/);
  check('the ring starts at 0 of 7 and names what is now and next', /^0 of 7 exercises done\. Now: Bench Press\. Next: /.test(await strip.getAttribute('aria-label')), await strip.getAttribute('aria-label'));
  // Checking off a set starts the rest timer, unless Settings says not to.
  const restTimer = page.getByRole('button', { name: /rest timer/i });
  const restSwitch = async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(500);
    await page.getByLabel('Start rest when I check off a set').click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(500);
  };
  await restSwitch();
  await page.getByRole('checkbox', { name: 'set 1 done' }).first().click();
  await page.waitForTimeout(300);
  check('with the setting off, a check does not start the rest timer', /^Start \d+ second rest timer$/.test(await restTimer.getAttribute('aria-label')), await restTimer.getAttribute('aria-label'));
  await page.getByRole('checkbox', { name: 'set 1 done' }).first().click();
  await restSwitch();
  for (let i = 0; i < 3; i++) await page.getByRole('checkbox', { name: `set ${i + 1} done` }).first().click();
  await page.waitForTimeout(300);
  await shot('ring-01');
  check('checking off a set starts the rest timer', /^Rest timer, \d+ seconds left/.test(await restTimer.getAttribute('aria-label')), await restTimer.getAttribute('aria-label'));
  check('checking off every set of an exercise moves the ring on', /^1 of 7 exercises done\./.test(await strip.getAttribute('aria-label')) && !/Now: Bench Press/.test(await strip.getAttribute('aria-label')), await strip.getAttribute('aria-label'));
  await page.getByRole('checkbox', { name: 'set 1 done' }).first().click();
  await page.waitForTimeout(300);
  check('a check can be taken back', /^0 of 7 exercises done\./.test(await strip.getAttribute('aria-label')));

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
  check('no Google button for the iPhone launch', (await page.getByRole('button', { name: 'Continue with Google' }).count()) === 0);
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

  // Routines for a new customer: starters, and building one from scratch.
  const routine = (name) => page.getByRole('button', { name: `Start from routine ${name}` });
  check('a new customer is told what a routine is and offered two ways to get one', (await count('No routines yet')) === 1);
  await page.getByRole('button', { name: 'Starter routines' }).click();
  await page.waitForTimeout(500);
  await shot('routines-01-starters');
  await page.getByRole('button', { name: 'Add Upper A' }).click();
  await page.getByRole('button', { name: 'Add Lower A' }).click();
  await page.waitForTimeout(400);
  check('an added starter is marked as added', (await page.getByRole('button', { name: 'Upper A added' }).count()) === 1);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  check('starter routines appear on Log', (await routine('Upper A').count()) === 1 && (await routine('Lower A').count()) === 1 && (await count('No routines yet')) === 0);
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Routine name').fill('Push day');
  await page.getByRole('button', { name: 'Choose an exercise' }).last().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Shoulder Press', exact: true }).click();
  await page.waitForTimeout(500);
  await shot('routines-02-new');
  await page.getByRole('button', { name: 'SAVE ROUTINE' }).click();
  await page.waitForTimeout(600);
  check('a routine can be built from scratch', (await routine('Push day').count()) === 1);
  await routine('Push day').click();
  await page.waitForTimeout(500);
  check('the new routine loads its exercise', (await page.getByRole('button', { name: /^Exercise: Shoulder Press/ }).count()) === 1);
  dialogs.length = 0;
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.waitForTimeout(400);
  check('free: a 4th routine from scratch is refused, with the reason', dialogs.some((d) => d.includes('The free version keeps 3 saved routines')) && (await page.getByLabel('Routine name').count()) === 0);

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
  check('sample data for one person names nobody', (await page.getByRole('button', { name: /exercises?, .* sets?/ }).count()) > 0 && (await count('Everyone')) === 0 && (await count('Kevin')) === 0 && (await count('Partner')) === 0);
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
  const firstWorkout = page.getByRole('button', { name: /exercises?, .* sets?/ }).first();
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
  check('signing in again skips setup and keeps the workouts on the phone', (await count('Welcome!')) === 0 && (await page.getByRole('button', { name: /exercises?, .* sets?/ }).count()) > 0);

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
  check('deleting the account erased the workouts on the phone', (await page.getByRole('button', { name: /exercises?, .* sets?/ }).count()) === 0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.getByLabel('Your first name').fill('Samuel');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByText(`Signed in as Samuel, ${email}`).waitFor({ timeout: 10000 });
  check('the first name can be changed in Settings', true);
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

// The Go Pro screen: what Pro adds, the prices, and the buy button (not wired yet).
async function goPro({ page, shot, tab, count, pro, scroll }) {
  const settings = async () => { await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(600); };
  const sheetOpen = () => count('Everything free stays free. Pro adds:');
  const closePro = async () => { await page.getByRole('button', { name: 'Close', exact: true }).last().click(); await page.waitForTimeout(500); };

  await settings();
  check('Settings opens with the Pro card and what free includes', (await count('FLEX DADDIES PRO')) === 1 && (await count('Free: unlimited logging, your full history and 3 saved routines.')) === 1);
  check('a test build shows the test-only card', (await count('TEST BUILD ONLY')) === 1 && (await count('· test build')) === 1);
  await page.getByRole('button', { name: 'See what Pro adds' }).click();
  await page.waitForTimeout(600);
  await shot('gopro-01-monthly');
  check('Go Pro lists the six things Pro adds', (await sheetOpen()) === 1 && (await count('Unlimited routines')) === 1 && (await count('Your whole history on every chart')) === 1 && (await count('Estimated one-rep max')) === 1 && (await count('Sets by body part')) === 1 && (await count('Consistency')) === 1 && (await count('Partner sync')) === 1);
  check('monthly: $0.99 the first month, then $2.99 a month', (await count('$0.99 your first month')) === 1 && (await count('Then $2.99 a month. Try it for a month')) === 1 && (await page.getByRole('button', { name: 'Start Pro for $0.99' }).count()) === 1);
  check('yearly: $25.99 a year, about $2.17 a month, save 27%', (await count('$25.99 a year')) >= 1 && (await count('About $2.17 a month. Save 27% over paying monthly.')) === 1 && (await page.getByText('SAVE 27%', { exact: true }).count()) === 1);
  check('no lifetime option', (await count('lifetime')) === 0 && (await count('Lifetime')) === 0);
  check('monthly is picked to start', (await page.getByRole('radio', { name: /^Monthly/ }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('radio', { name: /^Yearly/ }).click();
  await page.waitForTimeout(300);
  check('picking yearly changes the button', (await page.getByRole('radio', { name: /^Yearly/ }).getAttribute('aria-checked')) === 'true' && (await page.getByRole('button', { name: 'Go Pro for $25.99 a year' }).count()) === 1);
  await page.getByRole('button', { name: 'Go Pro for $25.99 a year' }).click();
  await page.waitForTimeout(300);
  await scroll(1500);
  await shot('gopro-02-yearly-pressed');
  check('the buy button is not wired: it says so and charges nothing', (await count('Buying opens when Flex Daddies is in the App Store. Nothing was charged.')) === 1);
  check('the fine print says how it renews and how to cancel', (await count('Pro renews automatically')) === 1 && (await count('Terms of Use · Privacy Policy')) === 1 && (await page.getByRole('button', { name: 'Restore a purchase' }).count()) === 1);
  await closePro();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);

  // From Stats: the locked card's button, and a "Part of Pro" message.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  await tab('Body');
  check('Body shows only your own weigh-ins when no partner is set up', (await count('Weigh-Ins')) === 1 && (await count("Partner's Weigh-Ins")) === 0);
  await tab('Stats');
  await scroll(1500);
  await page.getByRole('button', { name: 'See Pro' }).click();
  await page.waitForTimeout(600);
  check('Stats: the locked Pro card opens Go Pro', (await sheetOpen()) === 1);
  await closePro();
  pro.acceptOffers = true;
  await scroll(-600);
  await page.getByRole('button', { name: '1Y', exact: true }).click();
  await page.waitForTimeout(600);
  check('a "Part of Pro" message offers Go Pro', (await sheetOpen()) === 1);
  await closePro();
  pro.acceptOffers = false;

  // With Pro on, the screen says so and shows no prices.
  await scroll(-3000);
  await settings();
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.getByRole('switch', { name: 'Pro unlocked' }).click();
  await page.mouse.wheel(0, -6000);
  await page.waitForTimeout(400);
  check('Settings with Pro on', (await count('Pro is on. Thank you.')) === 1);
  await page.getByRole('button', { name: 'What Pro includes' }).click();
  await page.waitForTimeout(600);
  await shot('gopro-03-pro-on');
  check('Go Pro with Pro on: no prices, how to cancel', (await count('Pro is on. Here is everything it adds.')) === 1 && (await count('$2.99')) === 0 && (await count('Subscriptions')) === 1);
}

// The App Store build (exported without EXPO_PUBLIC_TEST_BUILD): no test tools.
async function storeBuild({ page, count, shot }) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  await shot('store-01-settings');
  check('store build: no test-only card, no Pro switch, no sample data', (await count('TEST BUILD ONLY')) === 0 && (await page.getByRole('switch', { name: 'Pro unlocked' }).count()) === 0 && (await page.getByRole('button', { name: 'Load sample data' }).count()) === 0);
  check('store build: the version line does not say test build', (await count('test build')) === 0 && (await count('Flex Daddies 1.0.0')) === 1);
  check('store build: Pro and the account are still there', (await count('FLEX DADDIES PRO')) === 1 && (await page.getByRole('button', { name: 'Delete my account' }).count()) === 1);
}

// Bring a history in from Hevy or Strong, and export it again.
async function transfer({ page, shot, tab, count, workouts }) {
  const fixture = (name) => path.join(__dirname, 'fixtures', name);
  const choose = async (label, file) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: label }).click();
    await (await chooser).setFiles(fixture(file));
    await page.waitForTimeout(700);
  };
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Bring in workouts from Hevy or Strong' }).click();
  await page.waitForTimeout(500);
  await shot('transfer-01-start');
  await choose('Choose the file', 'not-workouts.csv');
  check('a file that is not a workout export is refused, with what to do', (await count('is not a workout export from Hevy or Strong')) === 1);
  await choose('Choose the file', 'hevy.csv');
  await shot('transfer-02-found');
  check('a Hevy file is read and summed up before anything is added', (await count('2 workouts found')) === 1 && (await count('2 exercises match ours')) === 1 && (await count('Zercher Squat (Barbell)')) === 1);
  await page.getByRole('button', { name: 'ADD 2 WORKOUTS' }).click();
  await page.waitForTimeout(700);
  check('the workouts are added', (await count('2 workouts added.')) === 1);
  await choose('Choose another file', 'hevy.csv');
  await page.getByRole('button', { name: 'ADD 2 WORKOUTS' }).click();
  await page.waitForTimeout(700);
  check('the same file a second time adds nothing', (await count('0 workouts added.')) === 1 && (await count('2 were already here')) === 1);
  await choose('Choose another file', 'strong.csv');
  check('a Strong file asks whether its weights are lbs or kg', (await count('1 workout found')) === 1 && (await count('Weights in this file are in')) === 1);
  await page.getByRole('radio', { name: 'Show in kg' }).last().click();
  await page.getByRole('button', { name: 'ADD 1 WORKOUT' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Done' }).last().click();
  await page.waitForTimeout(500);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my workouts' }).click();
  const saved = await (await download).path();
  const csv = fs.readFileSync(saved, 'utf8');
  check('Export writes every set to a file', csv.startsWith('title,start_time') && csv.includes('Bench Press (Barbell)') && csv.split('\n').length === 8 && (await count('3 workouts written to flex-daddies-workouts.csv')) === 1, `lines=${csv.split('\n').length}`);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);

  await tab('History');
  await page.waitForTimeout(800);
  await shot('transfer-03-history');
  check('the imported workouts are in History', (await workouts().count()) === 3);
  await workouts().nth(2).click();
  await page.waitForTimeout(400);
  check('kilos from Strong were turned into pounds', (await count('8 reps × 132.28 lbs')) === 1);

  // Lifting in kilos: one switch in Settings changes every weight on screen.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Show in kg' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(500);
  await tab('History');
  await page.waitForTimeout(600);
  await shot('transfer-04-kilos');
  check('in kilos, History shows the same lifts in kg', (await count('8 reps × 60 kg')) === 1 && (await count('6 reps × 62.5 kg')) === 1 && (await count('kg moved')) >= 1 && (await count('lbs moved')) === 0);
  await tab('Log');
  check('in kilos, sets are typed in kg', (await count('WEIGHT (KG)')) >= 1 && (await page.getByLabel('set 1 weight in kg').count()) === 1);
  await page.getByRole('button', { name: 'Choose an exercise' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Search exercises').fill('Zercher Squat (Barbell)');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Zercher Squat (Barbell)', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('set 1 reps').fill('5');
  await page.getByLabel('set 1 weight in kg').fill('100');
  await page.getByRole('button', { name: 'LOG WORKOUT' }).click();
  await page.waitForTimeout(800);
  await tab('History');
  await page.waitForTimeout(600);
  await workouts().first().click();
  await page.waitForTimeout(400);
  check('a lift typed in kilos reads back as the same kilos', (await count('5 reps × 100 kg')) === 1);
  await tab('Stats');
  await page.waitForTimeout(600);
  check('imported lifts count in the records', (await count('Bench Press · Barbell')) >= 1);
}

// Partner sync (Pro): two accounts on two "phones" link with a code; a session
// one logs for both shows up on the other.
async function partnerSync(browser) {
  console.log('\n== partner-sync ==');
  const phone = async (email, name) => {
    const ctx = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.goto(URL, { waitUntil: 'networkidle' });
    await signIn(page, email);
    await firstTimeSetup(page, name);
    await page.getByRole('tab', { name: 'Log' }).waitFor();
    return { ctx, page };
  };
  const settings = async (page) => { await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(500); };
  const done = async (page) => { await page.getByRole('button', { name: 'Done' }).click(); await page.waitForTimeout(500); };
  const partnerOn = async (page, pro) => {
    await settings(page);
    await page.getByRole('switch', { name: 'Lift with a partner' }).click();
    if (pro) {
      await page.mouse.move(195, 420);
      await page.mouse.wheel(0, 3000);
      await page.getByRole('switch', { name: 'Pro unlocked' }).click();
      await page.mouse.wheel(0, -3000);
      await page.waitForTimeout(300);
    }
  };
  try {
    const sam = await phone('sync-sam@example.com', 'Sam');
    const kim = await phone('sync-kim@example.com', 'Kim');
    await partnerOn(sam.page, false);
    check('free: linking phones is shown as part of Pro', (await sam.page.getByText("Link your partner's phone (Pro)").count()) === 1 && (await sam.page.getByRole('button', { name: 'Get an invite code' }).count()) === 0);
    await done(sam.page);
    await partnerOn(sam.page, false); // off again
    await done(sam.page);
    await partnerOn(sam.page, true);
    await partnerOn(kim.page, true);

    await sam.page.getByRole('button', { name: 'Get an invite code' }).click();
    const label = await sam.page.getByLabel(/^Invite code /).getAttribute('aria-label');
    const code = label.replace(/\D/g, '');
    await sam.page.screenshot({ path: path.join(shots, 'partner-01-code.png') });
    check('one phone gets a 6-digit invite code', code.length === 6);

    await kim.page.getByRole('button', { name: 'Enter a code' }).click();
    await kim.page.getByLabel("Partner's invite code").fill('000000' === code ? '111111' : '000000');
    await kim.page.getByRole('button', { name: 'Link', exact: true }).click();
    await kim.page.getByText("That code isn't right").waitFor();
    await kim.page.getByLabel("Partner's invite code").fill(code);
    await kim.page.getByRole('button', { name: 'Link', exact: true }).click();
    await kim.page.getByText('Linked with Sam').waitFor();
    await kim.page.screenshot({ path: path.join(shots, 'partner-02-linked.png') });
    check('the other phone types it in and is linked, after a wrong code is refused', true);
    check("the partner's name is filled in from their account", (await kim.page.getByLabel("Partner's first name").inputValue()) === 'Sam');
    await sam.page.getByText('Linked with Kim').waitFor({ timeout: 15000 });
    check('the first phone shows the link by itself', true);
    await done(sam.page);
    await done(kim.page);

    // Sam logs a session for both.
    await sam.page.getByRole('switch', { name: 'Together Mode' }).click();
    await sam.page.getByRole('button', { name: 'Choose an exercise' }).click();
    await sam.page.waitForTimeout(500);
    await sam.page.getByLabel('Search exercises').fill('Zercher Squat');
    await sam.page.getByRole('button', { name: /Add "Zercher Squat" as a new exercise/ }).click();
    await sam.page.waitForTimeout(600);
    await sam.page.getByLabel('Sam, set 1 reps').fill('5');
    await sam.page.getByLabel('Sam, set 1 weight in lbs').fill('135');
    await sam.page.getByLabel('Kim, set 1 reps').fill('6');
    await sam.page.getByLabel('Kim, set 1 weight in lbs').fill('145');
    await sam.page.getByRole('button', { name: 'LOG BOTH WORKOUTS' }).click();
    await sam.page.waitForTimeout(2500);

    await kim.page.reload({ waitUntil: 'networkidle' });
    await kim.page.getByRole('tab', { name: 'History' }).click();
    const rows = kim.page.getByRole('button', { name: /exercises?, .* sets?/ });
    await rows.first().waitFor({ timeout: 15000 });
    await kim.page.waitForTimeout(800);
    await kim.page.screenshot({ path: path.join(shots, 'partner-03-received.png') });
    const labels = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    check("the session shows up on the partner's phone, each person's sets under the right name", labels.length === 2 && labels.some((l) => l.includes(', Kim,') && l.includes('870 pounds')) && labels.some((l) => l.includes(', Sam,') && l.includes('675 pounds')), JSON.stringify(labels));
    await kim.page.reload({ waitUntil: 'networkidle' });
    await kim.page.getByRole('tab', { name: 'History' }).click();
    await kim.page.waitForTimeout(2500);
    check('it arrives once, not again on the next open', (await rows.count()) === 2);

    await settings(kim.page);
    await kim.page.getByRole('button', { name: 'Unlink phones' }).click();
    await kim.page.getByRole('button', { name: 'Get an invite code' }).waitFor();
    await sam.page.reload({ waitUntil: 'networkidle' });
    await settings(sam.page);
    await sam.page.getByRole('button', { name: 'Get an invite code' }).waitFor({ timeout: 15000 });
    check('unlinking on one phone unlinks both, and the workouts stay', (await rows.count()) === 2);
    await sam.ctx.close();
    await kim.ctx.close();
  } catch (e) {
    check('partner-sync: ran to the end', false, e.message.split('\n')[0]);
  }
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
  const workouts = (page) => page.getByRole('button', { name: /exercises?, .* sets?/ });
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
    await a.page.getByRole('radio', { name: 'Show in kg' }).click();
    await a.page.getByRole('radio', { name: 'Show in cm' }).click();
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
    await b.page.getByRole('tab', { name: 'Log' }).click();
    await b.page.waitForTimeout(500);
    const kilosCameToo = (await b.page.getByLabel('set 1 weight in kg').count()) === 1;
    await b.page.getByRole('tab', { name: 'Body' }).click();
    await b.page.waitForTimeout(500);
    check('the settings come with the account too (kilos and centimeters)', kilosCameToo && (await b.page.getByText('cm', { exact: false }).count()) > 0 && (await b.page.getByLabel('Weight in kg', { exact: true }).count()) === 1);
    check('signing in on a second phone brings everything back', /^[1-9]\d* workouts/.test(onFirst) && onSecond === onFirst, `first="${onFirst}" second="${onSecond}"`);

    // Delete one on the second phone; the first phone catches up when it reopens.
    await b.page.getByRole('tab', { name: 'History' }).click();
    await b.page.waitForTimeout(600);
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
  if (process.argv[4] === 'store') {
    await scenario(browser, 'store-build', storeBuild);
  } else {
  await scenario(browser, 'sign-in', signInFlow);
  await scenario(browser, 'reorder', reorder);
  await scenario(browser, 'log-history', logAndHistory);
  await scenario(browser, 'body-stats-settings', bodyStatsSettings);
  await scenario(browser, 'add-exercise', addExercise);
  await scenario(browser, 'progress', progress);
  await scenario(browser, 'transfer', transfer);
  await backup(browser);
  await partnerSync(browser);
  await scenario(browser, 'go-pro', goPro);
  }
  await browser.close();
  server.close();
  accounts.kill();
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
