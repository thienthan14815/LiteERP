#!/usr/bin/env bash
# Convert a pnpm `deploy` output into a fully hoisted, real-file node_modules
# so it can be bind-mounted into a Docker/Android container.
#
# pnpm 9 `deploy` writes:
#   node_modules/<direct-dep>              → symlink → .pnpm/<dep>@ver/node_modules/<dep>
#   .pnpm/<dep>@ver/node_modules/<dep>     = real files
#   .pnpm/<dep>@ver/node_modules/<peer>    → symlink → .pnpm/<peer>@ver/node_modules/<peer>
#
# For a portable payload we need every unique package name at the top level as
# real files. Strategy:
#   1. Enumerate `.pnpm/<pkg>@ver/node_modules/<pkg>` (real dirs, one per version).
#   2. For each package name, pick the newest version (deploy usually only stores
#      one prod-relevant version), and cp -R that into node_modules/<pkg>.
#   3. Skip if the top-level entry is already a real directory.
#
# Nested per-package node_modules symlinks stay because Node.js will resolve
# their targets via the flat top-level after step 2.

set -euo pipefail

NM="${1:-payload/api/node_modules}"

if [[ ! -d "$NM/.pnpm" ]]; then
  echo "physicalize-payload: $NM/.pnpm does not exist" >&2
  exit 1
fi

removed=0
copied=0

# Step A: remove any existing top-level symlinks (both regular and scoped).
while IFS= read -r -d '' link; do
  rm -f "$link"
  removed=$((removed + 1))
done < <(find "$NM" -maxdepth 3 -type l \
  \( -path "$NM/*" -o -path "$NM/@*/*" \) \
  -not -path "$NM/.pnpm/*" -print0)

# Step B: for each .pnpm/<pkg>@ver/node_modules/<pkg>, copy to top-level if absent.
# When multiple versions exist we take the first (deploy usually has one).
declare -A seen

for realdir in "$NM"/.pnpm/*/node_modules/*; do
  [[ -d "$realdir" ]] || continue
  pkgname=$(basename "$realdir")

  # Scoped pkg: .pnpm/@scope+name@ver/node_modules/@scope/name
  if [[ "$pkgname" == @* ]]; then
    for scopedir in "$realdir"/*; do
      [[ -d "$scopedir" ]] || continue
      full="$pkgname/$(basename "$scopedir")"
      if [[ -n "${seen[$full]:-}" ]]; then continue; fi
      seen[$full]=1
      dest="$NM/$full"
      # Skip if the top-level already has a real dir (unusual after step A).
      [[ -d "$dest" && ! -L "$dest" ]] && continue
      mkdir -p "$NM/$pkgname"
      cp -R "$scopedir" "$dest"
      copied=$((copied + 1))
    done
    continue
  fi

  if [[ -n "${seen[$pkgname]:-}" ]]; then continue; fi
  seen[$pkgname]=1
  dest="$NM/$pkgname"
  [[ -d "$dest" && ! -L "$dest" ]] && continue
  cp -R "$realdir" "$dest"
  copied=$((copied + 1))
done

echo "physicalize-payload: removed $removed symlinks, copied $copied real packages to top-level"

# Step C: drop the .pnpm virtual store — its contents are duplicated in the
# top-level tree after step B. Keeping it doubles the payload size (~900 MB).
if [[ -d "$NM/.pnpm" ]]; then
  rm -rf "$NM/.pnpm"
  echo "physicalize-payload: removed .pnpm virtual store"
fi
