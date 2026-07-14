#!/usr/bin/env bash
# Cross-compile better-sqlite3 for nodejs-mobile Android arm64.
#
# Runs inside a Linux Node image. Requires:
#   - Android NDK bind-mounted at /ndk
#   - nodejs-mobile Node headers bind-mounted at /nodedir
#
# Outputs the compiled .node file at /out/better_sqlite3.node
set -euo pipefail

# Download a Linux NDK if the host mount didn't provide one (Windows NDK won't
# run inside a Linux container).
NDK_VERSION="26.1.10909125"
if [[ ! -d "/ndk-linux/toolchains/llvm/prebuilt/linux-x86_64" ]]; then
  echo "Downloading Linux NDK $NDK_VERSION…"
  mkdir -p /ndk-linux
  cd /tmp
  apt-get install -y curl unzip >/dev/null 2>&1 || true
  curl -sL -o ndk.zip "https://dl.google.com/android/repository/android-ndk-r26b-linux.zip"
  unzip -q ndk.zip
  mv android-ndk-r26b/* /ndk-linux/
  cd /
fi
NDK="${ANDROID_NDK_HOME:-/ndk-linux}"
NODEDIR="${NODEDIR:-/nodedir}"
OUT="${OUT:-/out}"

if [[ ! -d "$NDK/toolchains/llvm/prebuilt" ]]; then
  echo "NDK not found at $NDK — expected /ndk bind-mount" >&2
  exit 1
fi

TOOLCHAIN_DIR="$NDK/toolchains/llvm/prebuilt"
HOST_TAG=$(ls "$TOOLCHAIN_DIR" | head -1)
TC="$TOOLCHAIN_DIR/$HOST_TAG"
echo "Using NDK toolchain: $TC"

# Android API 24 = min SDK we target.
API=24
export ANDROID_NDK_HOME="$NDK"
export CC="$TC/bin/aarch64-linux-android${API}-clang"
export CXX="$TC/bin/aarch64-linux-android${API}-clang++"
export AR="$TC/bin/llvm-ar"
export RANLIB="$TC/bin/llvm-ranlib"
export LD="$TC/bin/ld.lld"
export STRIP="$TC/bin/llvm-strip"
export CFLAGS="-fPIC -Wno-error"
export CXXFLAGS="-fPIC -Wno-error"

echo "CC = $CC"
$CC --version | head -1

# Fresh workdir.
rm -rf /work
mkdir -p /work
cd /work

cat > package.json <<EOF
{
  "name": "nm-build",
  "version": "1.0.0",
  "dependencies": {
    "better-sqlite3": "11.3.0"
  }
}
EOF

# Install without running better-sqlite3's postinstall — we build manually.
npm i --ignore-scripts --no-audit --no-fund nodejs-mobile-gyp@0.4.0 better-sqlite3@11.3.0 >/dev/null

cd node_modules/better-sqlite3

echo "Compiling for android-arm64…"
node /work/node_modules/nodejs-mobile-gyp/bin/node-gyp.js rebuild \
  --nodedir="$NODEDIR" \
  --arch=arm64 \
  --target_arch=arm64 \
  --openssl_fips= \
  --v8_enable_pointer_compression=0 \
  --v8_enable_31bit_smis_on_64bit_arch=0 \
  --thin=no \
  --debug=false \
  --python=$(which python3)

BUILT="build/Release/better_sqlite3.node"
if [[ -z "$BUILT" ]]; then
  echo "No .node produced" >&2
  find build -type f 2>&1 | head -20
  exit 1
fi

mkdir -p "$OUT"
cp "$BUILT" "$OUT/better_sqlite3.node"
$STRIP -x "$OUT/better_sqlite3.node" || true
echo "Wrote $OUT/better_sqlite3.node ($(du -h "$OUT/better_sqlite3.node" | cut -f1))"
file "$OUT/better_sqlite3.node" 2>/dev/null || true

# Also copy the built lib/ dir so we have the JS wrapper.
mkdir -p "$OUT/lib"
cp -r lib/. "$OUT/lib/"
cp package.json "$OUT/package.json"
