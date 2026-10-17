# recursivecheckedrecords 1.0.0

Compiled Lean recursive values for Linux x86-64, glibc 2.36 or newer. This archive includes Wasmtime 42.0.1, the Component Model binary, generated headers and the shared native Lean runtime. Consumers do not install Lean. Keep include/ and lib/ together.

## Call the installed package

Compile your C application with pkg-config recursivecheckedrecords-wit and include recursivecheckedrecords_wasmtime.h. Open a session with recursivecheckedrecords_wasmtime_open. The typed recursivecheckedrecords_wasmtime_value_* functions accept the generated graph types and cross the compiled Component Model component before calling Lean. Native string lengths count UTF-8 bytes, including embedded NUL. Sequences retain order and duplicates. Option, result and variant tags remain explicit, including nested options and present Unit. Aliases retain their Lean identity in binding-manifest.json.

Arguments borrow caller-owned graphs for the duration of the call. Initialize each output with {0}. Results own independent storage and remain valid after the session closes. Call the generated type's _clear function exactly once on each owned result; clearing an already cleared value is harmless. Do not copy an owned result and then clear both copies. Errors leave outputs unchanged. Delete errors with wasmtime_error_delete. Close the session with recursivecheckedrecords_wasmtime_close. Do not call the same session concurrently. Separate sessions and packages share the Lean runtime automatically. The graph host and native libraries remain mapped so that owned results can be cleared after a consumer closes its library handle.

## Component Model API

component/recursivecheckedrecords.wasm imports native Lean functions through recursivecheckedrecords_wasmtime_link. It requires the supplied host and is not a standalone WASI command. The session helper embeds the same component bytes. recursivecheckedrecords_wasmtime_call accepts Wasmtime values by WIT export name; delete its owned results with wasmtime_component_val_delete.

WIT cannot declare recursive types directly. Each copied wire value contains a typed root reference and finite, typed node tables. The typed C helpers build and read those tables for you. binding-manifest.json distinguishes the original Lean declarations and proofs from the generated wire schema. References are indices within one copied value, never persistent handles or resources. Every table row must be reachable from the root. The adapter rejects invalid indices, cycles, unknown constructors, malformed fields and noncanonical scalar values. A shared acyclic child is copied independently at each occurrence.

## Limits and failures

Values permit 128 nested levels and 262,144 expanded node visits. Input and output conversions have separate 16 MiB copy budgets; the native carrier also checks its own bounded conversion scopes. Shared subgraphs count once per visit, not once per address. Canonical scratch memory is capped at 64 MiB. These limits do not bound Lean algorithm or Wasmtime engine working memory. Wasmtime's allocation API does not expose recoverable out-of-memory errors.

A rejected checked refinement returns an error whose final cause is the exact Lean diagnostic, such as a field path followed by "was rejected by" and the constructor, or "is not below its Fin n bound". The call leaves its output unchanged and later calls proceed normally. Malformed diagnostic text retires the shared Lean runtime.

Conversion limits and native scratch allocation failures return errors and free temporary storage. A trapped component store is replaced before the next session call. Custom Wasmtime embeddings must discard a trapped instance. Malformed native outputs retire the shared Lean runtime; subsequent native calls fail. Callbacks, closures and resource-containing aggregates require separate ownership contracts and are not admitted by this copied-graph package.

## Exports

- recursivecheckedrecords_wasmtime_value_echo: lean:RecursiveCheckedRecords.echo (WIT echo)
- recursivecheckedrecords_wasmtime_value_echo_groups: lean:RecursiveCheckedRecords.echoGroups (WIT echo-groups)
- recursivecheckedrecords_wasmtime_value_first: lean:RecursiveCheckedRecords.first (WIT first)
- recursivecheckedrecords_wasmtime_value_groups: lean:RecursiveCheckedRecords.groups (WIT groups)
- recursivecheckedrecords_wasmtime_value_produce: lean:RecursiveCheckedRecords.produce (WIT produce)
- recursivecheckedrecords_wasmtime_value_second: lean:RecursiveCheckedRecords.second (WIT second)

## Loaded-library identity

The host checks the loaded native adapter, Lean component, both runtime libraries and Wasmtime against the sizes and SHA-256 hashes in its compiler receipts. A conflicting library already loaded under the same name makes session opens, calls and custom-linker imports return an error. Keep the installed library files unchanged while loading hosts. Inherited hosts reject calls and session opens after fork; exec a fresh consumer process. Closing an inherited session in the child does nothing. The parent still owns its session.
