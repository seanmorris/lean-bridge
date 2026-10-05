# Installed Perl compound values

Task 1219 adds copied `Option`, `Except` and nested binary `Prod` values to
prepared CPAN packages on ordinary-source and independent reviewed-IR paths.
The [machine record](perl-compounds-20260920.json) retains source, package,
installed-file, receipt, interpreter and native-library hashes.
Base revision: `0d89349d`.

## Installed checks

Each source path builds the same 64-export Lean library and checks its inferred
API against an independent signature catalog. It builds one native component
and prepares XS variants for Perl 5.36.3 and 5.38.2, each with and without threads.
All eight source-path/ABI combinations pass.

Each consumer installs the runtime and component archives offline in
`prebuilt-only` mode. The producer project is deleted before installation;
the archive handoff is deleted before execution. The installation is relocated.
The public consumer runs twice in separate processes with compiler, Lean and
runtime-search paths unavailable. Perl source and matching native headers remain
installed as part of the prepared runtime package.

Each unchanged installation passes **78,980 public assertions per run**. The
consumer checks the loaded module's path and hashes all five mapped package
libraries. Every installed file remains byte-identical after both public runs
and the separate cleanup probe.

The consumer covers:

- All nineteen primitives inside options, results and products: fixed-width
  endpoints, exact 1,234-digit integers, IEEE rounding and classification,
  signed zero, Unicode scalars, embedded NUL and all 256 byte values.
- None, Some None and Some Some Unit; same-typed and asymmetric result branches;
  nested products, arrays and generated record fields.
- Twenty-four option levels, no-argument compound returns, independent mutable
  outputs and recovery after rejected inputs.
- Exact branch classes and field sets, two-element product arity, malformed
  payloads, sparse or tied products, tied branches, cycles, invalid encodings,
  input budget exhaustion and combined input/output budget exhaustion.

## Cleanup regression

A separately compiled copy of the generated XS inserts test-only checkpoints.
It calls the installed Lean library and runtime; it replaces no installed file.
For every source-path/ABI combination, it passes **263 checks**:

- 242 injected conversion failures after allocation registration, copied-value
  accounting, Perl value retention and output insertion. Every failure leaves
  zero live scopes, callbacks and resource wrappers, then permits another call.
- 16 partial-input failures, followed by cleanup and weak-reference checks.
- Four `Math::BigInt` input/output exceptions preserving the original exception
  object, plus re-entry that clears a product while its children are converted.

These probes found an array cleanup bug: ownership registration could fail
before newly allocated Lean array slots were initialized. Cleanup then visited
uninitialized pointers. The adapter now initializes every slot before registering
the array. The failing checkpoint passes, and a generation test checks that order.
The probes do not fault every allocation inside Perl or Lean.

## Reproduce

Use the pinned Lean compiler, a native C compiler and the supported Perl ABIs:

```sh
export LEAN_BRIDGE_PERLS='["/absolute/path/to/5.36.3-threaded/bin/perl","/absolute/path/to/5.36.3-unthreaded/bin/perl","/absolute/path/to/5.38.2-threaded/bin/perl","/absolute/path/to/5.38.2-unthreaded/bin/perl"]'
LEAN_BRIDGE_PERL_COMPOUND_TEST=1 node --test tests/perl-compounds.test.mjs
node --test tests/perl-compound-contract.test.mjs
```

For one ABI, set `LEAN_BRIDGE_CORPUS_PERL` instead. CI runs one job per ABI and
retains `build/compounds/perl.json`. This local run used Linux x86-64 with
`LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36`; the supported CI profile remains
glibc 2.38. No registry release was published.

## Scope

Options use `undef` or `Some->new($value)`, results use `Ok->new($value)` or
`Err->new($error)`, and products use plain two-element array references. Unit
uses `undef`; explicit Some wrappers preserve presence and nesting. Branches
are mutable one-field hashes. Calls validate the concrete payload type and copy
nested mutable values. Perl reference equality is not deep value equality.

Type nesting is limited to 32. Input and output conversion share a 16 MiB
copied-value budget. These limits do not bound all Perl allocations or Lean
working memory. Resources, compound callables, lists, arbitrary variants and
recursive copied types remain separate work. This milestone promotes eighteen
Perl copied positions. It does not promote other hosts or callback positions.
