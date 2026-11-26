// Which kind of build this is.
//
// Test tools (the Pro test switch, sample data) show only while developing in
// Expo Go (__DEV__) or in a build made with EXPO_PUBLIC_TEST_BUILD=1 (the
// "preview" build in eas.json and the browser copy the screen checks use).
// The App Store build ("production" in eas.json) sets neither, so customers
// never see them.

export function isTestBuild(dev: boolean, flag: string | undefined): boolean {
  return dev || flag === '1';
}

// Expo copies EXPO_PUBLIC_ values into the app when it is built; it only
// recognizes them written out in full like this.
export const TEST_BUILD = isTestBuild(
  typeof __DEV__ !== 'undefined' && __DEV__,
  process.env.EXPO_PUBLIC_TEST_BUILD,
);
