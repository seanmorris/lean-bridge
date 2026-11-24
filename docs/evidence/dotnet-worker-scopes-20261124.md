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
