# Build and publish Perl packages

Prepare a `LeanBridge::Runtime` distribution and one generated distribution per Lean component. Each component declares the runtime dependency and checks its exact native identity when loaded.

Set the library's description, authors and URLs in the shared [package metadata](../publishing.md#declare-package-metadata). CPAN emits them in `META.json` and retains them in the installation's `MYMETA` files. Without a declaration, the component uses `Author not declared` and no repository URL.

Component archives retain [source-library and dependency notices](../publishing.md#retain-library-and-dependency-licenses) separately from Lean Bridge's MIT license. The component license field remains `unknown`; shared license-expression configuration is not implemented yet. CPAN defines `unknown` as a missing metadata declaration. Review the license before uploading. [CPAN metadata specification](https://perldoc.perl.org/CPAN::Meta::Spec#license).

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

For APIs that also fit npm's primitive profile, [select npm and CPAN together](npm.md#build-npm-and-cpan-together). The combined build uses one captured source tree and exposes both package sets only after their source APIs agree. Its CPAN archives live under `profiles/native/archives/`. Keep a CPAN-only build for native records, arrays, resources and callbacks.

### Export a specialized closure

The native builder accepts the shared [finite specialization configuration](../lean/existing-package.md#export-concrete-specializations). For example, define a generic function in `Library.lean`:

```lean
universe u
def Library.makeAdder {α : Type u} [Add α] (base : α) : α → α :=
  fun value => base + value
```

Select its concrete type and give the resulting export an arity:

```json
{
  "schemaVersion": 1,
  "modules": ["Library"],
  "exports": ["Library.makeWordAdder"],
  "specializations": [
    { "name": "Library.makeWordAdder", "declaration": "Library.makeAdder", "types": ["UInt32"] }
  ],
  "arities": { "Library.makeWordAdder": 1 },
  "contracts": {
    "Library.makeWordAdder": {
      "parameters": [{ "ownership": "copy", "lifetime": null }],
      "result": { "ownership": "lease", "lifetime": { "scope": "explicit", "anchor": null } },
      "effects": []
    }
  },
  "targets": { "cpan": { "module": "LeanBridge::Library", "version": "0.001" } }
}
```

Lean resolves the `Add UInt32` instance. The arity belongs to the configured name, `Library.makeWordAdder`, and counts only runtime arguments. Here it preserves the returned closure after `base`. Build with the usual CPAN command, install both prepared distributions, then call:

```perl
use LeanBridge::Library;

my $add_seven = LeanBridge::Library::make_word_adder(7);
print $add_seven->call(35), "\n"; # 42
$add_seven->close;
```

The contract requires a copied argument and a returned closure lease. An export taking a resource or callback instead uses `"ownership": "borrow"` with `"lifetime": { "scope": "call", "anchor": null }`. Callback arguments also require `["host-call", "fails"]` when `effects` is declared; returning a Lean closure alone does not. Lean and package staging check these requirements against the implemented adapter. Declaring a transfer, retained host callback, anchored borrow or checked refinement constructor currently fails. See the [complete contract rules](../lean/existing-package.md#declare-export-contracts).

Specializations can also use named aliases for supported copied arrays, records, resources and callbacks. Existing ownership rules still apply: a resource inside a copied array or record requires an explicit ownership policy, and callbacks inside copied containers require a retention policy. Those shapes remain rejected. The metadata records the concrete application and its original declaration; native compilation reproduces that report after compiling the adapter and before linking.

### Build with locked Lake dependencies

Keep the reviewed `lake-manifest.json` beside `lean-toolchain`. Supply each local path dependency at its recorded relative path and each Git checkout in the lock's package cache directory, normally `.lake/packages/<name>`. Git pins must contain the full commit hash. Install Git so the builder can verify the cached commit, tree, and file contents. The build does not fetch packages or update the lock.

For a project with a lock, the native builder captures the root project and every locked dependency, including inherited entries. It stages those inputs privately, evaluates the captured Lake configuration, and uses Lean's import parser to resolve module ownership and compilation order. It compiles imported dependency modules from source before extracting the selected public API from fresh interfaces. Existing `.lake` build caches do not supply compiled interfaces.

Both `lakefile.toml` and `lakefile.lean` work. Root and dependency libraries may use custom source directories; a Git subdirectory package can use sibling source files inside its captured checkout. Select actual Lean module names in the shared configuration, as described under [custom source directories](../lean/existing-package.md#select-modules-in-a-custom-source-directory). Dependency toolchains must match Lean 4.32.2.

This build path supports Lean dependencies and [declared C inputs](../lean/existing-package.md#declare-c-link-inputs). Each selected C file compiles once for `native-library-v1` and is reused across the package's XS variants. `native-component.json` records its compiler, include closure, and object hashes under `nativeCompilation`. See the [C-input acceptance record](../evidence/lake-c-inputs-20260911.md).

Locked builds also accept [declared `lean-text-v1` generators](../lean/existing-package.md#generate-lean-and-c-sources). The native builder runs selected pure tools and compiles their Lean/C/header outputs once before projecting XS variants. `native/component/lake-generated-sources.json` records their bytes and receipts, and the CPAN archive includes the same file. Installed Perl users do not run Lean, Lake, or the generator. See the [generated-package acceptance](../evidence/lake-generated-packages-20260912.md).

The [selected public module may itself be generated](../lean/existing-package.md#generate-the-public-entry-module). Declare its module name and exact root-owned output path, with no captured file at that path. The builder generates it, resolves its imports, and extracts the selected API from freshly compiled interfaces. Aliases and inferred result types resolve through Lean. `sourceIdentity.request.exportModules` records the public roots separately from the compiled dependency closure. See the [generated-entry acceptance](../evidence/lake-generated-entries-20260912.md).

Missing pins, changed Git inputs, ambiguous modules, package overrides, symlinks, undeclared custom targets, prebuilt native libraries, precompiled modules, and extra compiler/linker flags fail explicitly. Reviewed foreign-function contracts still need builder support.

`native/component/native-component.json` records the dependency snapshot and Lake resolution under `sourceIdentity.lakeDependencies`. Their hashes bind the locks, source files, compiler, resolver, and Lake library to the component model; `sourceIdentity.modules` records each freshly compiled interface hash. A dependency edit during compilation rejects the output. Review these identities when comparing relocated builds.

Lake configuration and Lean elaboration execute code. Private staging keeps normal builds out of the author tree; it is not an operating-system sandbox for hostile source. Use an isolated build environment for projects you do not trust.

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
