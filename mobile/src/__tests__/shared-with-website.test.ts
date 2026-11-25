// The reorder/weight helpers are copied from the website so the two stay in
// step. If this fails, the website's copy changed: copy the file across again
// (see mobile/README.md). The exercise list (workout-data.ts) is no longer
// shared: the store app has its own 75 movements with equipment (movements.ts).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const websiteLib = join(__dirname, '..', '..', '..', 'app', 'src', 'lib');
const mobileLib = join(__dirname, '..', 'lib');
const shared = ['workout-helpers.ts'];

// The website folder is not there in every setting (a store build only ships
// the mobile folder), so these checks only run where both exist.
const describeIfWebsite = existsSync(websiteLib) ? describe : describe.skip;

describeIfWebsite('files shared with the website', () => {
  it.each(shared)('%s is identical to the website copy', (file) => {
    expect(readFileSync(join(mobileLib, file), 'utf8')).toBe(
      readFileSync(join(websiteLib, file), 'utf8'),
    );
  });
});
