# Build and publish Perl packages

Prepare a `LeanBridge::Runtime` distribution and one generated distribution per Lean component. Each component declares the runtime dependency and checks its exact native identity when loaded.

## Build an ordinary Lean project

Use the native Perl row in [author setup](../lean/setup.md): Node 22, Lean 4.32.2, a C compiler, and the selected Perl interpreters. This path does not use the npm Wasm runtime. Add the shared `lean-bridge.exports.json` at the Lean project root:

```json
{
  "schemaVersion": 1,
  "modules": ["Workshop"],
  "resources": ["Workshop.Counter"],
  "arities": {
    "Workshop.makeAdder": 1,
    "Workshop.keepCallback": 1,
    "Workshop.newRunner": 1
  },
  "targets": {
    "cpan": {
      "module": "LeanBridge::Workshop",
      "version": "0.001"
    }
  }
}
```

This example names declarations from the Workshop acceptance project. Replace them with your own. `resources` selects heap-identity types instead of copied records. `arities` distinguishes a function returning a closure from a function taking more arguments. An optional `exports` array selects exact public declarations; otherwise public definitions in the selected modules are discovered and checked. Unsupported exports fail before packaging.

Module and export selection belong to the [shared author configuration](../lean/existing-package.md#configure-exports). Only the package name and CPAN version belong under `targets.cpan`.

Build on x86-64 Linux with glibc 2.38 or newer:

```sh
lean-bridge build --project /path/to/project --target cpan --output /path/to/new-release
```

`LEAN_BRIDGE_LEAN_PREFIX` can select the installed Lean 4.32.2 toolchain. Set `LEAN_BRIDGE_PERLS` to a JSON array of absolute interpreter paths to include several prebuilt ABIs. The build compiles the Lean component once and reuses it for every XS variant. With no override it uses `perl` from `PATH`.

The Nix entry point supplies the pinned upstream toolchain:

```sh
nix run .#perl-build-engine -- --project /path/to/project --output /path/to/new-release
```

The output contains `native/runtime`, `native/component`, prepared distributions under `packages`, and the two `.tar.gz` files and checksum receipts under `archives`. `native-release.json` records the component, runtime, Binding IR and archive identities. The native profile is `native-library-v1`; it does not alter the WebAssembly side-module ABI.

## Verify the release candidate

Before publication:

1. Build twice in independent directories and compare archive and native-library digests.
2. Run the installed consumer suite for threaded and nonthreaded Perl 5.36.3 and 5.38.2. Exercise `prebuilt-only`, `auto`, and `build-xs`.
3. Verify that prebuilt installation invokes no compiler and that fallback compiles XS only. Missing headers, corrupt artifacts and runtime mismatches must fail.
4. Run the warmed installed benchmark. Compare with direct C calls into the same Lean library; report conversion and callback costs separately from scalar calls.
5. Review generated POD, `META.json`, `MANIFEST`, native input inventories and the install receipts. Archive assembly must have no compiler access.

The repository's [Perl acceptance matrix](../contributing/testing.md#perl-packages) uses checksummed Perl source releases. The compatibility versions do not replace your organization's supported-Perl security policy.

For a local handoff, distribute both archives and the authenticated receipt. No registry account or namespace reservation is needed to test installation. See [Perl consumption](../consume/perl.md).

## Publish to CPAN

Create a [PAUSE account](https://pause.perl.org/pause/query?ACTION=request_id) and verify ownership or co-maintainer permission for **every public package namespace** in the distributions. Do not upload the example names as your own product. New namespaces acquire an owner on first upload; existing ones require permission. Review the [PAUSE operating model](https://pause.perl.org/pause/query?ACTION=pause_operating_model) before selecting names.

Upload the reviewed runtime archive first through PAUSE's **Upload a file to CPAN** form. Wait for its indexing report, then upload the component archive. Use the exact candidate bytes; do not run another build during upload. PAUSE distributes uploaded files to CPAN mirrors and checks indexing permissions. [PAUSE publication guide](https://pause.perl.org/pause/query?ACTION=pause_04about)

Use a new version for every release. A decimal version such as `0.001` is a normal release; an underscore version such as `0.001_01` marks a developer release. PM, XS, metadata and archive filenames must agree on the component version. The shared runtime has its own version and compatibility identity; a component-only release does not advance it. The generated metadata distinguishes testing from stable releases. [Perl version documentation](https://perldoc.perl.org/version)

This backend creates archives; `lean-bridge publish` does not currently upload to PAUSE. A CI upload job needs a separately approved PAUSE credential and destination. Keep credentials out of source files, build receipts and logs. No publication is performed by the build or consumer CI.

## Download and consume the published bytes

After PAUSE confirms indexing, download each archive from the exact author path reported by PAUSE. Compare its SHA-256 digest with the reviewed receipt, then install in a clean local Perl library using `cpanm`. Confirm that the component's dependency resolves to the intended runtime and run the documented application.

If a CPAN client finds no compatible prebuilt XS, it may compile the supplied XS using the consumer's Perl development environment. It may not replace or rebuild the Lean runtime or component library. A failed hash or runtime check is a release problem, not a reason to bypass verification.

## Recover an interrupted publication

Check PAUSE's upload and indexing reports before retrying. Download an existing archive and compare it with the reviewed digest. If the bytes arrived but indexing failed, resolve namespace permissions with the responsible owner; rebuilding does not fix permission failures.

Do not replace different bytes under the same release version. Correct the source or metadata, choose a new version, rebuild, and repeat the installed checks. Keep runtime and component versions independent, preserve the original records, and verify that consumers resolve the intended runtime before announcing the release.

### Publish Perl packages to CPAN

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
