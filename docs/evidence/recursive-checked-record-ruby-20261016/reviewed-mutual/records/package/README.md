# LeanBridge::Mutualcheckedrecords

Install the prepared gem and require "lean_bridge/mutualcheckedrecords". Native Lean libraries and a compatible shared runtime load automatically. Consumers need no Lean compiler or extension build. This package requires MRI Ruby 3.3 on little-endian Linux x86-64. Post-fork calls, Ractors and RUBY_MN_THREADS are rejected; start a fresh process after fork. Native libraries remain loaded for the process lifetime.

Records use frozen keyword-initialized classes. Variants use named constructors with required keyword payloads and Ruby pattern matching. Equality requires the exact generated class. Arrays and Lists use exact Ruby Arrays; copied results own independent storage. Concrete aliases retain their original names and targets in comments and metadata without adding wrapper classes. Unit is LeanBridge::Mutualcheckedrecords::UNIT. Options use nil or Some.new(value); Some.new(nil) differs from nil. Results use Ok.new(value) or Err.new(error), and products use nested two-element Arrays. Frozen fields may contain mutable arrays and strings; do not mutate inputs during conversion or while their enclosing values are Hash keys.

Integers remain exact. Nat rejects negatives, fixed-width integers reject out-of-range values, and native words are 64-bit. Numeric coercions and subclasses are rejected. Float32 rounds to binary32 and preserves NaN classification, infinity and signed zero. String requires valid UTF-8 or US-ASCII and preserves NUL. ByteArray uses a binary String. Char requires one Unicode scalar.

Input and output conversion share a maximum depth of 128, 262,144 nodes, a 16 MiB native-copy budget and a separate 16 MiB accounted conversion-storage budget. These limits do not bound Lean working memory or every Ruby allocator overhead. Cycles and uninhabited copied values reject. All inputs validate before native allocation or runtime initialization. An ensure block clears native outputs and temporary storage, including allocation failures and interruptions. Malformed native results retire the runtime; recoverable input, limit and allocation errors preserve usability. Independent calls may use Ruby threads; native calls retain the GVL. Domain errors return Err; bridge failures raise LeanBridgeError with a numeric status.

Callback, closure, resource and asynchronous payloads remain outside this recursive profile.

Lean fields named like reserved Ruby members gain one trailing underscore: Envelope#next_ is Lean field next. Diagnostics name the Lean field.

- LeanBridge::Mutualcheckedrecords.echo: lean:MutualCheckedRecords.echo
- LeanBridge::Mutualcheckedrecords.echo_groups: lean:MutualCheckedRecords.echoGroups
- LeanBridge::Mutualcheckedrecords.first: lean:MutualCheckedRecords.first
- LeanBridge::Mutualcheckedrecords.groups: lean:MutualCheckedRecords.groups
- LeanBridge::Mutualcheckedrecords.produce: lean:MutualCheckedRecords.produce
- LeanBridge::Mutualcheckedrecords.second: lean:MutualCheckedRecords.second
