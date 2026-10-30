#!/bin/bash
# Construit un vrai APK Gradle dans une copie isolée ; ne modifie pas ~/forge-app.
# Usage : scripts/build-android-release.sh 110.10
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_VERSION="${1:?Indiquer la version (ex. 110.10)}"
ANDROID_PROJECT="${FORGE_ANDROID_PROJECT:-/Users/potironlucas/forge-app}"
RELEASE_DIR="$REPO_DIR/releases/$RELEASE_VERSION"
BUILD_DIR="$(mktemp -d /private/tmp/forge-native-build.XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT
[ -f "$RELEASE_DIR/app-version.json" ] || { echo 'Manifeste de version manquant'; exit 1; }
mkdir -p "$BUILD_DIR/android" "$BUILD_DIR/node_modules"
rsync -a --exclude build --exclude .gradle "$ANDROID_PROJECT/android/" "$BUILD_DIR/android/"
rsync -a --exclude build --exclude .gradle "$ANDROID_PROJECT/node_modules/@capacitor" "$BUILD_DIR/node_modules/"
rsync -a --exclude build --exclude .gradle "$ANDROID_PROJECT/node_modules/@capacitor-firebase" "$BUILD_DIR/node_modules/"
cp "$REPO_DIR/index.html" "$BUILD_DIR/android/app/src/main/assets/public/index.html"
python3 - "$RELEASE_DIR/app-version.json" "$BUILD_DIR/android/app/build.gradle" "$REPO_DIR/index.html" <<'PY'
import json,re,sys
from pathlib import Path
m=json.loads(Path(sys.argv[1]).read_text());p=Path(sys.argv[2]);s=p.read_text();html=Path(sys.argv[3]).read_text()
assert re.search(r"FORGE_INDEX_VERSION\s*=\s*\{\s*code:\s*"+str(m['versionCode'])+r",\s*name:\s*'"+re.escape(m['versionName'])+r"'",html),'Version HTML incompatible'
assert 'DÉMO · Mise à jour' not in html
s=re.sub(r'\bversionCode\s+\d+', 'versionCode '+str(m['versionCode']),s,count=1)
s=re.sub(r'\bversionName\s+"[^"]+"','versionName "'+m['versionName']+'"',s,count=1);p.write_text(s)
PY
# Nom public actualisé dans la copie isolée, identifiant Android conservé.
python3 - "$BUILD_DIR/android/app/src/main/res/values/strings.xml" "$BUILD_DIR/android/app/src/main/assets/capacitor.config.json" <<'PYBRAND'
import sys,json
from pathlib import Path
p=Path(sys.argv[1]);s=p.read_text().replace('>Forge<','>CaliMova<');p.write_text(s)
for source in Path(sys.argv[1]).parents[2].joinpath('java').rglob('*.java'):
 source.write_text(source.read_text().replace('Timer Forge','Timer CaliMova').replace('\"Forge\"','\"CaliMova\"'))
p=Path(sys.argv[2])
if p.exists():
 d=json.loads(p.read_text());d['appName']='CaliMova';p.write_text(json.dumps(d,indent=2))
PYBRAND
export JAVA_HOME="${FORGE_JAVA_HOME:-/Users/potironlucas/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home}"
(cd "$BUILD_DIR/android" && ./gradlew :app:assembleDebug --no-daemon --console=plain) > "$RELEASE_DIR/build.log" 2>&1
cp "$BUILD_DIR/android/app/build/outputs/apk/debug/app-debug.apk" "$REPO_DIR/calimova-android-v$RELEASE_VERSION.apk"
TOOLS_DIR="/Users/potironlucas/Library/Android/sdk/build-tools/36.0.0"
"$TOOLS_DIR/apksigner" verify --verbose "$REPO_DIR/calimova-android-v$RELEASE_VERSION.apk"
"$TOOLS_DIR/zipalign" -c -P 16 4 "$REPO_DIR/calimova-android-v$RELEASE_VERSION.apk"
"$TOOLS_DIR/aapt" dump badging "$REPO_DIR/calimova-android-v$RELEASE_VERSION.apk" | sed -n '1p'
shasum -a 256 "$REPO_DIR/calimova-android-v$RELEASE_VERSION.apk" > "$RELEASE_DIR/SHA256.txt"
echo "APK prêt : calimova-android-v$RELEASE_VERSION.apk"
