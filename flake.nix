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
          packages = with pkgs; [
            bash
            binaryen
            cacert
            clang
            cmake
            curl
            git
            jq
            lld
            ninja
            nodejs_22
            pkg-config
            python3
            wabt
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
              patch
              python3
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
        };
        in
        portablePackages // x86WasmPackages);

      checks = forAllSystems (pkgs:
        {
          capsule-graph = self.packages.${pkgs.system}.capsule-graph;
        }
        // nixpkgs.lib.optionalAttrs (pkgs.system == "x86_64-linux") {
          wasm-poc = self.packages.${pkgs.system}.wasm-poc;
        });
    };
}
