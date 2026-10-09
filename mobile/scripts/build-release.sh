#!/usr/bin/env bash
# Builds the release-signed arm64-v8a APK for GitHub Releases (and optionally an AAB), then verifies it
# (ADR-054, ADR-055).
#   bash mobile/scripts/build-release.sh                    # APK only
#   CLINNOTE_BUILD_AAB=1 bash mobile/scripts/build-release.sh   # APK + AAB (developer artifact)
# Needs: ANDROID_HOME (default ~/android-sdk), JAVA_HOME (JDK 17+), the signing properties from
# scripts/create-upload-key.sh. Artifacts go to $CLINNOTE_ARTIFACTS (default ~/clinnote-artifacts) and are
# never overwritten. Gradle flags are tuned for a 2-core / 8 GB Codespace.
set -euo pipefail

cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
OUT="${CLINNOTE_ARTIFACTS:-$HOME/clinnote-artifacts}"
PROPS="${CLINNOTE_SIGNING_PROPERTIES:-$HOME/.clinnote-signing/signing.properties}"
VERSION="$(node -p "require('./app.json').expo.version")"
AAB_ABIS="${CLINNOTE_AAB_ABIS:-armeabi-v7a,arm64-v8a,x86_64}"
AAB="$OUT/ClinNote-$VERSION-release.aab"
APK="$OUT/ClinNote-$VERSION-arm64-v8a-release.apk"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

[ -f "$PROPS" ] || { echo "BLOCKED: signing properties not found at $PROPS (run scripts/create-upload-key.sh)." >&2; exit 2; }
BUILD_AAB="${CLINNOTE_BUILD_AAB:-0}"
for f in "$AAB" "$APK"; do [ ! -e "$f" ] || { echo "Refusing to overwrite $f" >&2; exit 2; }; done
mkdir -p "$OUT"

npx expo prebuild --platform android --no-install

GRADLE=(./gradlew --no-daemon --max-workers=1 -Pkotlin.compiler.execution.strategy=in-process
  "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m")
if [ "$BUILD_AAB" = "1" ]; then
  (cd android && "${GRADLE[@]}" bundleRelease -PreactNativeArchitectures="$AAB_ABIS")
  cp android/app/build/outputs/bundle/release/app-release.aab "$AAB"
fi
(cd android && "${GRADLE[@]}" assembleRelease -PreactNativeArchitectures=arm64-v8a)
cp android/app/build/outputs/apk/release/app-release.apk "$APK"

# Verification: the build fails if an artifact carries the debug certificate.
if [ "$BUILD_AAB" = "1" ]; then
  "$JAVA_HOME/bin/keytool" -printcert -jarfile "$AAB" | grep -E "Owner|SHA256:"
  if "$JAVA_HOME/bin/keytool" -printcert -jarfile "$AAB" | grep -q "CN=Android Debug"; then echo "AAB is debug-signed" >&2; exit 1; fi
fi
"$BT/apksigner" verify --verbose --print-certs "$APK" 2>/dev/null | grep -E "Verified using|Signer #1 certificate (DN|SHA-256)"
if "$BT/apksigner" verify --print-certs "$APK" 2>/dev/null | grep -q "CN=Android Debug"; then echo "APK is debug-signed" >&2; exit 1; fi
"$BT/aapt2" dump badging "$APK" | grep -E "^package:|targetSdkVersion|uses-permission|application-debuggable" || true
"$BT/zipalign" -c -P 16 4 "$APK" && echo "zipalign 16 KB: Verification successful"
# SHA256SUMS.txt is the checksum file attached to the GitHub Release (verify with `sha256sum -c SHA256SUMS.txt`).
SUMS="$OUT/ClinNote-$VERSION-SHA256SUMS.txt"
FILES=("$(basename "$APK")"); [ "$BUILD_AAB" = "1" ] && FILES+=("$(basename "$AAB")")
(cd "$OUT" && sha256sum "${FILES[@]}" | tee "$(basename "$SUMS")")
ls -l "$APK" "$SUMS"; [ "$BUILD_AAB" = "1" ] && ls -l "$AAB" || true
