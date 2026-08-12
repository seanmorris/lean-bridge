{
  description = "Lean WebAssembly bridge architecture-testing POC";

  # Keep the architecture POC evaluable by the Nix 2.8 baseline documented in
  # docs/evidence/toolchain-inventory.md. Production will pin a newer Nix too.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          LEAN_BRIDGE_TEST_GLIBC_LIBRARY_PATH = "${pkgs.glibc}/lib";
          LEAN_BRIDGE_TEST_GLIBC_LOADER = "${pkgs.glibc}/lib/ld-linux-x86-64.so.2";
          packages = with pkgs; [
            bash
            bison
            binaryen
            cacert
            clang
            cmake
            curl
            cargo
            flex
            gperf
            git
            jq
            lld
            ninja
            nodejs_22
            openssl
            patchelf
            php82
            php82.unwrapped.dev
            php82Packages.composer
            pkg-config
            (python3.withPackages (pythonPackages: [ pythonPackages.pip ]))
            re2c
            rustc
            libuv
            llvm
            wabt
            wasm-tools
            xz
            zip
            zstd
          ];

          shellHook = ''
            export LEAN_WASM_PROJECT_ROOT="$PWD"
            echo "Run: npm run bootstrap"
          '';
        };
      });

      packages = forAllSystems (pkgs:
        let
          wasmToolchain = import ./nix/wasm-toolchain.nix { inherit pkgs; };
          wasmtimeCapiArchive = pkgs.fetchurl {
            url = "https://github.com/bytecodealliance/wasmtime/releases/download/v42.0.1/wasmtime-v42.0.1-x86_64-linux-c-api.tar.xz";
            hash = "sha256-IJekc1GRikRrJsfmX0hyePY7yUdZG3GJfbVHzZDAUII=";
          };
          wasmtimeCapi = pkgs.runCommand "wasmtime-42.0.1-x86_64-linux-c-api" {
            nativeBuildInputs = [ pkgs.gnutar pkgs.xz ];
          } ''
            mkdir -p "$out"
            tar -xJf '${wasmtimeCapiArchive}' --strip-components=1 -C "$out"
          '';
          coreSourceBoundary = builtins.fromJSON (builtins.readFile ./nix/core-source-boundary.json);
          componentEngineSourceBoundary = builtins.fromJSON (builtins.readFile ./nix/component-engine-source-boundary.json);
          sourceRoot = toString self;
          relativeSourcePath = path:
            let absolute = toString path;
            in if absolute == sourceRoot then "" else pkgs.lib.removePrefix "${sourceRoot}/" absolute;
          isWithin = directory: path: path == directory || pkgs.lib.hasPrefix "${directory}/" path;
          coreSource = builtins.path {
            name = "lean-wasm-core-source";
            path = self;
            filter = path: type:
              let
                relative = relativeSourcePath path;
                includedDirectory = pkgs.lib.any (directory: isWithin directory relative)
                  coreSourceBoundary.includedDirectoryPrefixes;
                parentDirectory = relative == "" || pkgs.lib.any
                  (directory: pkgs.lib.hasPrefix "${relative}/" directory)
                  coreSourceBoundary.includedDirectoryPrefixes;
                parentFile = relative == "" || pkgs.lib.any
                  (file: pkgs.lib.hasPrefix "${relative}/" file)
                  coreSourceBoundary.includedFiles;
              in if type == "directory"
                then includedDirectory || parentDirectory || parentFile
                else includedDirectory || builtins.elem relative coreSourceBoundary.includedFiles;
          };
          componentEngineSource = builtins.path {
            name = "lean-bridge-component-engine-source";
            path = self;
            filter = path: type:
              let
                relative = relativeSourcePath path;
                parentFile = relative == "" || pkgs.lib.any
                  (file: pkgs.lib.hasPrefix "${relative}/" file)
                  componentEngineSourceBoundary.includedFiles;
              in if type == "directory"
                then parentFile
                else builtins.elem relative componentEngineSourceBoundary.includedFiles;
          };
          portablePackages = rec {
            capsule-graph = pkgs.stdenvNoCC.mkDerivation {
              pname = "lean-wasm-capsule-graph-poc";
              version = "0.0.0";
              src = self;
              nativeBuildInputs = [ pkgs.nodejs_22 ];
              dontBuild = true;

              installPhase = ''
                runHook preInstall
                mkdir -p \
                  "$out/src/capsule" \
                  "$out/scripts" \
                  "$out/schema" \
                  "$out/poc/lean-link-spike/capsules" \
                  "$out/resolved"
                cp src/capsule/contract.mjs src/capsule/node.mjs "$out/src/capsule/"
                cp scripts/resolve-lean-graph.mjs "$out/scripts/"
                cp schema/library-capsule.schema.json schema/library-graph-lock.schema.json "$out/schema/"
                cp poc/lean-link-spike/graph-lock.json "$out/poc/lean-link-spike/"
                cp poc/lean-link-spike/capsules/*.json "$out/poc/lean-link-spike/capsules/"
                for profile in side-startup side-lazy final-static; do
                  node scripts/resolve-lean-graph.mjs \
                    --lock poc/lean-link-spike/graph-lock.json \
                    --profile "$profile" \
                    --format json \
                    > "$out/resolved/$profile.json"
                done
                runHook postInstall
              '';
            };

          default = capsule-graph;
        };
        x86WasmPackages = nixpkgs.lib.optionalAttrs (pkgs.system == "x86_64-linux") rec {
          wasm-toolchain = wasmToolchain.emsdk;

          component-runtime = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-bridge-component-runtime";
            version = "0.0.0";
            src = coreSource;
            nativeBuildInputs = with pkgs; [
              bash
              cmake
              file
              gawk
              git
              gnumake
              gnused
              nodejs_22
              patch
              python3
              libuv
              llvm
            ];

            dontConfigure = true;
            buildPhase = ''
              runHook preBuild
              export LEAN_WASM_HOST_LEAN_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_WASM_LEAN_SOURCE='${wasmToolchain.leanSource}'
              export LEAN_WASM_LIBUV_SOURCE='${wasmToolchain.libuvSource}'
              export LEAN_WASM_EMSDK='${wasmToolchain.emsdk}'
              export EM_CACHE="$TMPDIR/emscripten-cache"
              cp -a '${wasmToolchain.emscriptenUpstream}/emscripten/cache' "$EM_CACHE"
              chmod -R u+w "$EM_CACHE"
              bash scripts/build-lean-runtime.sh
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              runtime_root=$(find build/lean-runtime -mindepth 1 -maxdepth 1 -type d -name '*-browser' -print -quit)
              if [ -z "$runtime_root" ]; then
                echo "component engine runtime was not built" >&2
                exit 1
              fi
              mkdir -p \
                "$out/audit" \
                "$out/cmake/include" \
                "$out/cmake/lib/lean" \
                "$out/source/src/include"
              cp -a "$runtime_root/audit/." "$out/audit/"
              cp -a "$runtime_root/cmake/include/." "$out/cmake/include/"
              cp \
                "$runtime_root/cmake/lib/lean/libInit.a" \
                "$runtime_root/cmake/lib/lean/libleanrt.a" \
                "$out/cmake/lib/lean/"
              cp -a "$runtime_root/source/src/include/." "$out/source/src/include/"
              runHook postInstall
            '';
          };

          wasm-poc = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-wasm-architecture-poc";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = with pkgs; [
              bash
              cmake
              file
              gawk
              git
              gnugrep
              gnumake
              gnused
              jq
              nodejs_22
              openssl
              patch
              patchelf
              php82
              php82.unwrapped.dev
              php82Packages.composer
              pkg-config
              python3
              libuv
              llvm
              autoconf
              automake
              libtool
              wabt
              wasm-tools
            ];

            dontConfigure = true;
            buildPhase = ''
              runHook preBuild
              export LEAN_WASM_HOST_LEAN_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_WASM_LEAN_SOURCE='${wasmToolchain.leanSource}'
              export LEAN_WASM_LIBUV_SOURCE='${wasmToolchain.libuvSource}'
              export LEAN_WASM_EMSDK='${wasmToolchain.emsdk}'
              export LEAN_NATIVE_HOST_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_NATIVE_SOURCE='${wasmToolchain.leanSource}'
              export EM_CACHE="$TMPDIR/emscripten-cache"
              cp -a '${wasmToolchain.emscriptenUpstream}/emscripten/cache' "$EM_CACHE"
              chmod -R u+w "$EM_CACHE"

              bash scripts/build-link-spike.sh
              bash scripts/build-lean-link-spike.sh
              LEAN_WASM_RUNTIME_PROFILE=threaded bash scripts/build-lean-link-spike.sh
              node --test tests/**/*.test.mjs
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p "$out/browser" "$out/threaded" "$out/contracts"
              cp -a build/lean-link-spike/. "$out/browser/"
              cp -a build/lean-link-spike-threaded/. "$out/threaded/"
              cp -a \
                poc/lean-link-spike/capsules \
                poc/lean-link-spike/graph-lock.json \
                schema/library-capsule.schema.json \
                schema/library-graph-lock.schema.json \
                "$out/contracts/"
              runHook postInstall
            '';
          };

          universal-core-artifacts = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-universal-core-artifacts";
            version = "0.0.0";
            src = coreSource;
            nativeBuildInputs = with pkgs; [
              bash
              cmake
              file
              gawk
              git
              gnugrep
              gnumake
              gnused
              jq
              nodejs_22
              openssl
              patch
              python3
              libuv
              llvm
              wabt
              wasm-tools
            ];

            dontConfigure = true;
            buildPhase = ''
              runHook preBuild
              export LEAN_WASM_HOST_LEAN_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_WASM_LEAN_SOURCE='${wasmToolchain.leanSource}'
              export LEAN_WASM_LIBUV_SOURCE='${wasmToolchain.libuvSource}'
              export LEAN_WASM_EMSDK='${wasmToolchain.emsdk}'
              export EM_CACHE="$TMPDIR/emscripten-cache"
              cp -a '${wasmToolchain.emscriptenUpstream}/emscripten/cache' "$EM_CACHE"
              chmod -R u+w "$EM_CACHE"
              bash scripts/build-lean-link-spike.sh
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p "$out/audit"
              cp -a build/lean-link-spike/lazy "$out/lazy"
              cp build/lean-link-spike/audit/artifact-manifest.json "$out/audit/"
              runHook postInstall
            '';
          };

          component-build-engine = pkgs.writeShellApplication {
            name = "lean-bridge-component-engine";
            runtimeInputs = [ pkgs.coreutils pkgs.nodejs_22 pkgs.python3 ];
            text = ''
              export EMSDK='${wasmToolchain.emsdk}'
              export EM_CONFIG='${wasmToolchain.emsdk}/.emscripten'
              export EMSCRIPTEN_ROOT='${wasmToolchain.emscriptenUpstream}/emscripten'
              export EMSDK_NODE='${wasmToolchain.node}/bin/node'
              export PATH='${wasmToolchain.emscriptenUpstream}/emscripten:${wasmToolchain.emscriptenUpstream}/bin:${wasmToolchain.node}/bin':"$PATH"
              engine_cache=$(mktemp -d "''${TMPDIR:-/tmp}/lean-bridge-em-cache.XXXXXX")
              trap 'rm -rf "$engine_cache"' EXIT
              cp -a '${wasmToolchain.emscriptenUpstream}/emscripten/cache/.' "$engine_cache/"
              chmod -R u+w "$engine_cache"
              export EM_CACHE="$engine_cache"
              export LEAN_WASM_HOST_LEAN_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_WASM_LEAN_SOURCE='${wasmToolchain.leanSource}'
              export LEAN_WASM_LIBUV_SOURCE='${wasmToolchain.libuvSource}'
              export LEAN_WASM_EMSDK='${wasmToolchain.emsdk}'
              export LEAN_BRIDGE_LEAN='${wasmToolchain.leanHost}/bin/lean'
              export LEAN_BRIDGE_EMCC='${wasmToolchain.emsdk}/upstream/emscripten/emcc'
              export LEAN_BRIDGE_RUNTIME_ROOT='${component-runtime}'
              '${pkgs.nodejs_22}/bin/node' '${componentEngineSource}/scripts/run-component-engine.mjs' "$@"
            '';
          };

          native-core-artifacts = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-native-core-artifacts";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = with pkgs; [
              bash
              clang
              cmake
              gnumake
              libuv
              llvm
              nodejs_22
              openssl
              patchelf
              pkg-config
            ];
            dontConfigure = true;
            dontBuild = true;
            dontFixup = true;

            installPhase = ''
              runHook preInstall
              export LEAN_NATIVE_HOST_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_NATIVE_SOURCE='${wasmToolchain.leanSource}'
              node scripts/build-native-ffi-artifacts.mjs --output "$out"
              runHook postInstall
            '';
          };

          wasi-component-artifacts = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-wasi-component-artifacts";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = with pkgs; [ clang nodejs_22 patchelf wasm-tools ];
            dontConfigure = true;
            dontBuild = true;
            dontFixup = true;
            installPhase = ''
              runHook preInstall
              node scripts/build-wasi-component-artifacts.mjs \
                --native '${native-core-artifacts}' \
                --wasmtime '${wasmtimeCapi}' \
                --output "$out"
              runHook postInstall
            '';
          };

          universal-release-bundle = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-universal-release-bundle";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = [ pkgs.nodejs_22 ];
            dontConfigure = true;
            dontBuild = true;
            dontFixup = true;

            installPhase = ''
              runHook preInstall
              revision='${builtins.substring 0 40 (self.rev or (self.dirtyRev or "0000000000000000000000000000000000000000"))}'
              node scripts/build-universal-release-bundle.mjs \
                --core '${universal-core-artifacts}' \
                --native '${native-core-artifacts}' \
                --wasi '${wasi-component-artifacts}' \
                --output "$out" \
                --revision "$revision" \
                --source-date-epoch '1786261809' \
                --builder 'nix-flake-v1'
              runHook postInstall
            '';
            };

          npm-package = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-npm-package";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = [ pkgs.nodejs_22 ];
            dontConfigure = true;
            dontBuild = true;

            installPhase = ''
              runHook preInstall
              node scripts/build-npm-package.mjs \
                --bundle '${universal-release-bundle}' \
                --output "$out"
              runHook postInstall
            '';
          };

          wasi-package = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-wasi-package";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = [ pkgs.nodejs_22 ];
            dontConfigure = true;
            dontBuild = true;
            installPhase = ''
              runHook preInstall
              node scripts/build-wasi-package.mjs --bundle '${universal-release-bundle}' --output "$out"
              runHook postInstall
            '';
          };

          release-rehearsal = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-release-rehearsal";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = [ pkgs.nodejs_22 ];
            dontConfigure = true;
            dontBuild = true;

            installPhase = ''
              runHook preInstall
              node --experimental-permission \
                --allow-fs-read="$PWD" \
                --allow-fs-read='${universal-release-bundle}' \
                --allow-fs-read="$out" \
                --allow-fs-read="$out/*" \
                --allow-fs-write="$out" \
                --allow-fs-write="$out/*" \
                scripts/rehearse-release.mjs \
                  --bundle '${universal-release-bundle}' \
                  --output "$out"
              runHook postInstall
            '';
          };

          php-native-package = pkgs.stdenvNoCC.mkDerivation {
            pname = "lean-alpha-php-native";
            version = "0.0.0";
            src = self;
            nativeBuildInputs = with pkgs; [
              autoconf
              automake
              bash
              clang
              cmake
              gnumake
              libtool
              libuv
              llvm
              nodejs_22
              openssl
              patchelf
              php82
              php82.unwrapped.dev
              pkg-config
            ];

            dontConfigure = true;
            dontBuild = true;
            installPhase = ''
              runHook preInstall
              export LEAN_NATIVE_HOST_PREFIX='${wasmToolchain.leanHost}'
              export LEAN_NATIVE_SOURCE='${wasmToolchain.leanSource}'
              node scripts/build-php-native-package.mjs \
                --manifest poc/lean-link-spike/bindings/php-native.package.json \
                --output "$out"
              runHook postInstall
            '';
          };
        };
        in
        portablePackages // x86WasmPackages);

      apps = forAllSystems (pkgs:
        nixpkgs.lib.optionalAttrs (pkgs.system == "x86_64-linux") {
          component-build-engine = {
            type = "app";
            program = "${self.packages.${pkgs.system}.component-build-engine}/bin/lean-bridge-component-engine";
          };
        });

      checks = forAllSystems (pkgs:
        {
          capsule-graph = self.packages.${pkgs.system}.capsule-graph;
        }
        // nixpkgs.lib.optionalAttrs (pkgs.system == "x86_64-linux") {
          wasm-poc = self.packages.${pkgs.system}.wasm-poc;
          universal-core-artifacts = self.packages.${pkgs.system}.universal-core-artifacts;
          native-core-artifacts = self.packages.${pkgs.system}.native-core-artifacts;
          wasi-component-artifacts = self.packages.${pkgs.system}.wasi-component-artifacts;
          universal-release-bundle = self.packages.${pkgs.system}.universal-release-bundle;
          npm-package = self.packages.${pkgs.system}.npm-package;
          wasi-package = self.packages.${pkgs.system}.wasi-package;
          release-rehearsal = self.packages.${pkgs.system}.release-rehearsal;
          php-native-package = self.packages.${pkgs.system}.php-native-package;
        });
    };
}
