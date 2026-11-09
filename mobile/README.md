# Flex Daddies: iPhone and Android app

A native version of the Flex Daddies workout log, built with Expo (React
Native). It lives in this `mobile/` folder and does not touch the website in
`app/`.

**Where the data lives right now:** on the phone only. The app starts with
made-up sample data and is **not connected to flexdaddies.com**. Nothing you do
in the app changes the website, and website workouts do not appear in the app.
Connecting the two needs a small addition to the backend, which has not been
made (see "Connecting the real data" below).

## What is in the app

- **Log**: start from a plan or from scratch, pick exercises from a searchable
  list, type sets on the number pad, add notes, log for one person or both
  (Together Mode). An unfinished workout is saved as you type and restored the
  next time you open the app.
- **Rearranging**: hold the grip handle on an exercise card and drag. A tag
  follows your finger and a gold line shows where it will land. The up and down
  arrows do the same job one step at a time. "Save this order to plan" keeps a
  new order for next time.
- **History**: every workout, filter by person, repeat one, save one as a plan,
  edit or delete your own.
- **Body**: weigh-ins (lbs or kg) and six body measurements (in or cm), with
  trends.
- **Stats**: totals, progress charts, personal records.
- **Customizing**: add your own exercises, rename, recategorise, remove and
  restore exercises, edit plans, choose the rest timer length, turn the chime
  on or off.
- **Native parts**: the phone's own tab bar, keyboards, date picker, switches,
  alerts and sheets; haptic taps; the screen stays on during a workout.

## Open it on your iPhone with Expo Go

1. On the iPhone, install **Expo Go** from the App Store.
2. On a Mac with [Node.js](https://nodejs.org) installed, open **Terminal** and
   paste this one line:

   ```
   git clone -b claude/flex-daddies-expo-native-rsl56l https://github.com/unfoldeffect/flexdaddies.git && cd flexdaddies/mobile && npm install && npx expo start --tunnel
   ```

3. A QR code appears in Terminal. Point the iPhone camera at it and tap the
   banner. The app opens in Expo Go.

Leave Terminal open while you use the app. To stop, press `Ctrl` + `C`.
The next time, you only need:

```
cd flexdaddies/mobile && npx expo start --tunnel
```

Notes:

- `--tunnel` lets the phone reach the Mac from any network. If both are on the
  same Wi-Fi you can leave it off, which is faster.
- Expo Go only runs the newest Expo version. This project uses Expo SDK 58. If
  Expo Go says the project is too old or too new, update Expo Go.

## Make an Android APK (a file you can install on an Android phone)

This uses Expo's build service (EAS). You need a free Expo account
([expo.dev](https://expo.dev)); the free plan includes a limited number of
builds each month. In Terminal, from the `mobile` folder:

1. Sign in (it asks for your Expo email and password):

   ```
   npx eas-cli@latest login
   ```

2. Link this app to your Expo account. Answer **yes** when it offers to create
   the project:

   ```
   npx eas-cli@latest init
   ```

3. Start the build. Answer **yes** when it offers to create an Android
   keystore (the signing key; Expo stores it for you):

   ```
   npx eas-cli@latest build --platform android --profile preview
   ```

4. Wait (often 10 to 30 minutes, longer when the free queue is busy; you can
   close Terminal). When it finishes
   you get a link and a QR code. Open it on the Android phone to download and
   install the `.apk`.

Step 2 adds a project ID to `app.json`. That ID is not a secret and is fine to
commit.

## Store builds later

`app.json` and `eas.json` are already set up for both stores:

| | iPhone | Android |
| --- | --- | --- |
| App ID | `com.flexdaddies.app` | `com.flexdaddies.app` |
| Test build | `eas build -p ios --profile preview` | `eas build -p android --profile preview` (APK) |
| Store build | `eas build -p ios --profile production` | `eas build -p android --profile production` (AAB) |
| Upload | `eas submit -p ios` | `eas submit -p android` |

Version numbers are kept by Expo and go up by themselves on each store build.
The app uses no camera, microphone, location, contacts or tracking, so the
phone never has to ask the user to allow anything.

### Still to do before submitting

**Both stores**

- Connect the real data (below) and add a way to sign in. Today the website
  has no login: anyone with the address can see and change the data. A public
  app needs that closed first.
- Publish a privacy policy page and link it in each store listing. The app
  holds body weight and measurements, which the stores treat as health data.
- Add a way to delete your account and data from inside the app (both stores
  require it once there are accounts).
- Decide who the app is for. It is built around two named people. Apple
  usually rejects apps made for a private group; the options are private
  sharing (TestFlight on iPhone, internal testing on Android) or making the
  two profile names editable.
- A proper 1024 x 1024 icon. The current one is the 512 px website logo
  enlarged, which is slightly soft.
- Store listing: description, screenshots, support email, age rating.
- Test on real phones: dragging, the keyboard, haptics, the timer chime, and
  small and large screens. None of that could be checked where this was built.

**iPhone (App Store)**

- Apple Developer Program membership ($99 a year).
- Create the app in App Store Connect with the ID `com.flexdaddies.app`.
- Fill in the App Privacy questions (health and fitness data).
- Screenshots in the size App Store Connect asks for (the largest iPhone).

**Android (Google Play)**

- Google Play developer account ($25, once).
- Create the app in Play Console with the package `com.flexdaddies.app`.
- Fill in the Data safety form and the Health apps declaration.
- New personal developer accounts have to run a closed test before going
  public (about 12 testers for 14 days at the time of writing; Play Console
  shows the current rule).
- Feature graphic (1024 x 500) and phone screenshots.

## Connecting the real data (not done yet)

The website talks to its database through functions built into the site
itself. A phone app cannot call those reliably, so the backend needs a small,
separate set of addresses just for the app (for example `/api/v1/workouts`).
Adding them does not change how the website works.

The app is ready for it: every change goes through one file,
`src/data/store.tsx`, whose actions are named after the website's server
functions and send the same data shapes. Only that file needs to change.

## Keys and passwords

There are none in this project today. The repository is public, so if any are
ever needed they go in a `.env` file, which is never uploaded (see
`.env.example`). Signing keys are kept by Expo, not in this folder.

## For developers

```
npm run check     # type-check, lint and unit tests
npm test          # unit tests only (jest)
npm run lint
```

- `src/app/` screens (Expo Router). `_layout.tsx` is the frame, then one file
  per tab.
- `src/components/` the pieces screens are made of.
- `src/lib/` rules and maths with no screen code, covered by `src/__tests__/`.
- `src/data/` what is stored and how (`db.ts` rules, `store.tsx` actions,
  `storage.ts` phone storage, `sample-data.ts`).
- `src/lib/workout-data.ts` and `src/lib/workout-helpers.ts` are copied from
  the website (`app/src/lib/`) and must stay identical. A test fails if they
  drift; copy the website's file across to fix it.
- `e2e/` browser screen checks; see `e2e/README.md`.
- The tab bar is native on phones (`components/app-tabs.tsx`). The
  `app-tabs.web.tsx` version exists only for the browser checks.
