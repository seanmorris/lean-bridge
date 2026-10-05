# Installed Ruby compound values

Task 1219 adds copied `Option`, `Except` and nested binary `Prod` values to
prepared RubyGems on both ordinary-source and independent reviewed-IR paths.
The [machine record](ruby-compounds-20260920.json) retains source, package,
installed-file, receipt and runtime hashes. Base revision: `6f423172`.

## Installed checks

Each path builds the same 64-export Lean library and checks its inferred API
against an independent signature catalog. Each prepared gem installs offline
with an isolated gem home. The producer project is deleted before installation;
the archive handoff is deleted afterward. The installation is relocated before
the consumer starts. Compiler paths and Lean/runtime paths are unavailable.
Ruby source files remain installed because Ruby interprets them.

Each unmodified installed package passes **38,664 public assertions**, twice in
separate processes. The consumer verifies the loaded API's path and hashes the
native libraries actually mapped into its process. Both runs use the package's
recorded libraries. Installed receipt and payload hashes are unchanged afterward.

The consumer covers:

- All nineteen primitives inside options, results and products: fixed-width
  limits, 5,121-bit integers, IEEE rounding and classification, signed zero,
  Unicode scalars, embedded NUL and all 256 byte values.
- None, Some None and Some Some Unit as distinct values; both same-typed and
  asymmetric result branches; nested products, arrays and generated record fields.
- Twenty-four option levels, no-argument compound returns, copied buffer
  independence, four concurrent Ruby threads and recovery after rejected inputs.
- Exact branch classes, two-element array arity, malformed payloads, encodings,
  cycles, excess runtime nesting, input budget exhaustion and native output
  budget exhaustion.
- Frozen `Data` wrappers, value equality, hashing and positional/key pattern
  matching. Generated record classes retain object-identity equality.

## Cleanup and malformed outputs

A separate process instruments the installed converters in memory. It changes
no installed files and does not replace the public consumer's execution.
For each source path it passes:

- **199 injected failures** across input/output conversions, scratch allocations
  and allocation retention. Every retained Fiddle buffer is freed, every scope
  list is empty, and each invoked native output receives exactly one clear call.
- **16 partial-input failures**, with no native function called and all earlier
  input allocations released.
- **9 malformed-output checks**: six invalid Option/Except flags reject, and
  three inactive pointer payloads remain unread.

There are 250 converter probe sites. These tests inject Ruby-side failures;
they do not claim to fault every allocation made inside Lean. The shared
[C compound tests](native-compounds-20260920.md) cover native allocation failures.

## Reproduce

Use MRI Ruby 3.3, RubyGems, the pinned Lean toolchain and a native C compiler:

```sh
export LEAN_BRIDGE_RUBY=/absolute/path/to/ruby
export LEAN_BRIDGE_GEM=/absolute/path/to/gem
LEAN_BRIDGE_RUBY_COMPOUND_TEST=1 node --test tests/ruby-compounds.test.mjs
node --test tests/ruby-compound-contract.test.mjs
```

CI retains `build/compounds/ruby.json`. This local run used Ruby 3.3.12,
Linux x86-64 and `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`; the supported CI
profile remains glibc 2.38. No registry release was published.

## Scope

Options use `nil` or `Some.new(value)`, results use `Ok.new(value)` or
`Err.new(error)`, and products use exactly two array elements. Unit remains the
generated `UNIT` singleton. A wrapper freezes its fields, not its payloads.
Calls validate the concrete Lean type and copy nested mutable values.

Type nesting is limited to 32. Ruby input accounting and the shared native
input/output copy budget each allow 16 MiB. These are conversion limits, not
bounds on all Ruby allocations or Lean working memory. Copied identity,
resources, compound callables, lists, arbitrary variants and recursive copied
types remain separate work. This milestone promotes eighteen Ruby copied
positions, not other hosts or callback positions.
