# Build and publish WIT / WASI packages

Prepare WIT declarations, a Component Model adapter, a Wasmtime host, and native Lean libraries, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

The `wit-wasi` target accepts copied primitives, arrays, Lists, records, options, results, binary products, aliases and concrete tagged variants, including finite recursive values and synchronous callbacks and returned Lean functions carrying them. Consumers receive the compiled component, a generated Wasmtime embedding library, headers, shared native runtime, compiler evidence and dependency licenses. The target builds for Linux x86-64 with glibc 2.38 or newer.

Callable signatures support all nineteen primitives, copied containers and one through sixteen arguments. Use an [arity decision](../lean/export-decisions.md) when an export returns a partially applied function. Host callbacks are call-borrowed; returned Lean functions have explicit leases. Resource-containing values require the [explicit ownership configuration](#export-resource-containing-values) below. Retained host borrows and asynchronous results remain unsupported. The [consumer guide](../consume/wit-wasi.md#callbacks-and-returned-lean-functions) describes the copied-value session API and cleanup.

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

Repeat `--target` to add C, C++, Cargo, PyPI, CPAN, NuGet, Maven, RubyGems, native PHP, PHP-Wasm or npm. Native targets reuse one Lean compilation; npm and PHP-Wasm add their Wasm compilation. No release directory appears unless every selected target succeeds. Unsupported signatures fail with the source declaration instead of being omitted.

Run `lean-bridge verify --receipt /absolute/path/to/cobalt-release/package-set-receipt.json`, then the [ordinary prepared-package example](../consume/wit-wasi.md#ordinary-project-packages) against the original archive. Distribute the receipt, its `.json.sha256` sidecar and the original `archives/` paths for [Node-only verification](../consume/receive-package.md#verify-a-local-package-set). The receipt checks unsigned local consistency, not publisher identity. The [acceptance evidence](../evidence/native-wit-20260914.md) records relocated builds, installed calls and cleanup checks.

## Export synchronous IO

### When the application owns the objects

Declare the application’s constructors, methods, properties and ownership in the `hostImports` file. Set the resource’s host target to `wit-wasi` and import the generated `LeanBridge.Host.WitWasi` module in Lean. For example:

```json
{
  "schemaVersion": 1,
  "modules": ["Workshop"],
  "exports": ["Workshop.make", "Workshop.update"],
  "hostImports": "lean-bridge.hosts.json",
  "targets": {"wit-wasi": {"name": "workshop", "version": "1.0.0"}}
}
```

Set `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` to the pinned Wasmtime **51.0.0** Linux x86-64 SDK and `LEAN_BRIDGE_WASM_TOOLS` to wasm-tools **1.245.1**. The SDK variable names the shared publisher toolchain; it does not change synchronous Lean IO into an asynchronous API. Run the usual `lean-bridge build --project . --target wit-wasi --output release` command. To publish a reviewed API, include the matching public `.binding-ir.json` file beside the export configuration.

Distribute the archive and package-set receipt together. Synchronous selections use `native-wit-object-io-v1`; see [how the two guest components fit together](../consume/wit-wasi.md#call-synchronous-io).

To return a function, select its factory in `exports`. A declaration such as
`remember (captured : Box) : IO (Box → IO Box)` generates an owned WIT
resource with `invoke` and `close` methods. Lean owns the function body; the
object keeps its original guest identity. Do not declare the returned function
as an imported callback or list the factory in `taskExports`.

For a synchronous IO export that accepts or returns a structure containing
guest-owned objects, include its defining Lean module in `modules`. The build
reads the constructor and projections from Lean and emits a WIT resource with
a constructor and one getter per field. The reviewed interface must preserve
the original field order, even for two fields of the same box type. See the
[Workshop and Gauge package test](../evidence/wit-host-record-fields-20261126.md).

To let downstream applications [use two synchronous packages together](../consume/wit-wasi.md#share-a-guest-owned-object-between-synchronous-packages), publish each Lean project under distinct WIT package coordinates. Use the same defining host contract and compatible pinned runtime for all of them. The build includes the native adapter and peer runner in each archive. Consumers do not need to link the projects or rebuild either package.

For guest-defined objects used by tasks, keep `hostImports`, include each public factory in `exports`, and select it with `taskExports` or `asyncIterators`. Set `taskIOErrors` for a selected task whose worker can fail with an IO error. This combination builds `native-wit-object-task-v1`: the application consumes canonical WIT futures and streams, while ordinary IO operations stay synchronous. You can explicitly set `targets.wit-wasi.asyncAbi` to `"canonical"`. If a registration is needed, the release also supplies the `registrations` world for the application’s callback provider. Check the selected signatures: this profile supports object-returning futures, a returned `Except` or immediate `EIO` failure carrying an object with a `UInt32` success, an object-to-object retained callback with IO failure, and cursors yielding objects with an optional object-valued step error. See [running the mixed application](../consume/wit-wasi.md#run-an-async-application-with-guest-owned-objects).

You can select copied-value tasks and cursors alongside guest-object workers. For example, a packet factory taking two Lean `ByteArray` inputs can return `result<future<result<list<u8>, list<u8>>>, list<u8>>`. The outer error comes from the factory. The inner result arrives when the worker settles. The copied workers must not call guest members during the factory, pull, or close operation. Select them in the same `taskExports` or `asyncIterators` configuration as the object workers.

You can publish a single object task without a synchronous companion or callback provider. For example, for an echo factory over an application-owned box, select `["Jobs.echo"]` in both `exports` and `taskExports`. In the reviewed route the public selection may come from the Binding IR; keep the task selection and host contract in the configuration.

To [compose two worker releases](../consume/wit-wasi.md#use-two-worker-packages-in-one-application), give each Lean package distinct WIT coordinates and publish each archive independently. Both must use the same defining object contract and compatible native toolchain and runtime. Distribute the complete archive: the package-specific shared library, Wasm adapters, runner and public WIT are already included. The downstream application supplies its object provider and any required callback providers; publishers do not need each other’s Lean source trees.

### Without application-owned objects

Use ordinary `exports` for `BaseIO`, `IO` or `EIO`. Declare the native host
capabilities the code actually needs. For example, the
[Journal fixture](../../tests/fixtures/native-sync-io/Journal.lean)
reads and writes files:

```json
{
  "schemaVersion": 1,
  "modules": ["Journal"],
  "exports": ["Journal.store", "Journal.read", "Journal.choose"],
  "nativeEffects": ["filesystem"]
}
```

For in-memory effects use `"nativeEffects": []`. Build with `--target wit-wasi`
and the tools listed above. The resulting `native-wit-io-v1` archive contains
the component, native host, verified libraries, WIT, headers and `pkg-config`
metadata. A reviewed project can supply its public `.binding-ir.json` instead
of listing `exports`; the builder checks the review against compiled Lean.
This profile takes one target per build. It also accepts synchronous iterators:
list each factory in `exports` and name its checked `open`, `next` and `close`
declarations in `iterators`. For example, [Dials](../../tests/fixtures/native-immediate-cursor/Dials.lean)
uses `{"open":"Dials.sequence","next":"Dials.next","close":"Dials.finish"}`.
The pull returns an immediate `Option`, not a `Task`. The finalizer's file
write requires the filesystem grant even if the consumer exits the loop early.
Do not mix immediate iterators with scheduled exports or application-owned
objects. Select the task or object profile for those packages.

The grant is an author-side admission check, not a WASI sandbox. For example,
a permitted file write uses the host process's filesystem permissions. An
undeclared native effect stops the build. Distribute the receipt and archive
as above. See [calling synchronous IO](../consume/wit-wasi.md#call-synchronous-io)
for results and traps, and the [installed archive checks](../evidence/wit-sync-io-packages-20261123.md)
for the ordinary and reviewed builds.

## Export asynchronous tasks

For a Wasm guest that consumes Component Model futures or streams, select `targets.wit-wasi.asyncAbi: "canonical"`. Omit it for the native host’s typed task-resource profile, which also supports retained callbacks.

```json
{
  "schemaVersion": 1,
  "modules": ["Meter"],
  "exports": ["Meter.immediate"],
  "taskExports": ["Meter.immediate"],
  "targets": {
    "wit-wasi": {"name": "meter", "version": "1.0.0", "asyncAbi": "canonical"}
  }
}
```

Use the normal native Lean author toolchain and wasm-tools 1.245.1. Set `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` to the extracted [Wasmtime 51.0.0 Linux x86-64 C SDK](https://github.com/bytecodealliance/wasmtime/releases/tag/v51.0.0), then build with `lean-bridge build --project . --target wit-wasi --output release/wit`. The builder verifies the SDK headers, shared library and license before compiling the launcher. The default profile’s Wasmtime 42 SDK is unchanged.

The canonical profile accepts `pure`, `BaseIO`, `IO` and `EIO` task factories and synchronous companion functions. Use `Bool`, `Char`, `String`, `ByteArray`, fixed-width integers and floats for inputs. Results and typed errors may also contain nested `Except` values. Use `ByteArray` for binary input, future results, stream items or typed errors: the WIT type is `list<u8>`, with no UTF-8 conversion. String and byte arguments share a 16 MiB limit per call.

Select `taskIOErrors` for a task whose worker can fail with `IO.Error`; this adds a result **inside** the future, distinct from the factory’s result. Each factory admits 64 outstanding futures; a write keeps its slot until read or dropped. For copied values, distribute the original archive and receipt; consumers get [a WIT world and ready-to-run launcher](../consume/wit-wasi.md#await-a-canonical-future-from-a-wasm-application). Tasks that take retained callbacks use a separate pair of guest worlds.

When a guest drops a future reader, the launcher requests cancellation of any pending Lean task. Check `IO.checkCanceled` inside the worker at a point where it can safely stop. Withdrawing only a read keeps the task available for a later read. The [Watch task](../../tests/fixtures/wit-canonical-cancel/Watch.lean) demonstrates both outcomes.

### Publish tasks that call back into a Wasm guest

For a standalone set of callback-bearing tasks, select `asyncAbi: "canonical"`.
Put each task declaration in `taskExports`. For example, [Budget.single](../../tests/fixtures/javascript-once-callback/Budget.lean)
takes a `UInt32 → IO UInt32`. To allow at most one call to its `f` parameter per
task, add `{"declaration":"Budget.single","parameter":"f","invocation":"once"}`
to `taskCallbackPolicies`. The first attempt spends that allowance even when
the guest returns an error. An unlisted parameter can be invoked repeatedly.

The archive's `wit/application.wit` defines both `callback-provider` and
`application`. Its methods return a future whose error variant distinguishes
factory, worker, guest and invocation-policy failures as applicable. Even a
factory failure arrives through the future on this route. Do not mix unrelated
exports, cursors or synchronous companion functions into this standalone
callback package: the builder rejects a package it cannot represent in full.
See [how to run both guest components](../consume/wit-wasi.md#use-a-guest-owned-callback-with-a-canonical-future).

### Publish a canonical stream

Select the cursor implementation with `asyncIterators`. You can publish a cursor without any `taskExports`, or include tasks in the same world. For example:

```json
{
  "schemaVersion": 1,
  "modules": ["Meter"],
  "exports": ["Meter.feed"],
  "asyncIterators": [
    {"open": "Meter.feed", "next": "Meter.advance", "close": "Meter.finish"}
  ],
  "targets": {"wit-wasi": {"name": "meter", "version": "1.0.0", "asyncAbi": "canonical"}}
}
```

Only the factory is public. The [Lean source](../../tests/fixtures/wit-task-package/cursors.lean) supplies the pull and cleanup functions. A factory failure is outside the stream. A declared step failure is one final error element; normal exhaustion emits no element. An `Except` inside an item remains an ordinary value. Reviewed builds check the identities of all three functions, including cleanup.

A pull can also return `BaseIO (Task (Except IO.Error (Option α)))`.
For example, [Watch.pull](../../tests/fixtures/wit-cursor-io/Watch.lean)
delivers an item and later throws `IO.userError "boom"`. The compiler
records the pull's IO failure separately from a declared `Except String`.
No `taskIOErrors` selection is needed for a cursor. In a canonical stream,
the final element carries the UTF-8 error message; in a pollable package
the corresponding observation is `io-failed(string)`.

If a pull starts a worker, use `IO.checkCanceled` at a point where it is
safe to stop. Closing a cursor releases the reader's claim on the result;
it does not interrupt arbitrary Lean code. The [Watch cursor](../../tests/fixtures/wit-canonical-cancel/Watch.lean)
lets its caller observe cursor cleanup separately from the worker's exit.

### Typed task resources

Select Lean declarations returning `Task α`, `BaseIO (Task α)`, `IO (Task α)` or `EIO ε (Task α)` with `taskExports`. Arguments can be `Bool`, `Char`, `String`, `ByteArray`, fixed-width signed or unsigned integers (8–64 bits), `Float32`, or `Float`. Results and typed factory errors can also contain nested `Except` over those types. An `IO` or `EIO` factory has a fallible start operation: success yields an owned task, and failure yields the error without creating a task.

`ByteArray` becomes WIT `list<u8>` in task and cursor results, typed errors, and retained callback arguments and replies. It is copied, not decoded as text. The pollable profile’s 16 MiB conversion budget counts Wasmtime’s tagged element storage as well as the packed bytes; it is not a 16 MiB payload allowance.

For a worker returning `Task (Except IO.Error α)`, also list the declaration in `taskIOErrors` to expose `IO.Error` as a terminal failure of that task. The host receives the message as text. A normal returned `Except` remains a value, even when its error uses the same scalar type as a factory failure. The [Lean example](../../tests/fixtures/wit-task-package/effects.lean) shows both declarations. External capabilities are not part of this profile.

A task can also take a retained host function, such as the `UInt32 → IO UInt32` parameter in [Meter.through](../../tests/fixtures/wit-task-package/retained-phase.lean). Select the task in `taskExports` and, for this example, `taskIOErrors`. The generated start returns an owner immediately; factory errors arrive when the consumer observes that task. The checked WIT world gives each callback parameter its own request type. The installed C API dispatches those requests as [typed store-thread callbacks](../consume/wit-wasi.md#give-a-task-a-host-callback).

For a pollable task, add an entry to `taskCallbackPolicies` to admit at
most one invocation of a named parameter:

```json
"taskCallbackPolicies": [
  { "declaration": "Budget.probe", "parameter": "f", "invocation": "once" }
]
```

The first attempt consumes the allowance even if the callback throws. Other
parameters keep their own policy. The public WIT observation for a second
attempt is `callback-already-invoked`, distinct from a callback returning
an error with that text. This option does not select canonical futures.

To pass a Lean object rather than a copy, add its qualified declaration to `resources` in each package that uses it. For example, Peer selects `"resources": ["Shared.Ticket"]` and `"taskExports": ["Peer.bump"]`. The [Lean implementation](../../tests/fixtures/javascript-wasm-resource-tasks/Peer.lean) takes a Ticket, changes its count, and returns the same Ticket in a task. A task argument borrows the object. A direct task result, cursor item, typed factory error, or terminal pull error can return an owned object. This does not admit arbitrary objects nested inside copied aggregates.

Build both packages against the same defining module and compiler. Lean Bridge derives the resource identity from these inputs; matching field layouts are not enough. The build packages the shared lease library automatically. See [how consumers pass the object between packages](../consume/wit-wasi.md#pass-a-lean-object-between-task-packages).

```json
{
  "schemaVersion": 1,
  "modules": ["Meter"],
  "taskExports": ["Meter.immediate", "Meter.parked", "Meter.resume"],
  "targets": { "wit-wasi": { "name": "meter", "version": "1.0.0" } }
}
```

Run `lean-bridge build --project . --target wit-wasi --output build/release` with the pinned Lean compiler, wasm-tools and Wasmtime C SDK described above. Verify the handoff with `lean-bridge verify --receipt build/release/package-set-receipt.json`. Distribute that receipt and the archive listed inside it. The prepared release includes the typed header, component, native libraries and `meter-wit.pc`; consumers do not repeat the producer build. A reviewed project can also supply a public `.binding-ir.json`; the CLI still checks it against fresh compiler output. See the [consumer example](../consume/wit-wasi.md#await-a-lean-task).

## Export a pull cursor

Select the three Lean declarations that open, advance and close your cursor in `lean-bridge.exports.json`. A package containing only cursors needs neither `taskExports` nor an `exports` list.

```json
{
  "schemaVersion": 1,
  "modules": ["Meter"],
  "asyncIterators": [
    { "open": "Meter.feed", "next": "Meter.advance", "close": "Meter.finish" }
  ],
  "targets": { "wit-wasi": { "name": "meter", "version": "1.0.0" } }
}
```

The factory returns a concrete cursor type defined in your module, directly or in `BaseIO`, `IO` or `EIO`. For a cursor `C`, the other declarations have these signatures:

| Declaration | Lean signature | Consumer behavior |
| --- | --- | --- |
| `next`, no declared pull failure | `C → BaseIO (Task (Option α))` | `some` delivers an item; `none` ends the sequence. |
| `next`, typed pull failure | `C → BaseIO (Task (Except ε (Option α)))` | `Except.error` ends the sequence with a typed failure. |
| `close` | `C → BaseIO Unit` | Releases the cursor on exhaustion, failure, cancellation or early drop. |

The [Meter declarations](../../tests/fixtures/wit-task-package/cursors.lean) use `UInt32` for a factory failure and `UInt16` for a failed pull. An item of type `Except String Int64` still arrives as an item, including its text-error arm. The build checks the three selected declarations against Lean compiler output and any supplied review. Use the same build and verification commands as for tasks. The [consumer example](../consume/wit-wasi.md#pull-an-asynchronous-sequence) uses the generated header.

## Export resource-containing values

Declare resource types and opt into aggregate ownership when records, variants,
containers or recursive values contain resource identities:

```json
{
  "schemaVersion": 1,
  "modules": ["Owned"],
  "resources": ["Owned.Ticket"],
  "ownedAggregates": {
    "ownership": "lease",
    "disposal": "required",
    "fallback": "queued-finalizer",
    "cycles": "reject"
  },
  "exports": ["Owned.newTicket", "Owned.serial", "Owned.echoRecord"],
  "targets": {
    "wit-wasi": { "name": "owned-values", "version": "1.2.3" }
  }
}
```

Use the same `lean-bridge build --target wit-wasi` command. The builder compiles
the selected Lean implementation, generates the owned Component Model and typed
public C API, builds the pinned GMP source, and bundles GMP, Wasmtime and the
shared Lean runtime. The archive includes pkg-config and CMake metadata,
compiler receipts, generated sources, dependency licenses and GMP's corresponding
source. Reassembling the archive from verified build artifacts requires no
compiler and preserves its bytes.

Ordinary source extraction and independently reviewed version-4 binding IR use
the same ownership-aware build path. Inputs borrow resource-containing values
unless an export contract declares a transfer;
results own independent leases and copied storage unless explicitly anchored
to an input owner. Typed synchronous callbacks
support resource arguments and replies, reentry and returned Lean closures.
The [consumer API](../consume/wit-wasi.md#packages-containing-resources) keeps
Wasmtime handles private. Retained host callbacks and asynchronous callbacks
remain unsupported.

Ship the original archive and package-set receipt together. Consumers need a C11
compiler, not Lean, Wasmtime headers from another installation, or a system GMP
package. Keep the bundled shared libraries unchanged; the host rejects loaded
dependencies whose bytes differ from its compiler receipts.

### Transfer input ownership

Add an explicit parameter contract when the Lean export should consume its
caller's owner. For example, add `Owned.retainTicket` to `exports` and include:

```json
{
  "contracts": {
    "Owned.retainTicket": {
      "parameters": [
        { "ownership": "transfer", "lifetime": { "scope": "call", "anchor": null } }
      ]
    }
  }
}
```

Both ordinary configuration and reviewed Binding IR preserve this decision.
The generated C signature adds an owner-slot pointer for each consuming
parameter. The WIT signature uses owned resources, including resource leaves
inside records, containers, variants and recursive values. Borrowed parameters
keep borrowed WIT resources.

The adapter validates all inputs before consuming any owner. It consumes the
original native owners together before entering Lean. Callbacks observe those
owners as consumed even if the call later fails. Returning the value creates
an independent result owner. See the [consumer example](../consume/wit-wasi.md#consuming-inputs)
for whole-owner lifetime and cleanup rules.

Combined C and WIT/WASI builds use the same compiled Lean component and
ownership contracts. The package records its transfer capability in the
compiler-authenticated `ownedValues.inputTransfers` receipt. Keep that receipt
and generated files unchanged when assembling or distributing the archive.

### Anchor a result to an input

Declare a borrowed result when its lifetime should follow one input's original
owner. For example, select `Owned.retainTicket` and add:

```json
{
  "contracts": {
    "Owned.retainTicket": {
      "result": {
        "ownership": "borrow",
        "lifetime": { "scope": "parameter", "anchor": "arg0" }
      }
    }
  }
}
```

Ordinary extraction uses `arg0`, `arg1`, and subsequent parameter positions.
Reviewed Binding IR uses the declared parameter name. The selected anchor must
be a non-copied input that the same call does not consume. Other inputs may
transfer ownership; validation rejects a transfer that would consume the anchor
or one of its ancestors.

The generated public signature takes the original input-owner handle. Result
owners, nested views, empty containers and absent options preserve that lifetime.
The host passes the same native anchor through the Component Model import and
checks it before publishing the result. WIT's owned return handles manage
transport storage, not the source owner's lifetime. Keep the bundled public host
and its component together.

The compiler model and package's `ownedValues.resultAnchors` record the exact
export-to-parameter mapping. Package assembly regenerates that contract and
rejects altered mappings, generated sources or dependency inventories. Combined
C and WIT/WASI builds use the same Lean compilation and ownership declarations.

The [consumer example](../consume/wit-wasi.md#borrowed-results) demonstrates
expiration and independent retention.

### Anchor a callback result to an argument

Put the callback's result decision under `callable`. For a function
`makeRecord (captured : Bundle) : Bool → Bundle → Bundle`, select one outer
argument with `arities`, then anchor each invocation's result to that
invocation's `Bundle` argument:

```json
{
  "arities": { "Owned.makeRecord": 1 },
  "contracts": {
    "Owned.makeRecord": {
      "result": {
        "ownership": "lease",
        "lifetime": { "scope": "explicit", "anchor": null },
        "callable": {
          "result": {
            "ownership": "borrow",
            "lifetime": { "scope": "parameter", "anchor": "arg1" }
          }
        }
      }
    }
  }
}
```

The callback counts its own arguments from zero: `Bool` is `arg0` and `Bundle`
is `arg1`. Captured outer arguments and the private closure handle do not count.
A reviewed contract uses the callback's local parameter names. The selected
argument must have an owned representation and cannot be transferred by that
callback invocation.

The package records callback-local indices separately in
`ownedValues.callbackResultAnchors`. The generated function accepts the selected
argument's original owner; the result expires with that owner. For a host
callback, put the same nested `callable.result` decision on the callback's entry
in `parameters`. The adapter copies replies before the callback frame expires.

Host callback descriptors are enabled by default. To publish a WIT package that
accepts native Lean closures but does not expose host callback descriptors, set:

```json
{
  "targets": {
    "wit-wasi": {
      "name": "owned-values",
      "version": "1.2.3",
      "hostCallbacks": false
    }
  }
}
```

A no-host WIT package must be built as its own target because native projections
in a combined build share one compiled component. The [consumer guide](../consume/wit-wasi.md#results-borrowed-from-a-callback-argument)
describes lifetime and cleanup rules. Installed ordinary and reviewed packages
are covered by the [callback-result acceptance](../evidence/owned-wit-callback-result-packages-20261003.md).

### Export methods and properties

Mark an export's first Lean argument as its receiver. The compiler determines
the receiver's type; the configuration supplies the member and lifetime choices:

```json
{
  "contracts": {
    "Owned.serial": { "receiver": "property" },
    "Owned.retainTicket": {
      "receiver": "method",
      "result": {
        "ownership": "borrow",
        "lifetime": { "scope": "receiver", "anchor": "receiver" }
      }
    },
    "Owned.chooseTicket": {
      "receiver": "method",
      "result": {
        "ownership": "borrow",
        "lifetime": { "scope": "parameter", "anchor": "arg1" }
      }
    }
  }
}
```

Argument names retain their original Lean positions: `arg0` is the receiver and
`arg1` is the first remaining argument. Use receiver scope to anchor a result to
`arg0`; use parameter scope to name another original argument. Reviewed Binding
IR uses its declared parameter names. A property has no arguments after its
receiver and exposes a getter only. Resource and aggregate receivers are
supported, including copied and Unit-valued property results.

Generated WIT and C functions put the typed receiver first. The manifest keeps
the original owner and member kind, while the authenticated
`ownedValues.receiverExports` receipt records the receiver-first convention.
Result-anchor metadata distinguishes the receiver from remaining parameters.
Combined C and WIT/WASI builds use the same compiled Lean component.

A consuming method declares transfer on its receiver. Consumption revokes the
whole original owner before Lean runs; a later failure does not restore it.
Receiver methods do not require callbacks, transfers or borrowed results unless
their declarations use those capabilities. The
[consumer example](../consume/wit-wasi.md#methods-and-properties) demonstrates
receiver and parameter ownership through an installed package.

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
