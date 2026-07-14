#!/usr/bin/env bash
# Cross-compile Mapbox sqlite3 (N-API) for nodejs-mobile Android arm64.
# Uses the same toolchain as build-better-sqlite3-android.sh.
set -euo pipefail

NDK_VERSION="26.1.10909125"
if [[ ! -d "/ndk-linux/toolchains/llvm/prebuilt/linux-x86_64" ]]; then
  echo "Downloading Linux NDK r26b…"
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

TOOLCHAIN_DIR="$NDK/toolchains/llvm/prebuilt"
HOST_TAG=$(ls "$TOOLCHAIN_DIR" | head -1)
TC="$TOOLCHAIN_DIR/$HOST_TAG"
echo "NDK toolchain: $TC"

API=24
export ANDROID_NDK_HOME="$NDK"
export CC="$TC/bin/aarch64-linux-android${API}-clang"
export CXX="$TC/bin/aarch64-linux-android${API}-clang++"
export AR="$TC/bin/llvm-ar"
export RANLIB="$TC/bin/llvm-ranlib"
export LD="$TC/bin/ld.lld"
export STRIP="$TC/bin/llvm-strip"
export CFLAGS="-fPIC -Wno-error"
export CXXFLAGS="-fPIC -Wno-error -Wno-format-security"
# Link the .node against libnode.so so Bionic can resolve N-API / V8 symbols
# at dlopen time (Android's linker enforces per-namespace resolution and does
# not fall back to the loader process's symbols like glibc does).
export LDFLAGS="-L$NODEDIR/bin/arm64-v8a -lnode -Wl,--allow-shlib-undefined"

rm -rf /work && mkdir -p /work && cd /work

cat > package.json <<EOF
{ "name": "nm-build", "version": "1.0.0" }
EOF

npm i --ignore-scripts --no-audit --no-fund nodejs-mobile-gyp@0.4.0 sqlite3@6.0.1 >/dev/null

cd node_modules/sqlite3

echo "Compiling sqlite3 for android-arm64 (N-API)…"
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

BUILT="build/Release/node_sqlite3.node"
if [[ ! -f "$BUILT" ]]; then
  echo "Expected $BUILT not found" >&2
  find build/Release -type f 2>&1 | head -10
  exit 1
fi

mkdir -p "$OUT/build/Release"
cp "$BUILT" "$OUT/build/Release/node_sqlite3.node"
$STRIP -x "$OUT/build/Release/node_sqlite3.node" || true

# Copy the JS wrapper.
cp -r lib "$OUT/"
cp package.json "$OUT/package.json"

echo "Wrote $OUT/build/Release/node_sqlite3.node ($(du -h "$OUT/build/Release/node_sqlite3.node" | cut -f1))"
file "$OUT/build/Release/node_sqlite3.node" 2>/dev/null || true
