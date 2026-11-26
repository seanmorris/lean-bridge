# CLR objects in installed NuGet tasks and streams

The [publishing test](../../tests/helpers/dotnet-worker-packages.mjs) installs
the Lean Bridge CLI offline and builds .NET 8 packages from Lean source. The
second package has its own component and assembly identity; even its scalar
function computes a different result. Both components use the same
authenticated host-class registry and resource ledger.

The [consumer](../../tests/fixtures/dotnet-host-workers/Installed.cs) uses
`PackageReference`, not a project reference. The test checks the outer package
receipts, performs an offline restore, moves the compiled client, removes its
source project and NuGet cache, and launches without publisher tools on its
path. Both component load orders are exercised in fresh processes.

**What “closed” means here:** the bound C# calls and callbacks stop being
usable immediately. The test also checks the managed reference tables
immediately after unbind. It does not assume the Lean scheduler has already
released its completion observer on the same instruction. One earlier run
caught a live native identity at this point. The [native watch](../../src/backends/native/task-notification.h)
disables the descriptor when closed; its observer releases the notification
lease on finalization. The test records the count at retirement and requires
it to reach exactly zero within ten seconds. A leaked lease still fails.

- Class-bearing tasks, cursor items, returned `Except` and thrown `EIO`
  preserve the application's object identity. An IO cursor failure reports
  the step declaration and the Lean message.
- A retained callback runs on the CLR owner, collects garbage, calls the peer
  and returns the original object. Disposing its own active binding is refused.
  The test distinguishes propagation of the original callback exception,
  recovery by Lean, and a null callback return rejected by the bridge.
- Closing one binding cancels its pending callback without invoking it. Its
  sibling's callback completes. A retained cold stream releases its argument
  on unbind and cannot start against a reopened binding.
- Stopping the owner loop cancels outstanding work without closing the
  bindings. Injecting a fatal callback exception retires the runtime for both
  packages. Live native identities and private managed references return to
  zero. Changing the shared native class library prevents the client from
  starting.

Both author routes produced the same public Binding IR (SHA-256
`8f6794cb191b952a2f573e511cd4e41f140c2db56e2dbac55db4b40cf29379d8`).
The reviewed source supplies that interface in place of the export list.
All three packages below were built with SDK 8.0.424 on Linux
x86-64. These are local archive hashes, not NuGet.org or hosted CI receipts.

| Source | NuGet archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Ordinary | `52c064f7fc1d6d13fa840cebd6530b156924d206d189bc40b721d20107c1be9d` | `ff2f5b83cbc0370071bf621c7ba81404979afb9d6696e610e9cf142c6187f0bc` |
| Reviewed | `b8d5b11b4519a4487a3c50e1270cfedb7a60eb828ca8a3aead735d87e261bd0e` | `d291a2661d385b8030759b5ecccc92b81fdb153a51fd9b1738a444e865b27067` |
| Independent peer | `012d303141ac43957c485a28c826c0dfe9796f56b87690796b23ba5bb849408a` | `017cb109af2f06e6240b615462e07689f7b110569deca1f5264d64873fd05f77` |

The clean replay used the offline CLI built from `d3a46f1`. All eight
fresh-process load-order checks passed: two orders, twice each, for both
the ordinary and reviewed package paired with the peer. In two runs the
native count at retirement went from one to zero; the other six were
already at zero. Both owner-shutdown checks and both tamper checks passed.
Removing the reviewed declaration’s error-payload ownership caused the CLI
to reject the input without producing a package-set receipt.

Run `npm run test:dotnet-worker-packages` with the pinned Lean compiler and
.NET SDK available to the publisher. See the [compiler and lifetime tests](dotnet-worker-scopes-20261124.md)
for the native transport boundary and scope-specific cancellation behavior.
Set `LEAN_BRIDGE_DOTNET_WORKER_HANDOFFS` to an existing private directory to
keep the package receipts and archives without keeping compilers or NuGet
caches. `LEAN_BRIDGE_DOTNET_WORKER_REPLAYS=2` exercises each load order twice.

## Host objects as arguments and results

The [C# client](../../tests/fixtures/dotnet-host-workers/Installed.cs)
passes an application object to `IdentityNow` and checks the immediate
return with `ReferenceEquals`. It then passes each of two different
objects of equal initial value to `Relay`, returning the *other* object
from the callback. Awaiting each result must give back that other instance.
The distinct-result check cannot pass by echoing the input.

The original [ordinary](dotnet-host-object-positions-20261126/ordinary.json)
and [reviewed](dotnet-host-object-positions-20261126/reviewed.json)
NuGet releases both ran this client with the independent peer, in both
load orders. All four runs drained the native count to zero. These cover
the export argument and result and the callback argument and result.
The [NuGet record packages](dotnet-host-record-fields-20261126.md) separately
exercise application objects in fields.

## File effects through Task and IAsyncEnumerable

Run `npm run test:dotnet-worker-effects` to build and restore a NuGet package
from a local-only feed, relocate the .NET 8 client, then run with no producer
tools on its path. The [C# client](../../tests/fixtures/dotnet-host-workers/Effects.cs)
reads Lean's startup environment value and observes a real file through both
a synchronous call and a `Task<uint>`. Two `MoveNextAsync` calls see separate
file contents. Early `DisposeAsync` writes the finalizer marker; a later
pull and a second disposal leave the replacement marker untouched.

Removing filesystem permission refused the worker, pull and close without
creating a release. Both granted releases passed:

| Build | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary | `1a23085d72ad13c0b29761a9a2896e01b2c63a1a75a32fdd59c25fec20b8f810` |
| Reviewed | `2390ce5c4a503a4e8aa13c8fbfe319b8efd3397fdd4624acb1a71929d04b80aa` |
