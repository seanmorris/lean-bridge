# Installed Ruby tagged variants, 21 September 2026

Prepared gems expose each copied Lean variant as a named Ruby family with a
constructor class for each case. Required keyword arguments carry the payloads;
read-only accessors and `deconstruct_keys` support inspection and pattern
matching. Callers use no native tags, Fiddle declarations or memory layouts.

The [machine record](ruby-variants-20260921.json) binds the original gems,
installed files, independent consumers and fault probes to their hashes. It
covers MRI Ruby 3.3.12 on Linux x86-64. Local acceptance used glibc 2.36; the
normal release profile keeps its documented platform requirements.

## Installed checks

Both ordinary-source and independently reviewed Binding IR builds export
fourteen functions across seven variant families and eighteen constructors.
Each public execution passes 35,904 assertions over 4,410 calls, including
eighty-one rejected inputs followed by successful recovery.

The handwritten consumer checks every constructor and all nineteen primitive
payload types. Cases include nested variants, records, arrays, Lists, options,
results and products; 5,121-bit integers; Unicode and embedded NULs; binary
strings; floating-point special values and signed zero; and empty constructors
distinct from `UNIT` payloads. Eighteen changed-field negatives check scalar
meaning against a separate Lean inspector. Public reflection checks constructor
families, required keywords and method arity. Four threads execute 256 calls.

The shared Lean fixture reserves `inspect` for other hosts. Ruby uses an
explicit `inspect_scalars` Lean wrapper because its generator reserves Ruby's
`inspect` method. The reviewed contract selects that same compiler-checked
wrapper. It does not rename metadata without checking the source definition.

Consumers install the original gems offline after the author project is
removed. They relocate the installation, remove both the archive handoff and
RubyGems cache, then execute twice with no compiler on PATH and invalid Lean/C
tool locations. All twenty-four installed files retain their receipt hashes,
including the generated Ruby API and four loaded native libraries.

Independent builds reproduced both original archives and every installed file.
The ordinary-source gem has SHA-256
`f1fb70ada1313a0a62c6070e68c57f7c1bd033138337073bf84ced9b2b4a634b`;
the reviewed-IR gem has SHA-256
`e45128b99299716a120151e4a68a8c3a5633d6227ec7be8ddd6fb79e2db419b2`.
These are local acceptance packages, not RubyGems.org publications.

## Failure and ownership checks

A separate process instruments the installed methods in memory, leaving gem
files unchanged. It adds checkpoints to sixty-six conversion methods, scoped
native allocation and buffer registration, and twenty-two public constructors.
Across nine calls it recovers from 315 injected failures, checks that tracked
native buffers are freed and scoped collections are empty, and verifies that
owned output is cleared once when the call entered native code.

Sixty-four partial-input failures reject before entering Lean. Seven invalid
native tags reject before reading their union payloads. Six cases ignore
poisoned inactive storage; the single-constructor family has no inactive branch.
Public execution succeeds again in an uninstrumented process afterward.

The shared real-Lean native probe passes 1,182 checks, including 242 allocation
failures, seventy invalid inputs and one injected returned tag. Address and
undefined-behavior sanitizer checks pass. LeakSanitizer reports the unchanged
startup-only GMP baseline of 128 bytes in twelve allocations, with no additional
conversion leaks. Ruby probes check scoped native ownership, not total Ruby heap
allocation.

## Value semantics

The family has no public `new`; callers construct a named case. Calls require
the exact generated case class and reject unknown subclasses, tagged hashes and
`nil`. Payload fields retain their concrete type and range checks. Constructor
objects are frozen, while contained arrays and strings remain mutable and are
copied at the boundary. Ordinary object equality is identity-based; compare
payload contents when checking copied values. Ruby does not check pattern
exhaustiveness.

Only concrete, non-recursive copied variants are admitted. Generic, indexed,
proof-bearing, callable and identity-bearing payloads remain outside this
profile. The existing 32-level type limit and separate 16 MiB Ruby/native
conversion budgets do not bound all Ruby allocations or Lean working memory.

## Reproduce

Install the repository's pinned native and Ruby tools, then run:

```sh
source scripts/env.sh
LEAN_BRIDGE_RUBY_VARIANT_TEST=1 node --test tests/ruby-variants.test.mjs
node --test tests/ruby-variant-contract.test.mjs tests/ruby-variant-evidence.test.mjs
```

The installed test writes `build/variants/ruby.json`. The managed CI job requires
and uploads this report. The milestone promotes six copied-variant cells across
both source paths. Recursion, compound callables and owned identity aggregates
remain separate work.
