// Tests run on a computer, not a phone, so phone storage is replaced with an
// in-memory stand-in supplied by the storage library itself.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
