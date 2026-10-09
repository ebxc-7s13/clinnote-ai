/** Release configuration guards (ADR-054): upload-key signing, stable package, permissions, no secrets. */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyReleaseSigning } = require('../../plugins/withReleaseSigning');

const root = path.join(__dirname, '..', '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

// The relevant part of the Expo SDK 57 android/app/build.gradle template.
const TEMPLATE = `def jscFlavor = 'x'

android {
    namespace 'ai.clinnote.app'
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('release signing plugin', () => {
  const out = applyReleaseSigning(TEMPLATE);

  it('signs release with the upload key, never the debug key', () => {
    const release = out.slice(out.indexOf('        release {\n            //'));
    expect(release).toContain('signingConfig clinnoteHasReleaseSigning ? signingConfigs.release : null');
    expect(release).not.toContain('signingConfig signingConfigs.debug');
    expect(out).toMatch(/debug \{\n\s+signingConfig signingConfigs\.debug/); // debug builds unchanged
  });

  it('fails release tasks when signing is missing (no silent fallback)', () => {
    expect(out).toContain('gradle.taskGraph.whenReady');
    expect(out).toContain('throw new GradleException("ClinNote release signing is not configured');
  });

  it('reads credentials from an external file and embeds none', () => {
    expect(out).toContain('.clinnote-signing/signing.properties');
    expect(out).not.toMatch(/storePassword '(?!android')/);
  });

  it('is idempotent and refuses an unknown template', () => {
    expect(applyReleaseSigning(out)).toBe(out);
    expect(() => applyReleaseSigning('android {\n}\n')).toThrow(/template changed/);
  });
});

describe('app.json release invariants', () => {
  it('keeps the package id and raises the version', () => {
    expect(appJson.android.package).toBe('ai.clinnote.app');
    expect(appJson.android.versionCode).toBeGreaterThan(2); // 1.0.0 = 1, 1.1.0 = 2
    expect(appJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(appJson.plugins).toContain('./plugins/withReleaseSigning');
  });

  it('requests only the microphone and blocks unrelated permissions', () => {
    expect(appJson.android.permissions).toEqual(['android.permission.RECORD_AUDIO']);
    expect(appJson.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.CAMERA', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.READ_CONTACTS']));
    expect(appJson.android.allowBackup).toBe(false);
  });

  it('contains no secrets in client configuration', () => {
    for (const f of ['app.json', 'eas.json', '.env.example']) {
      const text = fs.readFileSync(path.join(root, f), 'utf8');
      expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{20}|sk-[A-Za-z0-9]{20}|hf_[A-Za-z0-9]{20}|BEGIN PRIVATE KEY|storePassword|keyPassword/);
    }
  });
});
