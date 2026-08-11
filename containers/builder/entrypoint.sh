#!/bin/sh
set -eu

restore_output_owner() {
  if [ -n "${LEAN_BRIDGE_OUTPUT_UID:-}" ] && [ -n "${LEAN_BRIDGE_OUTPUT_GID:-}" ]; then
    chown -R "$LEAN_BRIDGE_OUTPUT_UID:$LEAN_BRIDGE_OUTPUT_GID" "$1"
  fi
}

run_component() {
  engine_root=${LEAN_BRIDGE_ENGINE:-/workspace/engine}
  engine_flake="path:$engine_root"
  component_root=${LEAN_BRIDGE_COMPONENT:-/workspace/component}
  request_path=${LEAN_BRIDGE_REQUEST:-/workspace/request/engine-execution-request.json}
  output_root=${LEAN_BRIDGE_OUTPUT:-/workspace/output/execution}

  if [ ! -f "$engine_root/flake.nix" ] || [ ! -f "$engine_root/flake.lock" ]; then
    echo "error: installed engine flake is missing from $engine_root" >&2
    exit 2
  fi
  if [ ! -f "$request_path" ]; then
    echo "error: engine execution request is missing: $request_path" >&2
    exit 2
  fi
  if [ ! -d "$component_root" ]; then
    echo "error: component input closure is missing: $component_root" >&2
    exit 2
  fi
  if [ -e "$output_root" ]; then
    echo "error: component output already exists: $output_root" >&2
    exit 2
  fi

  export GIT_CONFIG_COUNT=1
  export GIT_CONFIG_KEY_0=safe.directory
  export GIT_CONFIG_VALUE_0="$engine_root"
  if [ -e "$engine_root/.git" ]; then
    engine_flake="git+file://$engine_root"
  fi
  umask 022
  if [ -n "${LEAN_BRIDGE_ENGINE_PROGRAM:-}" ]; then
    if [ ! -x "$LEAN_BRIDGE_ENGINE_PROGRAM" ]; then
      echo "error: cached component engine is unavailable: $LEAN_BRIDGE_ENGINE_PROGRAM" >&2
      exit 2
    fi
    "$LEAN_BRIDGE_ENGINE_PROGRAM" \
      --request "$request_path" \
      --component "$component_root" \
      --output "$output_root" \
      --engine "$engine_root" \
      --backend docker-nix
  else
    nix --extra-experimental-features "nix-command flakes" run \
      --no-write-lock-file \
      "$engine_flake#component-build-engine" \
      -- \
      --request "$request_path" \
      --component "$component_root" \
      --output "$output_root" \
      --engine "$engine_root" \
      --backend docker-nix
  fi
  restore_output_owner "$output_root"
}

run_build() {
  source_root=${LEAN_BRIDGE_SOURCE:-/workspace/source}
  output_root=${LEAN_BRIDGE_OUTPUT:-/workspace/output}
  project_root=/workspace/project
  flake_ref=path:.
  export GIT_CONFIG_COUNT=1
  export GIT_CONFIG_KEY_0=safe.directory
  export GIT_CONFIG_VALUE_0="$source_root"

  if [ ! -f "$source_root/flake.nix" ] || [ ! -f "$source_root/flake.lock" ]; then
    echo "error: canonical flake inputs are missing from $source_root" >&2
    exit 2
  fi
  if [ -e "$output_root" ] && [ "$(find "$output_root" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
    echo "error: build output is not empty: $output_root" >&2
    exit 2
  fi

  mkdir -p "$output_root/bundle" "$output_root/packages"
  umask 022
  mkdir -p "$project_root"
  if git -C "$source_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$source_root" ls-files -z --cached --others --exclude-standard \
      | tar --directory="$source_root" --null --files-from=- --create --file=- \
      | tar --no-same-owner --directory="$project_root" --extract --file=-
    if [ -d "$source_root/.git" ]; then
      cp -R "$source_root/.git" "$project_root/.git"
      flake_ref=.
    fi
  else
    cp -R "$source_root/." "$project_root/"
  fi
  cd "$project_root"

  nix --extra-experimental-features "nix-command flakes" build \
    --no-link \
    --no-write-lock-file \
    "$flake_ref#universal-release-bundle"
  bundle_store=$(nix --extra-experimental-features "nix-command flakes" path-info \
    --no-write-lock-file \
    "$flake_ref#universal-release-bundle")

  nix --extra-experimental-features "nix-command flakes" build \
    --no-link \
    --no-write-lock-file \
    "$flake_ref#release-rehearsal"
  packages_store=$(nix --extra-experimental-features "nix-command flakes" path-info \
    --no-write-lock-file \
    "$flake_ref#release-rehearsal")

  cp -aL "$bundle_store/." "$output_root/bundle/"
  cp -aL "$packages_store/." "$output_root/packages/"

  cat > "$output_root/build-report.json" <<EOF
{
  "schemaVersion": 1,
  "backend": "docker-nix",
  "builder": "lean-bridge-debian-nix-2.24.11",
  "bundleStorePath": "$bundle_store",
  "packagesStorePath": "$packages_store",
  "bundlePath": "bundle",
  "packagesPath": "packages",
  "flakeOutputs": ["universal-release-bundle", "release-rehearsal"],
  "sourceReadOnly": true,
  "componentBinariesRebuiltByProjection": false
}
EOF
  restore_output_owner "$output_root"
}

case "${1:-build}" in
  build) run_build ;;
  component) run_component ;;
  *)
    echo "usage: lean-bridge-builder build|component" >&2
    exit 64
    ;;
esac
