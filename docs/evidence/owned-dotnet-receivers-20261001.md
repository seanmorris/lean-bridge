# C# receiver methods, properties and original-owner results

Plan node: 1219. The acceptance record is
`owned-dotnet-receivers-20261001.json`. It binds the source inventory,
generated APIs, full test log and installed NuGet observations to the Ruby
receiver milestone. Earlier receipts and support classifications stay unchanged.

## Run the acceptance suite

```sh
source scripts/env.sh
export LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-receivers
```

The gate requires ten passing tests without skips and eight reports under
`build/owned-dotnet-receivers/`.

## Coverage

Ordinary source and reviewed IR each export 27 functions, including 16 receiver
members, 20 original-owner result anchors and four consuming functions. C#
exposes sealed nominal owner subclasses and read-only CLR properties. Share
and Retain preserve nominal types. Members pass the original owner when its
contract anchors a result or consumes the receiver. Record fields remain raw
value fields; exported properties call Lean. Temporary receivers stay rooted
through native calls, including callbacks that collect managed objects.

Runtime checks cover empty and recursive values, returned closures, callback
reentry, allocation failures, wrong-thread access, foreign close and optimized
GC schedules. Four compiled semantic mutations must fail the unchanged
consumer assertions. Separate resource-only builds omit callback and result
anchor capabilities, including Unit properties and consuming receivers.

Both source paths use an offline-installed CLI to produce NuGet packages.
Two independent builds and reassembly must reproduce the original archives.
The tests delete author sources and tools before installation, execute safe
public C# clients and the guide example, and reject 23 invalid clients during
compilation. Relocated assemblies run without the SDK, package feed, cache or
consumer source. Altered and symlinked libraries must fail loading.

The reviewed build shares its component with C, C++, Rust, Python and Ruby.
C++, Rust, Python and Ruby consumers execute from prepared packages. The C#
adapter retains isolated GMP and thread-exit cleanup. Package verification
rejects forged receiver contracts, changed generated sources and unrecorded
files.

Callback-result anchors and the final cross-language container and support
audit remain open. This milestone does not publish packages or promote
installed-support cells.
