# Lake generator prerequisite selection, 12 September 2026

This VO1239 milestone follows `1e79186`. The internal prerequisite runner now asks the pinned Lake compiler to select generators and resolve their captured tool modules. Normal CLI package builds still reject nonempty generator configuration. Generated-source integration is the next step.

## Selection and execution

Each package can describe `generators` in its captured `lean-bridge.exports.json`. The [configuration schema](../../schema/lake-generator-configuration.schema.json) limits recipes to a named custom Lake target, the `lean-text-v1` profile, a Lean entry module and declaration, named package-relative text inputs, literal arguments, and exact Lean/C/header output paths. Lake supplies the tool module paths and compilation order. Authors do not supply an executable, shell command, environment override, or module-path override.

For example, an internal test package declares:

```json
{
  "schemaVersion": 1,
  "generators": [{
    "name": "table",
    "profile": "lean-text-v1",
    "module": "TableGenerator",
    "declaration": "TableGenerator.generate",
    "inputs": [{"name": "value", "path": "data/value.txt"}],
    "arguments": ["VALUE"],
    "outputs": [
      {"name": "lean", "path": "generated/Generated.lean"},
      {"name": "header", "path": "native/generated.h"}
    ]
  }]
}
```

The target must exist in the owning package's Lake configuration. A selected library references it through `needs` or `extraDepTargets`. A named package reference must point to the current package or a direct dependency. The resolver validates all declared prerequisites, then executes only the generators required by the selected captured import closure. It invokes the checked pure definition, never the custom Lake target's build body.

An absent generated Lean module can defer source traversal when a declared producer names its exact path. The producer must be selected by a visited library. Selection does not depend on whether that library appears before or after the generated module in an import header. Generator tool modules must be captured and independently compilable. Tools that themselves require generation or native inputs fail. A package-wide prerequisite that also applies to its own tool library consequently fails as a generation cycle in this profile.

The runner materializes and verifies the original capture in private staging. It checks input presence, output collisions, compiler identity, package ownership, tool import order, and the closed selection document before calling the existing [checked generator runner](lake-generators-20260912.md). Unused generators are not compiled or called. Their recipe and target declarations still undergo validation.

## Receipts and remaining integration

The [prerequisite receipt](../../schema/lake-generator-prerequisite-receipt.schema.json) binds the complete snapshot digest, requested root modules, captured configuration identities, resolver source, Lean executable, Lake shared library, selected tool closures, and each generator's receipt digest. Per-generator receipts retain fresh interfaces, checked implementations, compiler-library inventories, requests, and output hashes. Detached receipt validation requires the digest retained by the producing handoff and the independently captured inputs.

Returned files remain in separate generator staging. `verify` checks capture, resolver request, compiler/resolver files, and every generated result. `dispose` removes owned selection and generation directories. Failed selection and execution also remove staging. Original checkout bytes and metadata remain unchanged.

The selector does not traverse newly generated imports or compile the selected application. The next integration must create a verified source overlay, resolve generated imports, and bind generated origin through native and WASM compilation, linking, bundles, and release receipts. Installed npm and CPAN tests must then exercise public APIs whose results depend on generated values. No new consumer type/profile support is claimed by this milestone.

Lake configuration evaluation and Lean macros/initializers retain normal trusted-code behavior. Private staging is not an operating-system sandbox. Arbitrary target execution, `extern_lib`, prebuilt libraries, and extra compiler/linker flags remain unsupported.

## Nix CI corrections

The feature-branch push at `1e79186` exposed two packaging failures in [downstream CI](https://github.com/seanmorris/lean-bridge/actions/runs/34702244899):

- The filtered component engine contained executable modules but omitted its identity manifests and core-source inputs. Request verification failed before compilation. Its Nix source filter now retains the exact executable, identity, and core-source closures. A regression assembles that filtered tree and compares its engine identity with the checkout.
- CPAN packaging copied `Runtime.pm` from the read-only Nix store, then attempted to overwrite the copied file to set its version. It now renders the versioned file directly from the template into writable owned staging. A regression uses read-only copied templates, checks the rendered version and writable output, and confirms the source is unchanged. It also runs as an unprivileged user.

These local checks do not execute Nix. The pushed CI jobs remain the acceptance check for the actual Nix engine builds.

The earlier push's core and complete performance workflows passed. Its other Perl job ended after the runner received a shutdown signal during the locked-workspace suite. That cancellation is separate from the two packaging errors above.

The follow-up run on `0e77730` reached XS compilation, confirming that runtime template rendering succeeded. It then failed because the pinned Perl headers include `crypt.h`, while the shell application's compiler search path omitted libxcrypt's development output. The Perl engine now sets `NIX_CFLAGS_COMPILE` to the pinned libxcrypt include directory through `lib.getDev`. A contract checks that this input reaches the wrapper before the engine starts. Local engine and Perl contracts pass 14 checks; actual Nix compilation requires the next CI run.

## Acceptance results

The compiled prerequisite suite passes all 20 checks as the unprivileged `nobody` user. Root runs pass both relocated generator cases, dependency-owned selection, unused-library selection, and the 15 rejection cases. Each relocated pair produces identical receipts and output bytes; separate Lean and C consumers return `17` for Shop and `29` for Telemetry. Original source inventories retain their contents, modes, timestamps, and Git metadata. Changed generated output fails verification, and repeated disposal succeeds. No selection or generator staging directories remain after the tests.

The recorded identities match across roots and users:

```text
Shop
  snapshot:  768ea53d3c15917d4aefa17d0d6a00cdd93b36de52622a61781b4475ee1eaaec
  selection: ca9f108e7060bdcc7dc0733eda10eb447cbaef80c34ab944db59c85854551a9c
  generator: 234cff20ece41e372017736ca650b44d045ac455978822fb78daaa216a67ad04
Telemetry
  snapshot:  d5a09ada8789005dee3d4f1094d476d53879807ea21041879d34dd36bdb4559e
  selection: d7a233921667b4026bf4903e09b7a55b11420407f2129205a945ad1bdb6fc942
  generator: ba0eea86a133c66935e80c1cdd87a07360608c8b56e71729b3789695f6ae299d
```

Five Node-only generator contracts cover configuration, catalog capture, compiler selection metadata, output limits, and invalid text. The core gate passes lint, checked JavaScript, and 512 contracts. All 52 existing Lake/native checks, all 11 WASM integration groups, and the three native Perl groups pass, including 183 installed Perl API checks. Another 38 compiler/linker/native-input and documentation checks pass. Site tests pass 101 checks, site typechecking covers 79 canonical pages, and all 16 generated references pass.

The versioned inventory still contains 6,562 cells, 2,193 observed cells, 116 installed-tested cells, and 32,230 required stage gaps. Tested source evidence hashes were refreshed after native and WASM acceptance. No cells were promoted.

## Verification commands

After `source scripts/env.sh`:

```sh
node --test tests/lake-generator-contract.test.mjs \
  tests/engine-execution-request.test.mjs tests/perl-contract.test.mjs
LEAN_BRIDGE_LAKE_GENERATOR_TEST=1 node --test \
  tests/lake-generator-prerequisites.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/lake-workspace.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
npm run check:core
```

The glibc override matches the local host. Production retains the 2.38 floor. VO1239 remains open; VO1238 and VO1107/1108 retain the foreign-contract and authoritative-extraction work.
