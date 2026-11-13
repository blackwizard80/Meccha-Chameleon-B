import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');

const permissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
];

const manifestTag = xml.match(/<manifest\b[^>]*>/)?.[0];
if (!manifestTag) throw new Error('Android manifest opening tag was not found.');

const missing = permissions.filter(
  (permission) => !xml.includes(`android:name="${permission}"`),
);
if (missing.length) {
  xml = xml.replace(
    manifestTag,
    `${manifestTag}\n${missing.map((permission) => `    <uses-permission android:name="${permission}" />`).join('\n')}`,
  );
}

xml = xml.replace(
  /<application\b(?![^>]*android:usesCleartextTraffic=)/,
  '<application android:usesCleartextTraffic="true"',
);

await writeFile(manifestPath, xml);
console.log('Android LAN network permissions configured.');
