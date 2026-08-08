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
    };
}
