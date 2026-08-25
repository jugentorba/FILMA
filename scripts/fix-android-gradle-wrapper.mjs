import { readFile, writeFile } from 'node:fs/promises';

const wrapperFile = new URL('../android/gradle/wrapper/gradle-wrapper.properties', import.meta.url);
const requiredVersion = '9.4.1';

let content;
try {
  content = await readFile(wrapperFile, 'utf8');
} catch (error) {
  console.error('FILMA: Android Gradle wrapper was not found. Run Expo Android prebuild first.');
  throw error;
}

const pattern = /(distributionUrl=.*gradle-)([0-9.]+)-(bin|all)(\.zip)/;
const match = content.match(pattern);

if (!match) {
  throw new Error('FILMA: Could not identify the Gradle distributionUrl in gradle-wrapper.properties.');
}

const [, prefix, currentVersion, distributionType, suffix] = match;

if (currentVersion === requiredVersion && distributionType === 'bin') {
  console.log(`FILMA: Gradle wrapper already uses ${requiredVersion}.`);
  process.exit(0);
}

const replacement = `${prefix}${requiredVersion}-bin${suffix}`;
content = content.replace(pattern, replacement);
await writeFile(wrapperFile, content, 'utf8');

console.log(`FILMA: Gradle wrapper updated from ${currentVersion}-${distributionType} to ${requiredVersion}-bin.`);
