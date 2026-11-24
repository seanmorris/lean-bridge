# Closing a .NET binding with deliveries pending

The [.NET 8 regression](../../tests/helpers/dotnet-task-managed-replay.mjs)
rebuilt the managed scheduler against the two original Lean libraries from the
[Pulse and Signals qualification](dotnet-tasks-20261122.json). It checked the
original receipts, archive digests and native library bytes first. No Lean
source or native binary was rebuilt. The pinned acceptance record's SHA-256 was
`2f4d50a36ce1eb44548e3778be309f0f5da8680968e5741e800780903b1b66b9`.

Using SDK 8.0.424 on Linux x86-64, the original two consumer load orders passed
with zero live native identities. A separate [binding probe](../../tests/fixtures/dotnet-host-workers/ScopeProbe.cs)
held a Lean task and a cursor pull behind a closed gate. Closing their scope
cancelled both deliveries and closed the cursor once. Another scope in the
same assembly kept its pending task and could still enumerate its own stream.
The probe also checked:

- Cold streams can open more than once. Abandoning one releases its captured
  argument without unbinding. Unbinding releases the captured argument even
  when the application still holds the never-opened stream.
- Closing on a different thread or inside the binding's own call fails without
  disturbing pending work. Closing twice releases nothing twice.
- If a cleanup handler throws, later handlers still run and the caller receives
  the first exception object.

Replay with `LEAN_BRIDGE_DOTNET_MANAGED_REPLAY` set to the retained handoff
directory and run `node --test tests/helpers/dotnet-task-managed-replay.mjs`.
This qualifies the managed lifetime mechanism against real Lean workers, not a
new installed NuGet package carrying CLR classes.

## Compiler checks

`npm run test:dotnet-worker-source` builds the
[Lean fixture](../../tests/fixtures/dotnet-host-workers/Workers.lean) from
ordinary source, then repeats with a reviewed binding IR instead of an export
list. Lean 4.32.2 compiled the generated worker entry points to C on both
routes. The identical public IR had SHA-256
`8f6794cb191b952a2f573e511cd4e41f140c2db56e2dbac55db4b40cf29379d8`.
Both routes also linked the generated provider, worker entries, shared class
registry and lease library with undefined native references forbidden. The
test compared the dynamic symbol table with the generator's private ABI list.
A third selection called a CLR member indirectly from a Lean worker; the
compiler rejected it. Carrying a class reference and calling its methods have
different requirements: the callback that invokes application code must run
on the CLR owner.

## Native transport lifetime

The [CLR domain test](../../tests/helpers/dotnet-host-domain.mjs) built two
native components and loaded their managed callers in separate collectible
assembly contexts. In each load order, two bindings in one assembly and a peer
binding in the other used the same application classes. The native DSO for
their shared class registry had the same SHA-256 in both builds:
`f774da0416adeb36b2061e8485d3a08212d2a9f8b5a49167aeae35c995f512bf`.

Inside one owner call, resolving the transport token returned the original
CLR object. Neither a nested binding nor a peer could resolve the token, and
using it with a different class failed. After the nested calls returned, the
outer operation could still use its own token. The application then threw
without releasing that token: it caught the same exception object, the next
operation rejected the stale token, and the reference counts returned to their
baseline. Both assembly contexts unloaded.

Run `npm run test:dotnet-host-domain` to reproduce these checks.

The [installed NuGet consumer](dotnet-worker-packages-20261124.md) exercises
these boundaries through the generated public C# API.
