# Prepared Ruby gems with resource-containing values

Ordinary Lean source and independently reviewed Binding IR produce prepared
Ruby gems with resource-bearing records, variants, recursive values and
synchronous callbacks. Consumers install the gem and require its generated
module. The gem loads its bundled Lean component, shared runtime and private
GMP without compiler access, extension builds or library-path configuration.

## Installed behavior

Composition packages pass 77 public API checks before relocation and 77 after.
Separate scalar packages pass 147 checks before relocation and 147 after,
covering all nineteen primitive types inside a resource-containing record.
Both source paths preserve constructor identity, nested options, lists,
products, aliases, resource identity and independent copied payloads.

The tests delete the Lean source and producer output before offline gem
installation. They remove the release handoff and gem cache before moving the
installed gems and repeating the calls. Consumers supply no constructor
numbers, JSON transport, raw handles or native declarations. The consumer
guide's resource example runs against the installed composition package.

The reviewed composition test builds C, C++, Cargo, PyPI and RubyGems packages
together and executes each installed consumer. Ruby uses a separate adapter
for its private GMP dependency; all five targets reuse the compiled Lean
component and runtime. Reassembling a gem from authenticated native artifacts
produces the same archive bytes.

The combined build's C, C++, Rust and Python consumers pass 693, 577, 596 and
120 checks respectively. Its installed Ruby consumer passes the same 77 checks
before and after relocation and executes the guide's example, printing `42`
twice.

## Ownership and failure handling

Resource wrappers carry checked result leases. `dup` and `clone` share a lease
with independent close guards; `retain` creates independent native ownership.
Use `with` or `close` for deterministic disposal. Callback resource leaves,
including duplicates, expire when their callback returns unless retained.
Replies are copied before the borrow expires. Returned Lean closures support
higher-order calls and explicit close.

Native callbacks restore the original Ruby exception after cleanup. Nonlocal
block exits become `LocalJumpError`. Fiber switches reject before suspension.
Asynchronous thread interruption waits for the native call and cleanup.
Thread-exit cleanup retires abandoned owners even when dead Thread objects,
suspended Fibers and wrappers remain referenced. GC queues fallback cleanup;
it does not call C from a finalizer.

The conversion probes run 595 mixed-value assertions, 278 scalar assertions,
485 callback assertions and six malformed-output assertions per source path.
Each path exercises 299 Ruby allocation checkpoints and 234 native allocation
failures, with zero remaining bridge allocations and native identities.
Repeated callbacks reach the shared conversion limit after 819 invocations;
the following ordinary call succeeds. Malformed native values retire the
runtime and revoke partially published wrappers.

Conversions bound depth to 128, visits to 262,144, native conversion data to
16 MiB and accounted Ruby conversion storage to another 16 MiB. These limits
do not bound Lean algorithm memory or every Ruby allocator overhead. Resource
use belongs to its creating native thread and process. The supported profile
is MRI Ruby 3.3 on little-endian Linux x86-64 with 1:1 threads.

## Native loading and compatibility

Ruby already uses a system GMP library. The owned adapter links a private
GMP 6.3.0 SONAME with locally bound symbols. Tests verify independent Ruby,
Lean and private GMP allocators through 500 integer round trips. The private
build passes GMP's upstream tests; the default non-Ruby GMP build remains
byte-identical to its predecessor across all eight artifacts. Gems include
the checked GMP source archive and license notices.

Generated loaders authenticate library hashes, regular files, runtime identity
and component receipts. They reject changed or symlinked libraries, unverified
preloads, incompatible builds, Ractors and M:N threads. Post-fork calls reject
before acquiring a held loader lock. Four concurrent requires initialize one
runtime and one component.

Three installed gems, two owned and one copied, work in both loading orders.
They share one runtime, retain separate resource types, support nested calls
across packages and execute 64 threaded calls. Retirement initiated by either
API prevents calls through all three components and leaves zero identities.

Existing copied gems pass their ordinary/reviewed regression: 179 public
assertions, 256 threaded calls and 157 failure checkpoints per path. Their
primitive, structured and recursive callback suites also pass under Ruby 3.3.
The recursive callback suite exercises 9,958 injected failures per path.

## Evidence and remaining scope

[Installed execution](owned-ruby-execution-20260927.json) records terminal test
logs, compiler inputs, package receipts, generated-file identities and
observations. [Integration history](owned-ruby-integration-20260927.json)
records exact source changes against Python milestone `ef9bd83`. Verifiers
regenerate the public API and C adapter, check original installation receipts
and reject mutated ownership, loader, execution and source-history claims.

The earlier [foundation](owned-ruby-foundation-20260927.json),
[conversion](owned-ruby-conversions-20260927.json),
[GMP](owned-ruby-gmp-20260927.json) and
[generated-module loading](owned-ruby-loading-20260927.json) records remain
unchanged. Source-history normalization restores their recorded inputs; it
does not replace historical archive identities.

The type inventory stays at version 0.107.0 with 4,830 of 6,562 cells marked
installed-tested. This ownership milestone promotes no additional cells.
Transferred inputs, anchored results, asynchronous delivery, the remaining
host projections and Wasm ownership remain part of VO 1219.
