#!/bin/bash
# Construit un APK de test à partir d'un APK existant, en remplaçant
# assets/public/index.html par le fichier local, puis le signe avec la
# clé debug Android (même signature que l'app installée => données gardées).
#
# Usage : ./make-test-apk.sh [apk-source] [apk-sortie]
set -e

SRC="${1:-forge-android-v109.46.apk}"
OUT="${2:-forge-test.apk}"
BT="$HOME/Library/Android/sdk/build-tools/36.0.0"
KS="$HOME/.android/debug.keystore"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$SRC" ] || { echo "APK source introuvable : $SRC"; exit 1; }
[ -f index.html ] || { echo "index.html introuvable (lance depuis la racine du repo)"; exit 1; }
[ -x "$BT/apksigner" ] || { echo "build-tools introuvable : $BT"; exit 1; }
[ -f "$KS" ] || { echo "keystore debug introuvable : $KS"; exit 1; }

mkdir -p "$TMP/stage/assets/public"
cp "$SRC" "$TMP/base.apk"
cp index.html "$TMP/stage/assets/public/index.html"

( cd "$TMP/stage" && zip -X -q "$TMP/base.apk" assets/public/index.html )
"$BT/zipalign" -f -p 4 "$TMP/base.apk" "$TMP/aligned.apk"
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android \
  --out "$OUT" "$TMP/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" >/dev/null

echo "OK -> $OUT"
echo "Installer : adb install -r \"$OUT\""
