// Taps through the whole app in a headless browser and checks the results.
// Usage: node e2e/run.js <folder made by "expo export --platform web"> [port]
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium, devices } = require('playwright');

const root = path.resolve(process.argv[2] || 'dist-web');
const port = Number(process.argv[3] || 4173);
const URL = `http://localhost:${port}/`;
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

// Each scenario gets a brand new "phone" (empty storage, so the sample data is loaded fresh).
async function scenario(browser, name, body) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
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
  await t.shot(`${name}-00-profile`);
  await page.getByRole('button', { name: 'Continue as Diego' }).click();
  await page.waitForTimeout(600);
  try {
    await body(t);
  } catch (e) {
    check(`${name}: ran to the end`, false, e.message.split('\n')[0]);
    await t.shot(`${name}-crash`);
  }
  check(`${name}: no errors in the browser console`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function reorder({ page, shot, names, scroll }) {
  await page.getByRole('button', { name: 'Start from plan 1 - Upper A' }).click();
  await page.waitForTimeout(600);
  const start = await names();
  check('plan loads 7 exercises in plan order', start.length === 7 && start[0] === 'Chest Press Machine');

  await page.getByRole('button', { name: 'Move exercise down' }).first().click();
  await page.waitForTimeout(300);
  check('arrow moves an exercise down one place', (await names())[1] === 'Chest Press Machine');
  check('offers to save the new order to the plan', (await page.getByRole('button', { name: 'Save this order to plan' }).count()) === 1);

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
  check('drag with auto-scroll moves the card several places', after.indexOf('Incline Dumbbell Press') >= 2, after.join(' | '));
  check('the tag goes away on drop', (await page.getByText('Moving', { exact: true }).count()) === 0);

  // A plain tap on a grip must not move anything.
  await scroll(-5000);
  const before = await names();
  await page.getByLabel('Drag to reorder').first().click();
  await page.waitForTimeout(300);
  check('tapping a grip without dragging changes nothing', JSON.stringify(await names()) === JSON.stringify(before));

  await page.getByRole('button', { name: 'Save this order to plan' }).click();
  await page.waitForTimeout(500);
  check('order saved to the plan', (await page.getByText('Order saved').count()) === 1);
  await page.getByRole('button', { name: 'Start from plan 1 - Upper A' }).click();
  await page.waitForTimeout(500);
  check('the plan now opens in the saved order', JSON.stringify(await names()) === JSON.stringify(before));
}

async function logAndHistory({ page, shot, tab, count, dialogs, workouts }) {
  await shot('log-01-empty');
  await page.getByRole('button', { name: 'Start from plan 5 - Cardio + Rehab' }).click();
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

  await page.getByRole('button', { name: 'Save as Plan' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Name this plan').fill('0 - Test Plan');
  await page.getByRole('button', { name: 'SAVE PLAN' }).click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Kevin', exact: true }).click();
  await page.waitForTimeout(300);
  check('Kevin filter shows only Kevin', await workouts().evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label').includes(', Kevin,'))));
  await workouts().first().click();
  await page.waitForTimeout(300);
  check("Diego cannot edit or delete Kevin's workout", (await page.getByRole('button', { name: 'Delete', exact: true }).count()) === 0);
  await page.getByRole('button', { name: 'Repeat' }).click();
  await page.waitForTimeout(700);
  check('Repeat opens Log with the exercises, blank', (await page.getByRole('button', { name: /^Exercise: / }).count()) >= 5 && (await logBtn.isDisabled()));
  check('Repeat keeps the plan label', (await count('From plan:')) === 1);
  check('the plan saved from History is on the Log tab', (await page.getByRole('button', { name: 'Start from plan 0 - Test Plan' }).count()) === 1);

  await page.getByRole('button', { name: 'Start from plan 5 - Cardio + Rehab' }).click();
  await page.waitForTimeout(500);
  check('the typed note is now a saved note', (await count('Felt strong today')) >= 1);
  check('shows how the exercise went last time', (await count('Last workout: 35min @ 6/10')) === 1);

  // Unfinished workouts survive closing and reopening the app.
  await page.getByLabel('time in minutes').first().fill('20');
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot('log-03-restored');
  check('stays signed in after reopening', (await page.getByRole('button', { name: 'Continue as Diego' }).count()) === 0);
  check('unfinished workout is restored with a banner', (await count('Unsaved workout restored')) === 1 && (await page.getByLabel('time in minutes').first().inputValue()) === '20');
  dialogs.length = 0;
  await page.getByRole('button', { name: 'Start from plan 1 - Upper A' }).click();
  await page.waitForTimeout(500);
  check('asks before replacing an unfinished workout', dialogs.some((d) => d.includes('unsaved workout')));

  await tab('History');
  const total = await workouts().count();
  await workouts().first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(500);
  check('deleting asks first, then removes the workout', dialogs.some((d) => d.includes('Delete this workout')) && (await workouts().count()) === total - 1);
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
  await page.getByRole('switch', { name: 'Together Mode' }).click();
  await page.waitForTimeout(400);
  await shot('body-03-together');
  check('Together Mode shows both people on Body', (await count('KEVIN')) >= 1);

  await tab('Log');
  check('Together Mode carries over to Log', (await page.getByRole('button', { name: 'LOG BOTH WORKOUTS' }).count()) === 1);
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
  await page.getByLabel('Search exercises').fill('Sled Push');
  await page.getByRole('button', { name: 'Remove Sled Push' }).click();
  await page.waitForTimeout(500);
  check('a removed built-in exercise can be restored', (await page.getByRole('button', { name: 'Restore Sled Push' }).count()) === 1);
  await page.getByRole('button', { name: 'Restore Sled Push' }).click();
  await page.waitForTimeout(400);
  check('restore puts it back', (await page.getByRole('button', { name: 'Remove Sled Push' }).count()) === 1);
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
  await page.getByRole('button', { name: 'Edit 5 - Cardio + Rehab plan' }).click();
  await page.waitForTimeout(700);
  await shot('plan-editor-01');
  await page.getByLabel('Plan name').fill('5 - Cardio + Rehab v2');
  await page.getByRole('button', { name: 'Move exercise down' }).first().click();
  await page.getByRole('button', { name: 'SAVE PLAN' }).click();
  await page.waitForTimeout(600);
  check('plans can be renamed and reordered', (await page.getByRole('button', { name: 'Start from plan 5 - Cardio + Rehab v2' }).count()) === 1);

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

  await page.getByRole('button', { name: /Switch person/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Continue as Kevin' }).click();
  await page.waitForTimeout(700);
  check('Kevin gets his own empty Log form', (await page.getByRole('button', { name: 'Choose an exercise' }).count()) === 1);
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  await scenario(browser, 'reorder', reorder);
  await scenario(browser, 'log-history', logAndHistory);
  await scenario(browser, 'body-stats-settings', bodyStatsSettings);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
