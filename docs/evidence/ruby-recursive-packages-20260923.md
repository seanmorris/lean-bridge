# Prepared recursive Ruby gems

Ordinary Lean source and independently reviewed contracts produce original,
offline-installable Ruby gems with recursive copied values. Consumers require
the generated module and call named Ruby functions. The installed package loads
its compiled component and compatible shared runtime automatically.

## Public values

Records and inductive constructors use frozen, keyword-initialized classes with
value equality, hashing and pattern matching. Direct and mutual recursion can
combine with arrays, Lists, aliases, records, variants, options, results and
products. Arrays and Lists use exact Ruby Arrays. Unit uses `UNIT`; `nil`,
`Some.new(nil)` and `Some.new(UNIT)` remain distinct. Results use `Ok` and `Err`.

Calls preserve all nineteen primitive conversions, including arbitrary-size
integers, Unicode and NUL, Float32 rounding, NaN classification and signed zero.
Returned mutable payloads own independent storage. The
[Ruby consumer guide](../consume/ruby.md#recursive-values) includes an executed
example; the [publisher guide](../publish/rubygems.md#export-recursive-values)
shows its Lean definitions.

## Limits and runtime behavior

Conversion permits at most 128 levels and 262,144 nodes. Input and output share
a 16 MiB native-copy budget, with a separate 16 MiB allowance for accounted Ruby
conversion storage. These limits do not cover Lean working memory or every Ruby
allocation overhead. Cyclic Ruby object graphs and uninhabited values reject.
Every argument validates before native allocation or runtime initialization.

An `ensure` block releases native results and temporary buffers on allocation
failures and interruptions. The pre-bound C cleanup function clears the root
owner before releasing it, without following malformed children or allocating
a Fiddle wrapper. Malformed native output retires the shared runtime. Earlier
Ruby results remain usable after retirement.

Native calls retain MRI's GVL. The shared loader checks process identity before
acquiring its lock; calls and fresh imports reject inherited runtime state
after a fork, including when another thread held the lock. Ractors and
experimental M:N threads are rejected. The guard also covers acyclic packages
and primitive callable packages using this shared loader.

The accepted interpreter is MRI Ruby 3.3 on little-endian Linux x86-64.
Callback/closure payloads, resource-containing aggregates and asynchronous
operations remain outside this recursive copied profile.

## Installed acceptance

The [receipt](ruby-recursive-packages-20260923.json) binds two complete builds
at independent source locations. Both builds reproduce the original primary
and companion gem archives, installed inventories and consumer observations.
Each source path exercises eighteen exports and records:

- 179 public assertions, 65 rejected inputs and 256 threaded calls.
- 1,089 fault assertions over 157 conversion checkpoints, injecting both
  `NoMemoryError` and `Interrupt`, plus two real cross-thread interruptions.
- Exactly-once cleanup of 132 owned native outputs.
- Four three-package composition runs, covering both load orders and both
  malformed-output and retirement-during-publication failures.
- Tampered-library, symlink, metadata-drift and re-signed-source rejection.

The tests delete the author sources before installation, install original
archives offline, relocate the gem home, then remove the archive handoffs and
gem cache. Consumer execution has no compilers on PATH. Public calls and the
documentation example also run after removing build metadata. The tests
restore metadata and verify that installed files remain unchanged.

The [regression receipt](ruby-recursive-regressions-20260923.json) records fresh
C/C++, Rust, Python, Java/Kotlin and existing Ruby installations. Earlier
receipts retain their original hashes. A separate pre-integration worktree
confirms that this Ruby milestone leaves collection native libraries unchanged;
the changed installed files contain the private Ruby calls and shared guards.

```sh
source scripts/env.sh
LEAN_BRIDGE_RUBY_GRAPH_PACKAGE_TEST=1 \
  node --test tests/ruby-graph-package.test.mjs
```

CI requires the enabled suite and retains `build/recursive/ruby-packages.json`.
Only recursive parameter, result and field positions on the two Ruby source
paths receive installed coverage. Structured callable payloads and explicitly
owned resource aggregates remain assigned work in VO 1219.
