# recursivecheckedrecords

Use the prepared crate through Cargo. Public functions accept typed Rust values and return Result<T, Error>. Fixed-width scalars pass by value. Strings, slices, records, variants, options, results, products and big integers are borrowed. Outputs own independent copied values. Construct records and match enum cases by name, without unsafe code or constructor numbers.

Arrays and Lists use Vec, Lean Option uses Option, and Except E T uses Result<T, E>. Binary products retain tuple nesting. None, Some(()) and Some(None) stay distinct. An exported Except has an outer Result for bridge failures and an inner Result for the Lean domain value. Concrete aliases keep their names. Recursive or oversized fields use Box; Vec supplies its own indirection. Nat and Int use num-bigint BigUint and BigInt. Lean native words use u64 and i64 on this 64-bit profile.

The crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.

Finite copied values may be at most 128 levels deep and visit 262,144 nodes. Arguments and the result share a 16 MiB native-copy budget and a separate 16 MiB accounted Rust conversion-storage budget. These limits do not bound Lean working memory or every allocator overhead. Invalid inputs fail before loading or initializing the runtime. Malformed native output retires it permanently. Limit and recoverable allocation failures preserve runtime usability. RAII releases temporary storage and native outputs on errors or unwinding; process abort and Rust allocations that abort cannot run destructors. Callback, closure, resource and asynchronous payloads remain unsupported in this recursive profile.

- echo: lean:RecursiveCheckedRecords.echo
- echo_groups: lean:RecursiveCheckedRecords.echoGroups
- first: lean:RecursiveCheckedRecords.first
- groups: lean:RecursiveCheckedRecords.groups
- produce: lean:RecursiveCheckedRecords.produce
- second: lean:RecursiveCheckedRecords.second
