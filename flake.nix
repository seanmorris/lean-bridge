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

      packages = forAllSystems (pkgs: rec {
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
      });

      checks = forAllSystems (pkgs: {
        capsule-graph = self.packages.${pkgs.system}.capsule-graph;
      });
    };
}
