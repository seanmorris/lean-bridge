# A C# record can own a Lean function

The [ordinary-source NuGet install](dotnet-function-fields-20261126/ordinary.json)
and [reviewed install](dotnet-function-fields-20261126/reviewed.json)
ran the same [C# application](../../tests/fixtures/structured-types/tariff-fields.cs)
against separately built packages. The reviewed project supplied its own
Binding IR; it did not copy the ordinary build’s output. Each record identifies
the package, installed interface, client source and relocated application DLL.

The application constructs `new Tariff(quote)` itself, passes it through
Lean and disposes the input. The returned field still computes the price.
It also extracts a function, repacks it via `AsCallback` and disposes the
old wrapper. An explicitly retained field survives the original owner.
By contrast, packing an ordinary C# delegate does **not** register it for
later use. Calling that expired field directly or through Lean is refused
without entering the delegate. A disposed Lean function is refused too.

A different export calls C# for a function and immediately applies its
reply. The application returns an existing Lean closure using a typed
callback and `OwnedCallbacks.WithRecovery`. If the callback throws after
allocating and disposing a temporary function, C# catches the **original**
exception. The saved function and the binding remain usable.

Both runs measured one native identity for the owner-thread session, **four**
with the positive-control leases held, one again after each field scenario
and after callback failure, and **zero** after the thread exited. The final
execution used a runtime-only .NET 8 host after removing the application
project and its NuGet feed. These are local Linux x86-64 installs; this
scalar function field does not contain an application object.

Run `npm run test:dotnet-function-fields` with the native Lean toolchain,
GNU m4 and the .NET 8 SDK available to the producer. To retain the two
package handoffs, point `LEAN_BRIDGE_DOTNET_TARIFF_KEEP` at an existing
directory. To repeat just the offline install and relocated client, unset
that variable and point `LEAN_BRIDGE_DOTNET_TARIFF_REPLAY` at the reported
directory containing `ordinary/` and `reviewed/`.
