{ pkgs }:

let
  leanVersion = "4.32.2";
  leanCommit = "f3b06c705e6c85f5314019d5d3baab0fec5b580c";
  libuvCommit = "e9f29cb984231524e3931aa0ae2c5dae1a32884e";
  emscriptenVersion = "6.0.6";
  emscriptenRelease = "833aa203ba2283fc2b6adb504a79a3a0d692df81";
  nodeVersion = "24.19.0";

  leanArchive = pkgs.fetchurl {
    url = "https://github.com/leanprover/lean4/releases/download/v${leanVersion}/lean-${leanVersion}-linux.tar.zst";
    hash = "sha256-XyBp5vXbc3gPN0zLSc6OpkmqIKDOvwEWgWdEyZnOcqo=";
  };

  leanSourceArchive = pkgs.fetchurl {
    url = "https://github.com/leanprover/lean4/archive/${leanCommit}.tar.gz";
    hash = "sha256-qyMivM12U1q1PfgBmwfaWWQxvuMoGaw/wc+snOZ7Rek=";
  };

  libuvSourceArchive = pkgs.fetchurl {
    url = "https://github.com/libuv/libuv/archive/${libuvCommit}.tar.gz";
    hash = "sha256-Jtf1Wk1zHP5A42sD1YAAQ59SOnXewCkKbotG9iWSWrE=";
  };

  emscriptenArchive = pkgs.fetchurl {
    url = "https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/${emscriptenRelease}/wasm-binaries.tar.xz";
    hash = "sha256-bLfPRa2FsLm0ZqRMxLtl7zgOR/BAznPm+Va954J4f0Y=";
  };

  nodeArchive = pkgs.fetchurl {
    url = "https://storage.googleapis.com/webassembly/emscripten-releases-builds/deps/node-v${nodeVersion}-linux-x64.tar.xz";
    hash = "sha256-FLNC5xIE+BG95hU76OBLYq72PCNv75K1X5yDFUtAlkc=";
  };

  leanHost = pkgs.stdenv.mkDerivation {
    pname = "lean-host";
    version = leanVersion;
    src = leanArchive;
    nativeBuildInputs = [ pkgs.autoPatchelfHook pkgs.zstd ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib ];
    dontConfigure = true;
    dontBuild = true;
    unpackPhase = ''
      tar --zstd -xf "$src"
    '';
    installPhase = ''
      mkdir -p "$out"
      cp -a lean-${leanVersion}-linux/. "$out/"
    '';
  };

  leanSource = pkgs.runCommand "lean-source-${leanCommit}" { } ''
    mkdir -p "$out"
    tar -xzf ${leanSourceArchive} --strip-components=1 -C "$out"
    printf '%s\n' '${leanCommit}' > "$out/.lean-wasm-source-commit"
  '';

  libuvSource = pkgs.runCommand "libuv-source-${libuvCommit}" { } ''
    mkdir -p "$out"
    tar -xzf ${libuvSourceArchive} --strip-components=1 -C "$out"
    printf '%s\n' '${libuvCommit}' > "$out/.lean-wasm-source-commit"
  '';

  node = pkgs.stdenv.mkDerivation {
    pname = "emsdk-node";
    version = nodeVersion;
    src = nodeArchive;
    nativeBuildInputs = [ pkgs.autoPatchelfHook ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib ];
    dontConfigure = true;
    dontBuild = true;
    unpackPhase = ''
      tar -xJf "$src"
    '';
    installPhase = ''
      mkdir -p "$out"
      cp -a node-v${nodeVersion}-linux-x64/. "$out/"
    '';
  };

  emscriptenUpstream = pkgs.stdenv.mkDerivation {
    pname = "emscripten-upstream";
    version = emscriptenVersion;
    src = emscriptenArchive;
    nativeBuildInputs = [ pkgs.autoPatchelfHook pkgs.xz ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib pkgs.zlib ];
    dontConfigure = true;
    dontBuild = true;
    unpackPhase = ''
      tar -xJf "$src"
    '';
    installPhase = ''
      mkdir -p "$out"
      cp -a install/. "$out/"
      # The emsdk installer normalizes the release archive's development
      # marker to the selected release version.  Reproduce that step so the
      # immutable Nix toolchain emits the same producer metadata as an
      # `emsdk install ${emscriptenVersion}` bootstrap.
      chmod u+w "$out/emscripten/emscripten-version.txt"
      printf '%s\n' '"${emscriptenVersion}"' \
        > "$out/emscripten/emscripten-version.txt"
    '';
  };

  emsdk = pkgs.runCommand "emsdk-${emscriptenVersion}-immutable" { } ''
    mkdir -p "$out/node"
    ln -s ${emscriptenUpstream} "$out/upstream"
    ln -s ${node} "$out/node/${nodeVersion}_64bit"
    printf '%s\n' \
      "NODE_JS = '${node}/bin/node'" \
      "LLVM_ROOT = '${emscriptenUpstream}/bin'" \
      "BINARYEN_ROOT = '${emscriptenUpstream}'" \
      "EMSCRIPTEN_ROOT = '${emscriptenUpstream}/emscripten'" \
      > "$out/.emscripten"
    printf '%s\n' \
      "export EMSDK='$out'" \
      "export EM_CONFIG='$out/.emscripten'" \
      "export EMSCRIPTEN_ROOT='${emscriptenUpstream}/emscripten'" \
      "export EMSDK_NODE='${node}/bin/node'" \
      "export PATH='${emscriptenUpstream}/emscripten:${emscriptenUpstream}/bin:${node}/bin':\"\$PATH\"" \
      > "$out/emsdk_env.sh"
  '';
in {
  inherit
    emsdk
    emscriptenUpstream
    leanCommit
    leanHost
    leanSource
    libuvCommit
    libuvSource
    node;
}
