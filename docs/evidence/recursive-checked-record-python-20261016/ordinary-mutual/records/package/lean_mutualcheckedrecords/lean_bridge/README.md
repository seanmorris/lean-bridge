# lean_mutualcheckedrecords

Install the prepared platform wheel and import lean_mutualcheckedrecords. It contains the native Lean libraries and loads a compatible shared runtime automatically. Consumers need no Lean compiler or C build tools. Requires GIL-enabled Python 3.11+ on Linux x86-64 with glibc matching the wheel tag. Free-threading, post-fork calls and incompatible runtime identities are rejected. Subinterpreters and other Python implementations have not been accepted.

Records and variant constructors are frozen dataclasses. Construct and match named cases without raw pointers or numeric constructor tags. Arrays and Lists accept lists or tuples and return independently copied tuples. Concrete aliases retain their names. Option[T] is None or Some(value); Some(None) preserves a present Unit or absent inner Option. Result[T,E] is Ok(value) or Err(value), including equal payload types. Domain errors return Err. Binary products keep their nested two-element tuples.

Unit is None. Bool requires bool. Fixed-width integers reject out-of-range values and Boolean/numeric coercion; Nat and Int use exact Python integers. Native words are 64-bit. Float32 rounds a Python float to binary32 and preserves NaN classification, infinities and signed zero. String requires Unicode scalar text and preserves NUL; ByteArray is bytes. Constructors must use the exact generated classes.

Finite copied values may be at most 128 levels deep and visit 262,144 nodes. Arguments and the result share a 16 MiB native-copy budget and a separate 16 MiB accounted conversion-storage budget. These limits do not bound Lean working memory or every Python allocator overhead. Cycles and uninhabited copied values are rejected. Inputs validate before native allocation or runtime initialization; do not mutate them during conversion. Temporary buffers and native results clear in finally, including conversion exceptions. Malformed native output retires the runtime. Input, limit and recoverable allocation failures preserve usability. Independent calls can use separate threads; each call owns its scratch storage.

Deep runtime annotations use TypeAliasType boundaries to keep shared types finite; __value__ exposes their exact targets. Public stubs retain precise recursive types. When container aliases require it, pip automatically installs typing_extensions (>=4.6,<5) on Python 3.11; Python 3.12+ uses the standard library. Callback, closure, resource and asynchronous payloads remain outside this recursive profile.

- lean_mutualcheckedrecords.echo: lean:MutualCheckedRecords.echo
- lean_mutualcheckedrecords.echo_groups: lean:MutualCheckedRecords.echoGroups
- lean_mutualcheckedrecords.first: lean:MutualCheckedRecords.first
- lean_mutualcheckedrecords.groups: lean:MutualCheckedRecords.groups
- lean_mutualcheckedrecords.produce: lean:MutualCheckedRecords.produce
- lean_mutualcheckedrecords.second: lean:MutualCheckedRecords.second
