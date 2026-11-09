# Screen checks in a browser

These scripts open the app in a headless browser at iPhone size, tap through
every screen like a person would, and check what shows up. They exist because
the app could not be run on a real phone or simulator where it was built.

They test the same screen code the phones run, but in a browser, so they can
not check things only a real phone has: haptics, the native tab bar, the
native date picker, the keyboard, and how dragging feels under a finger.

Run them from the `mobile` folder:

```
npx expo export --platform web --output-dir dist-web
node e2e/run.js dist-web
```

They need Playwright with a Chromium browser (`npm install --no-save playwright`
then `npx playwright install chromium`, if it is not already on the machine).
Screenshots are saved in `e2e/screenshots/`.
