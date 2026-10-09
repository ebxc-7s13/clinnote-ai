#!/usr/bin/env bash
# Creates the ClinNote Google Play UPLOAD key (Play App Signing holds the app signing key).
#
#   bash mobile/scripts/create-upload-key.sh            # random password, never printed
#   CLINNOTE_SIGNING_INTERACTIVE=1 bash mobile/scripts/create-upload-key.sh   # type your own password
#
# Output (outside Git, owner-only permissions):
#   $CLINNOTE_SIGNING_DIR (default ~/.clinnote-signing)/
#     clinnote-upload.jks        upload keystore (PKCS12, RSA 4096, 30 years)
#     signing.properties         storeFile / storePassword / keyAlias / keyPassword (read by Gradle)
#     upload_certificate.pem     public certificate (safe to share; used for an upload-key reset)
#
# Back up the whole folder to two offline locations (see docs/GOOGLE-PLAY.md §11). Never commit it.
set -euo pipefail

DIR="${CLINNOTE_SIGNING_DIR:-$HOME/.clinnote-signing}"
ALIAS="clinnote-upload"
STORE="$DIR/clinnote-upload.jks"
PROPS="$DIR/signing.properties"
KEYTOOL="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"

if [ -e "$STORE" ] || [ -e "$PROPS" ]; then
  echo "Refusing to overwrite: $DIR already contains an upload key. Move it away first." >&2
  exit 1
fi
case "$DIR" in
  "$(git rev-parse --show-toplevel 2>/dev/null || echo /nonexistent)"*) echo "Refusing: $DIR is inside the Git repository." >&2; exit 1 ;;
esac

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

if [ "${CLINNOTE_SIGNING_INTERACTIVE:-0}" = "1" ]; then
  read -r -s -p "Upload keystore password (min 12 chars): " PASS; echo
  read -r -s -p "Repeat: " PASS2; echo
  [ "$PASS" = "$PASS2" ] || { echo "Passwords differ." >&2; exit 1; }
  [ "${#PASS}" -ge 12 ] || { echo "Password too short." >&2; exit 1; }
else
  PASS="$(openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-40)"
fi

# PKCS12 keystores use one password for store and key. Passwords are passed through
# environment variables (:env), so they never appear in the process list or in logs.
export CLINNOTE_KS_PASS="$PASS"
"$KEYTOOL" -genkeypair -v \
  -storetype PKCS12 -keystore "$STORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -sigalg SHA256withRSA -validity 10950 \
  -dname "CN=ClinNote Upload Key, O=ClinNote" \
  -storepass:env CLINNOTE_KS_PASS -keypass:env CLINNOTE_KS_PASS >/dev/null 2>&1

"$KEYTOOL" -exportcert -rfc -keystore "$STORE" -alias "$ALIAS" \
  -storepass:env CLINNOTE_KS_PASS -file "$DIR/upload_certificate.pem" >/dev/null 2>&1

cat >"$PROPS" <<EOF
storeFile=$STORE
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF
unset CLINNOTE_KS_PASS PASS PASS2
chmod 600 "$STORE" "$PROPS" "$DIR/upload_certificate.pem"

echo "Upload key created in $DIR (password stored only in signing.properties)."
"$KEYTOOL" -printcert -file "$DIR/upload_certificate.pem" | grep -E "Owner|SHA256:|Signature algorithm|Valid"
