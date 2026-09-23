# Recursive Perl value declarations

The Perl graph generator emits mutable, named-field record and constructor
classes without unfolding recursive types. Direct and mutual recursion retain
their nominal identities. A graph of 700 shared aliases produces bounded source
instead of an exponentially expanded type. Reordering type definitions leaves
the generated source and model unchanged.

Records and variant constructors use blessed hashes with accessors named after
the Lean fields. Constructors require exactly the declared fields. As in the
existing Perl API, repeated record keywords take the last value; repeated variant
keywords reject. Variant cases inherit from their family, which cannot be
constructed directly. Field names such as `keys`, `ref` and `bless` work because
generated constructors qualify Perl builtins. Lifecycle and introspection
method names reject before generation.

Unit and absent options use `undef`. The generated `Some` class distinguishes
`Some->new(undef)` from absence, and nested `Some` wrappers retain their presence.
Results use `Ok` or `Err`; arrays, Lists and binary products use array references.
Concrete aliases preserve their contract names and targets in comments and
metadata without adding wrapper classes. Records retain the field values passed
to them. Native calls will validate and copy those payloads; construction alone
does not enforce their Lean types or reject cyclic Perl object graphs.

The enabled test runs 103 assertions on each pinned Perl interpreter: 5.36.3 and
5.38.2, both threaded and unthreaded, with 64-bit integer and pointer profiles.
It exercises linked records, mutual recursion, every scalar field, nested
options/results, empty and Unit constructors, a 256-field constructor, alias
erasure, mutable payloads, builtin-named accessors and malformed constructor
arguments. Perl reference equality is not deep value equality.

```sh
LEAN_BRIDGE_PERL_GRAPH_TEST=1 \
  node --test tests/perl-copied-graph-values.test.mjs
```

By default the enabled local test selects all four pinned interpreters under
`.toolchains/perl`. `LEAN_BRIDGE_CORPUS_PERL` selects one interpreter, and
`LEAN_BRIDGE_PERLS` accepts an explicit JSON array of executable paths. Each CI
matrix job requires execution on its selected interpreter and retains
`build/recursive/perl-values.json`.

These declarations do not enable recursive native calls or CPAN builds and
promote no installed coverage. XS conversion, bounded allocation, cleanup across
Perl exceptions, shared runtime behavior and original source-free installations
on all four ABIs remain the next Perl acceptance stages in VO 1219.
