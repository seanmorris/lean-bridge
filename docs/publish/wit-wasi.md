# Build and publish WIT / WASI packages

Prepare WIT declarations, a Component Model adapter, a Wasmtime host, and native Lean libraries, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

The `wit-wasi` target accepts copied primitives, arrays, Lists, records, options, results, binary products, aliases and concrete tagged variants, including finite recursive values and synchronous callbacks and returned Lean functions carrying them. Consumers receive the compiled component, a generated Wasmtime embedding library, headers, shared native runtime, compiler evidence and dependency licenses. The target builds for Linux x86-64 with glibc 2.38 or newer.

Callable signatures support all nineteen primitives, copied containers and one through sixteen arguments. Use an [arity decision](../lean/export-decisions.md) when an export returns a partially applied function. Host callbacks are call-borrowed; returned Lean functions have explicit leases. Nested functions, identity-bearing copied fields, retained host borrows and asynchronous results remain unsupported. The [consumer guide](../consume/wit-wasi.md#callbacks-and-returned-lean-functions) describes the owning session API and cleanup.

List parameters, results and record fields use canonical WIT `list<T>` values.
Typed Lean helpers preserve the List semantics without inspecting cons-cell
layouts. The [List consumer guide](../consume/wit-wasi.md#lean-lists) explains
ownership and limits; [installed checks](../evidence/wit-lists-20260921.md)
cover ordinary-source and reviewed-IR archives. The compiled component uses
the bundled native Lean host, not a standalone WASI runtime.

Use Lean 4.32.2, a native C compiler, wasm-tools 1.245.1 and the [Wasmtime 42.0.1 x86-64 Linux C API archive](https://github.com/bytecodealliance/wasmtime/releases/download/v42.0.1/wasmtime-v42.0.1-x86_64-linux-c-api.tar.xz). Its SHA-256 is `2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082`. Extract it and set `LEAN_BRIDGE_WASMTIME_C_API` to that directory. The builder checks the library, headers and license against the pinned archive before compilation. Wasmtime is an author-side build dependency and is included in the consumer package.

For a Lake package named `cobalt`, select its exports in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Cobalt"],
  "exports": ["Cobalt.echo_u32"],
  "targets": {
    "wit-wasi": { "name": "cobalt-api", "version": "2.0.0-rc.1" }
  }
}
```

Build into a new directory:

```sh
export LEAN_BRIDGE_WASMTIME_C_API=/absolute/path/to/wasmtime-c-api
lean-bridge build --project /absolute/path/to/cobalt \
  --target wit-wasi --output /absolute/path/to/cobalt-release
```

The archive is `archives/cobalt-api-2.0.0-rc.1-wit-wasi.tar.gz`. Its WIT world imports `lean-bridge:cobalt-api/native@2.0.0-rc.1` and exports `lean-bridge:cobalt-api/api@2.0.0-rc.1`. The supplied host implements the native import with compiled Lean code. The component is not a standalone WASI command.

Repeat `--target` to add C, C++, CPAN, NuGet, Maven, RubyGems or npm. Native targets reuse one Lean compilation; npm adds one Wasm compilation. No release directory appears unless every selected target succeeds. Unsupported signatures fail with the source declaration instead of being omitted.

Run `lean-bridge verify --receipt /absolute/path/to/cobalt-release/package-set-receipt.json`, then the [ordinary prepared-package example](../consume/wit-wasi.md#ordinary-project-packages) against the original archive. Distribute the receipt, its `.json.sha256` sidecar and the original `archives/` paths for [Node-only verification](../consume/receive-package.md#verify-a-local-package-set). The receipt checks unsigned local consistency, not publisher identity. The [acceptance evidence](../evidence/native-wit-20260914.md) records relocated builds, installed calls and cleanup checks.

## Export structured callbacks

Select exports with copied callback arguments or returned functions using the same configuration as other exports:

```lean
namespace Structured
structure Payload where
  text : String
  rows : Array (Option String)
  count : Nat
  nested : Option (Except String (UInt64 × Unit))

def callRecord (value : Payload) (callback : Payload → Payload) := callback value
def makeRecord (captured : Payload) : Bool → Payload → Payload :=
  fun selected value => if selected then captured else value
end Structured
```

For a Lake package named `structured`, use:

```json
{
  "schemaVersion": 1,
  "modules": ["Structured"],
  "exports": ["Structured.callRecord", "Structured.makeRecord"],
  "arities": { "Structured.makeRecord": 1 },
  "targets": {
    "wit-wasi": { "name": "structured", "version": "1.0.0" }
  }
}
```

The arity keeps `makeRecord`'s returned function as an owned closure. Its caller closes the token explicitly; each invocation returns an independent copied value. `callRecord` borrows the host callback only for that call. A review must preserve callback ownership and the original copied type references, including aliases.

Build and distribute the archive as above. The [consumer example](../consume/wit-wasi.md#structured-callback-values) registers a record callback and executes the installed package without Lean tooling.

## Export recursive callbacks

Save this as `Structured.lean` in a Lake library named `structured`:

```lean
namespace Structured

inductive Tree where
  | leaf (value : Nat)
  | branch (children : Array Tree)

def callRecursive (value : Tree) (callback : Tree → Tree) := callback value
def makeRecursive (captured : Tree) : Bool → Tree → Tree :=
  fun selected value => if selected then captured else value

end Structured
```

Select these exports in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Structured"],
  "exports": ["Structured.callRecursive", "Structured.makeRecursive"],
  "arities": { "Structured.makeRecursive": 1 },
  "targets": {
    "wit-wasi": { "name": "structured", "version": "1.0.0" }
  }
}
```

Build with `--target wit-wasi` and distribute the archive and receipt as above.
The arity keeps `makeRecursive`'s result as an owned function. `callRecursive`
borrows its callback for one call. Its callback receives a typed tree and returns
an independently copied tree. The [C example](../consume/wit-wasi.md#recursive-callback-values)
registers that callback and invokes the returned Lean function.

WIT cannot declare recursive types directly. The generated C helpers convert
typed values to finite WIT node tables, cross the compiled component and copy
the result back. Original declarations, aliases and proof metadata remain in
the manifest beside this transport description. Consumers use named types and
export-specific helpers from the generated header.

Recursive conversions reject cycles and enforce 128 nested levels, 262,144
expanded node visits and separate 16 MiB input/output copy budgets. An invalid
input or limit error leaves the result unchanged and the session usable.
Malformed native outputs retire the shared runtime. Resource-containing
aggregates and nested callable fields require separate ownership support.

## Export named copied aliases

Select functions using concrete copied aliases in `exports`, then build with
`--target wit-wasi` as above. No alias-specific configuration is needed:

```lean
namespace Scores
abbrev Count := UInt32
abbrev Counts := List Count
def increment (value : Count) : Count := value + 1
def reverse (values : Counts) : Counts := values.reverse
end Scores
```

The archive preserves the alias names and chains in its WIT source, compiled
component, binding manifest and README. API sites, record fields and variant payloads retain
their original references. Consumers pass
[ordinary target values](../consume/wit-wasi.md#named-copied-aliases).

A reviewed Binding IR contract must retain the alias definitions and references,
not flatten them into primitive or container types. The build compares the
review with fresh Lean metadata. Aliases must remain concrete, immutable copied
values within the existing depth bound. When an alias's WIT spelling matches
a function, the alias receives an `alias-` prefix until its name is distinct.
Other duplicate or reserved type spellings reject at build time.
Acyclic aliases also work in callback signatures, including nested aliases used
only by a callback. Recursive callback payloads and identity-bearing alias
targets still require separate support.

## Export copied variants

Select functions using concrete copied inductives in `exports`. For example:

```lean
namespace Events
inductive Signal where
  | idle
  | data (count : UInt32) (label : String)
  | marker (value : Unit)
def echo (value : Signal) : Signal := value
end Events
```

The generated WIT declares `variant signal` with named `idle`, `data` and
`marker` cases. Nonempty constructors carry named records such as
`signal-data-fields`. A Unit field stays present; it does not collapse into an
empty case. The component binary, binding manifest and README preserve the
same contract. Consumers use [named Wasmtime values](../consume/wit-wasi.md#named-copied-variants).

Reviewed IR must retain each family, constructor, field name and original
field type, including aliases. The build compares this contract with fresh
compiler metadata. Payloads can nest copied primitives, arrays, Lists, records,
options, results, products and other acyclic variants. Existing depth and copy
limits apply, including in acyclic callback payloads. Recursive copied values
use the bounded helpers in the consumer guide. Recursive callback payloads and
identity-bearing fields still need separate support.

The Lean compiler's datatype limits also apply. Lean 4.32.2 supports boxed
constructor tags through 243. Empty constructors can use higher tags. The
installed acceptance fixture uses 257 constructors, with empty cases above
that boundary, to exercise WIT's two-byte canonical tag.

## Check the build inputs

The separate Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata plus the executable WASI adapter. The following bundle commands retain that example's `read-box` API. Use the ordinary-project workflow above for a new package.

## Build the target package

From a Lean Bridge checkout, [build the example bundle](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer). With that bundle at `build/consumer-universal-bundle`, use a new output directory:

```sh
node scripts/build-wasi-package.mjs \
  --bundle build/consumer-universal-bundle --output build/publish-wit-wasi
```

The builder emits `lean-bridge-alpha-wasi-0.0.0.tar.gz`. The package identity and version come from the bundle; change them upstream before generating a public candidate. The tested native runtime is x86-64 Linux with glibc 2.38 or newer.

## Verify installation

Run the complete [WIT / WASI consumer example](../consume/wit-wasi.md) against the produced archive. It installs or links the generated public API without compiling Lean. Keep the platform requirements and verification result with the package.

## Distribute and recover

Use [archive distribution](archives.md#freeze-the-handoff) for checksum records, GitHub Releases, HTTPS hosting, download verification, and interrupted-upload recovery. A universal `wit-wasi` target retains an archive; it does not upload it. Your release owner chooses the destination and approves the exact bytes.

The archive supplies its documented host integration. It does not register a package with Conan, vcpkg, an OCI registry, or another unimplemented package manager. [Signed Nix caches](nix.md) provide an additional channel for declared flake outputs.
