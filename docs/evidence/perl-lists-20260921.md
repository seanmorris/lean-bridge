# Compiled Perl Lists

VO1219 adds copied `List T` inputs, results and record fields to prepared CPAN
packages. Ordinary-source and independently reviewed-IR builds compile the same
27-export Lean fixture. Lists use plain array references and retain distinct
Binding IR and native identities. Typed Lean helpers convert Lists through
arrays without inspecting cons-cell layouts.

## Installed validation

```sh
export LEAN_BRIDGE_PERLS='["/absolute/path/to/5.36.3-threaded/bin/perl","/absolute/path/to/5.36.3-unthreaded/bin/perl","/absolute/path/to/5.38.2-threaded/bin/perl","/absolute/path/to/5.38.2-unthreaded/bin/perl"]'
LEAN_BRIDGE_PERL_LIST_TEST=1 node --test tests/perl-lists.test.mjs
node --test tests/perl-list-contract.test.mjs
```

The [machine-readable record](perl-lists-20260921.json) binds archive, receipt,
source, interpreter and installed-file hashes. Each source path builds one Lean
component and four XS variants. All eight source-path/ABI combinations pass
112,738 public assertions per run.

The suite installs both CPAN archives offline in `prebuilt-only` mode after
removing producer sources. It relocates each installation, removes the archive
handoff and executes each public consumer twice without compilers. All five
loaded package libraries match their recorded hashes. Installed files remain
unchanged. Perl modules and native headers remain part of the installed runtime.

The consumer checks all nineteen primitive elements, exact 5,121-bit integers,
fixed-width limits, Float32 rounding, signed zero, subnormals, infinities, NaN
classification, Unicode and embedded NUL. It checks mixed Lists and arrays,
record fields, option presence, both result branches and binary products.
A 24-level fixture exercises every empty level. Mutation checks verify that
input and sibling-result storage remain independent. A 30,000-element generated
List exercises native traversal.

Invalid containers, blessed or tied arrays, sparse elements, malformed payloads,
out-of-range integers, invalid encodings, product arities and cyclic values
reject. Oversized inputs and results raise, and later calls succeed. Weak
references to input arrays do not affect admission. The public consumer uses
no native declarations or private adapter functions.

## Cleanup

A separately compiled test-only copy of XS inserts failure checkpoints without
changing installed files. Each source-path/ABI combination passes 710 checks:

- 687 injected conversion failures after ownership registration, copy-budget
  accounting, Perl value retention and output insertion. Each failure leaves
  zero live scopes, callbacks and resource wrappers, then permits another call.
- 16 partial-input failures with cleanup and weak-reference checks.
- Four `Math::BigInt` input/output exceptions preserving the original exception
  object, and three input-mutation cases that clear, replace or append elements
  while a List is being converted.

List conversion pins the input slots before an element converter can invoke
Perl code. The probes caught an admission error: rejecting all array magic also
rejected weak-reference bookkeeping. The adapter now checks for actual ties.
Consumer assertions force scalar argument context so a failed regex cannot
shift a diagnostic message into the assertion's value position.

Input and output conversion share a 16 MiB accounting budget. The tests do not
fault every allocation or bound all Perl allocations and Lean working memory.
Types have a 32-level nesting limit. Local acceptance uses Linux x86-64 with
`LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36`; CI retains the supported 2.38 floor.
Calls must stay on the initiating process and Perl interpreter thread.

This milestone promotes six profile/path/position cells: List inputs, results
and fields on both source paths. List callback payloads, distinct runtime
aliases, arbitrary or recursive variants and resource-containing copies remain
separate work. No registry release was published.
