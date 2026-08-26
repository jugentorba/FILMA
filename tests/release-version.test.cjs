const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const settingsEntry = fs.readFileSync(path.join(root, 'src/screens/SettingsScreen.tsx'), 'utf8');
const settingsHub = fs.readFileSync(path.join(root, 'src/screens/SettingsHubScreen.tsx'), 'utf8');
const settingsDetail = fs.readFileSync(path.join(root, 'src/screens/SettingsV2.tsx'), 'utf8');

const version = String(app.expo.version);
const iosBuild = String(app.expo.ios.buildNumber);
const androidBuild = String(app.expo.android.versionCode);
const expectedLabel = `FILMA ${version} · build ${iosBuild}`;

assert.equal(pkg.version, version, 'package.json version must match app.json Expo version');
assert.equal(androidBuild, iosBuild, 'Android versionCode and iOS buildNumber must stay aligned');
assert.ok(settingsEntry.includes("export { SettingsHubScreen as SettingsScreen } from './SettingsHubScreen';"), 'SettingsScreen must point at the grouped settings hub');
assert.ok(settingsHub.includes(expectedLabel), `Settings hub must show the current release label: ${expectedLabel}`);
assert.ok(settingsDetail.includes(expectedLabel), `Detailed settings must show the current release label: ${expectedLabel}`);

console.log(`FILMA release metadata is aligned: ${expectedLabel}`);
