# Perl

Call compiled Lean functions through generated Perl modules. The package loads the shared Lean runtime automatically; application code needs no FFI declarations or runtime initialization.

## Use a prepared release

### Prerequisites

Use 64-bit Perl on x86-64 Linux with glibc 2.38 or newer. The tested ABI matrix is Perl 5.36.3 and 5.38.2, with both threaded and nonthreaded builds. These are compatibility test versions, not a recommendation to run an end-of-life Perl in production. Other compatible configurations can build the supplied XS against their own headers.

The installer matches Perl's API and `Config` fingerprint, including threading, integer sizes, floating-point representation, and binary compatibility options. It does not assume that matching version strings imply compatible binaries.

## Install the release

A published component declares an exact `LeanBridge::Runtime` dependency. Your CPAN client resolves that version when it is available from its configured sources:

```sh
cpanm "$LEAN_BRIDGE_PERL_MODULE"
```

Set that variable to the module name supplied by your publisher. No CPAN publication of the example below is assumed.

For an archive handoff, obtain and authenticate both archives using the publisher's checksums or signed release manifest. Set `LEAN_BRIDGE_PERL_RUNTIME_ARCHIVE` and `LEAN_BRIDGE_PERL_COMPONENT_ARCHIVE` to their absolute paths. Install the runtime first, then the component:

```sh
cpanm --local-lib-contained "$PWD/.perl5" "$LEAN_BRIDGE_PERL_RUNTIME_ARCHIVE"
cpanm --local-lib-contained "$PWD/.perl5" "$LEAN_BRIDGE_PERL_COMPONENT_ARCHIVE"
export PERL5LIB="$PWD/.perl5/lib/perl5"
```

The runtime's long decimal version identifies its complete package contents. A numerically higher version is not a substitute. If a mirror cannot resolve the pinned version, install the exact runtime archive supplied by the publisher first. Packages used together must require the same runtime version; loading and initialization remain automatic.

`auto`, the default install mode, uses compatible prebuilt XS when available. Otherwise it compiles only the supplied XS with a C compiler and headers matching this Perl. It never invokes Lean, Lake, Node, or a Lean runtime build.

| Mode | Behavior |
| --- | --- |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=auto` | Prefer prebuilt XS; compile XS if there is no match. |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=prebuilt-only` | Require a matching prebuilt binary; no compiler needed. |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=build-xs` | Compile supplied XS against local Perl headers. |

Corrupt artifacts and incompatible runtime identities are errors in every mode. They do not trigger fallback compilation.

## Call Lean

The Workshop example comes from an ordinary Lean project. Save this as `consumer.pl`:

```perl file=perl/consumer.pl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Workshop;

print LeanBridge::Workshop::add(19, 23), "\n";
my $large = Math::BigInt->new(2)->bpow(256)->badd(1);
die "integer conversion" unless LeanBridge::Workshop::echo_nat($large)->bcmp($large) == 0;

my $counter = LeanBridge::Workshop::new_counter(42);
my $adder = LeanBridge::Workshop::make_adder(7);
my $ok = eval {
  print LeanBridge::Workshop::read_counter($counter), "\n";
  print $adder->call(35), "\n";
  print LeanBridge::Workshop::with_callback(20, sub { $_[0] * 2 }), "\n";
  1;
};
my $error = $@;
$adder->close;
$counter->close;
die $error unless $ok;
```

Run `perl consumer.pl`. Expected output is `42`, `42`, `42`, then `41`, each on its own line. Imports and calls use the generated public API only.

### Options, results and products

`Option` uses `undef` for None and the generated `Some->new($value)` for Some. Unit also uses `undef`: `Some->new(undef)` preserves a present Unit or an outer Some containing an inner None, according to the declared type. Nested options keep every layer.

`Except` uses distinct `Ok->new($value)` and `Err->new($error)` classes. Both expose `->value`. Domain errors return `Err`; invalid host values and bridge failures throw exceptions.

For the package in the [author example](../publish/cpan.md#export-options-results-and-products), save `compounds.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Compounds;

my $some = 'LeanBridge::Compounds::Some';
print LeanBridge::Compounds::classify(undef), "\n";                   # 0
print LeanBridge::Compounds::classify($some->new(undef)), "\n";       # 1
print LeanBridge::Compounds::classify($some->new($some->new(undef))), "\n"; # 2

my $value = Math::BigInt->new(2)->bpow(200);
my $result = LeanBridge::Compounds::result_nat(
  LeanBridge::Compounds::Ok->new($value)
);
die "Expected Err" unless ref($result) eq 'LeanBridge::Compounds::Err';
print $result->value->bstr, "\n"; # the Lean function flips Ok to Err

my $pair = LeanBridge::Compounds::tuple_nat([
  Math::BigInt->new(10), Math::BigInt->new(20)
]);
print join(', ', map { $_->bstr } @$pair), "\n"; # 20, 10
```

Run `perl compounds.pl`. Products require a plain, dense two-element array reference. Nested products stay nested: `(a × b) × c` becomes `[[$a, $b], $c]`.

Branch classes live under the generated component namespace. They are mutable blessed hashes with exactly one `value` field; constructors require one payload even when it is `undef`. Calls check the exact class, fields and concrete payload type. Tied branches, tied products, subclass wrappers and sparse products are rejected. Calls copy nested arrays, records, bytes and `Math::BigInt` values. Mutating a returned value does not change the input or another returned copy. Perl reference equality is not deep value equality.

Input and output conversion share a 16 MiB copied-value budget. Type nesting is limited to 32 levels. These limits cover conversion payloads and slots, not all Perl allocations or Lean working memory. Resources and callbacks cannot appear inside copied values. Compounds also work as [callback arguments and results](#structured-callback-values). The [installed checks](../evidence/perl-compounds-20260920.md) cover both source paths and all four pinned Perl ABIs.

### Tagged variants

Concrete copied Lean inductives use a named family and one Perl class per
constructor. Pass payloads as named fields and read them through the generated
accessors. For the prepared acceptance package, save `variants.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Variants;

my $input = LeanBridge::Variants::Signal::Data->new(
  count => 42, label => 'ready'
);
my $result = LeanBridge::Variants::next($input);

if (ref($result) eq 'LeanBridge::Variants::Signal::Data') {
  print $result->count, ': ', $result->label, "\n"; # 43: ready!
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Idle') {
  print "idle\n";
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Stopped') {
  print "stopped\n";
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Marker') {
  die "Invalid Unit payload" if defined($result->value);
  print "marker\n";
} else {
  die "Unexpected constructor";
}
```

Run `perl variants.pl`. The family itself has no usable `new`; construct a named
case. Constructors reject missing, extra and duplicate fields. Calls check the
exact generated class, the field set and each payload type. Unknown subclasses,
unblessed hashes and tied constructor hashes reject. Empty constructors and a
constructor carrying `undef` for Unit remain distinct.

Payloads can contain all nineteen primitives, copied arrays and Lists, records,
options, results, products and other admitted variants. Calls convert only the
active payload through compiler-generated Lean helpers. Application code uses
no native constructor numbers or object layouts.

Fields and contained arrays remain mutable. Returned values own independent
copied storage; Perl reference equality does not compare payload contents.
Perl does not check that every constructor has a matching branch. Input fields
are pinned before converters can invoke Perl code, and scoped cleanup releases
partial conversions on failure. The existing 32-level schema limit and 16 MiB
conversion budget apply; they do not bound the entire Perl heap or Lean working
memory. [Recursive values](#recursive-values) use a separate bounded adapter.
Resource-bearing variants use the [explicit ownership profile](#resource-containing-values).
The [installed variant checks](../evidence/perl-variants-20260921.md) cover both
source paths and all four pinned Perl ABIs.

### Arrays and records

Lean `Array T` uses a plain, dense array reference. Copied Lean structures use
generated classes with named constructor arguments and field accessors. For
the package in the [author example](../publish/cpan.md#export-arrays-and-records),
save `parcels.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Parcels;

my $input = LeanBridge::Parcels::Parcel->new(
    label => 'Seeds',
    counts => [Math::BigInt->new(2), Math::BigInt->new(7)],
);
my $output = LeanBridge::Parcels::reverse($input);
print $output->label, ': ', join(', ', @{$output->counts}), "\n"; # Seeds: 7, 2
$output->counts->[0]->binc;
print $input->counts->[1], "\n"; # 7; the returned BigInt is a separate copy
```

Run `perl parcels.pl`. Empty arrays and records, single-field records and nested
arrays of records retain their declared types. Fields keep the scalar mappings
below, including `undef` for Unit and octet strings for ByteArray.

Calls reject blessed, tied or sparse arrays. Records require the exact generated
class and field set; tied hashes and subclasses are rejected. Record constructors
keep Perl's last-value-wins keyword semantics, so `new(%old_fields, field => $replacement)`
works as usual. Missing, extra or unnamed fields reject. Array slots and record fields are pinned
before a child conversion can invoke Perl code. Returned mutable payloads own
independent storage; reference equality does not compare their contents.

Input and output conversion share a 16 MiB copied-value budget. Schema nesting
is limited to 32 levels. These limits do not bound the whole Perl heap or Lean
working memory. The [installed collection checks](../evidence/perl-collections-20260921.md)
cover both source paths and all four pinned Perl ABIs. [Recursive copies](#recursive-values)
use a separate bounded adapter. Identity-bearing fields remain separate work.

### Lists

Lean `List T` uses a plain array reference for inputs, results and record fields.
Pass `[]` for an empty List. Elements keep their existing mappings, including
`Math::BigInt` for Nat/Int, `undef` for Unit and octet strings for ByteArray.
For the package in the [author example](../publish/cpan.md#export-lists), save
`lists.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Lists;

my $input = [1, 2, 1, 3];
my $output = LeanBridge::Lists::reverse_uint32($input);
print join(', ', @$output), "\n"; # 3, 1, 2, 1
$output->[0] = 99;
print join(', ', @$input), "\n";  # 1, 2, 1, 3
```

Run `perl lists.pl`. Lists preserve order, duplicates and nesting with arrays,
records, options, results and products. Calls reject blessed, tied and sparse
array references, invalid elements and over-budget copies. Returned arrays and
mutable payloads own independent storage. Input and output conversion share the
16 MiB copied-value budget; schema nesting is limited to 32 levels. List and
Array remain distinct Lean and IR types even though both use array references.
Lists also work as [callback arguments and results](#structured-callback-values). The [installed checks](../evidence/perl-lists-20260921.md)
cover both source paths and all four pinned Perl ABIs.

### Named copied aliases

Lean aliases use their target's ordinary Perl values. A `Count := UInt32`
argument takes an integer scalar; a `Values := List Count` argument takes an
array reference. The prepared archive retains alias names, original targets
and chains in `binding-manifest.json`. Installed POD documents the alias
catalog and the original parameter, result and record-field types. Aliases
do not create separate Perl packages or wrapper classes.

For the [author example](../publish/cpan.md#export-named-copied-aliases), save
`aliases.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Scores;

my $scores = [10, 20, 30];
my $next = LeanBridge::Scores::increment_all($scores);
print join(', ', @$next), "\n";   # 11, 21, 31
print join(', ', @$scores), "\n"; # 10, 20, 30
```

Run `perl aliases.pl`. Target checks still apply: a Nat alias requires a
nonnegative `Math::BigInt`, Unit uses `undef`, and Char requires one Unicode
scalar. Integer aliases use the existing integer-scalar checks, which also
accept native Perl booleans as 0 or 1. Containers and record payloads copy
independently. Aliases retain the existing copy budget and schema-depth bound. See the
[installed alias checks](../evidence/perl-aliases-20260921.md).

### Structured callback values

Synchronous callbacks and returned Lean closures use the same arrays, Lists,
options, results, products, records, variants and aliases as ordinary calls.
Pass a host function as a CODE reference. A returned Lean closure provides
`call`, `close` and `closed`.

For the package in the [author example](../publish/cpan.md#export-structured-callbacks),
save `structured-example.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Structured;

my $rows = [undef, LeanBridge::Structured::Some->new('copied')];
my $copied = LeanBridge::Structured::call_array($rows, sub { $_[0] });
print $copied->[1]->value, "\n";

my $payload = LeanBridge::Structured::Payload->new(
  text => 'snapshot', rows => $rows,
  count => Math::BigInt->new(2), nested => undef
);
my $closure = LeanBridge::Structured::make_record($payload);
$payload->{count}->badd(1);
my $snapshot = $closure->call(LeanBridge::Structured::true(), $payload);
$closure->close;
print $snapshot->count->bstr, "\n";
```

Run `perl structured-example.pl`. It prints `copied` and `2`: changing the Perl
input does not change the Lean closure's copied capture. Callback arguments,
results and returned mutable payloads also own independent storage. Alias
names retain their documented target representation.

Callbacks may reenter the generated API. Exceptions retain their original
Perl object identity after native cleanup. Lean may not retain a host callback
after the synchronous call returns. Close returned Lean closures when finished;
an active call keeps its borrow if the wrapper closes during conversion.

These acyclic payloads retain the 16 MiB conversion-scope budget and 32-level
schema bound. [Recursive callback payloads](#recursive-callback-values) use the
bounded graph adapter. Resources inside copied aggregates and asynchronous
delivery remain unsupported. The
[installed callback checks](../evidence/perl-structured-callables-20260925.md)
cover both source paths, all four pinned Perl ABIs and the exact example above.

### Recursive callback values

Finite recursive values work in synchronous callbacks and returned Lean
closures. Use the package in the
[author example](../publish/cpan.md#export-recursive-callbacks-and-closures).
Save `recursive-callbacks.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Recursive;

my $leaf = LeanBridge::Recursive::Tree::Leaf->new(value => Math::BigInt->new(19));
my $tree = LeanBridge::Recursive::Tree::Branch->new(children => [$leaf]);
my $copied = LeanBridge::Recursive::call_recursive($tree, sub { $_[0] });
print $copied->children->[0]->value->bstr, "\n";

my $closure = LeanBridge::Recursive::make_recursive($tree);
my $ok = eval {
  my $captured = $closure->call(LeanBridge::Recursive::true(), $leaf);
  print $captured->children->[0]->value->bstr, "\n";
  1;
};
my $error = $@;
$closure->close;
die $error unless $ok;
```

Run `perl recursive-callbacks.pl`. It prints `19` twice. Trees, arrays and
`Math::BigInt` payloads returned by callbacks or captured closures are
independent copies. A matching generated Lean closure can also serve as a
callback. None, Some, Ok, Err and nested products keep their ordinary mappings.

Callbacks run synchronously on the initiating interpreter thread. Exceptions
retain their identity after cleanup. Returned closures provide `call`, `close`
and `closed`; closing twice is safe. Automatic finalization also releases a
closure, but explicit `close` gives predictable resource use. Closures cannot
be serialized or invoked from another interpreter, thread or process.

Conversion allows 128 value levels, 262,144 visited nodes and 16 MiB of native
copied data, with a separate 16 MiB conversion-storage budget. These limits do
not cover Lean working memory or every Perl allocation. Native reentry permits
64 active calls, and closures share 4,096 identity slots. Input, callback and
limit failures leave the runtime usable; malformed native results retire it.
Resources and callable identities inside copied aggregates, retained host
callbacks and asynchronous delivery remain unsupported.

The [installed acceptance record](../evidence/perl-recursive-callables-20260925.md)
covers both source paths, all four Perl ABIs and both installation modes.

### Recursive values

For the package in the [author example](../publish/cpan.md#export-recursive-values),
save `recursive.pl`:

```perl
use strict;
use warnings;
use LeanBridge::RecursiveDemo;

my $leaf = LeanBridge::RecursiveDemo::Tree::Leaf->new(value => 41);
my $wrapped = LeanBridge::RecursiveDemo::wrap($leaf);
die "Expected Tree::Next" unless $wrapped->isa('LeanBridge::RecursiveDemo::Tree::Next');
print $wrapped->child->value, "\n"; # 41

$wrapped->child->{value} = 99;
print $wrapped->child->value, "\n"; # 99
print $leaf->value, "\n";           # 41, the input is unchanged
```

Run `perl recursive.pl`. Named constructor classes preserve each branch and
its fields. Calls check the exact generated classes and field sets. Arrays
and Lists use plain dense array references; records use named-field classes.
Returned values own independent storage, even when input branches share a
reference. Perl reference equality does not compare their contents.

Input and output conversion share limits of depth 128, 262,144 nodes and
16 MiB of native copied data, with a separate 16 MiB conversion-storage
allowance. Calls reject cycles, tied or sparse containers, malformed fields
and over-limit copies. A rejected input leaves the runtime usable. These
limits do not bound Lean working memory or every Perl allocation. Callbacks,
closures and resources cannot appear inside these copied values.

The [installed recursive checks](../evidence/perl-recursive-packages-20260923.md)
cover both source paths, four pinned Perl ABIs and both prebuilt and XS-only
installation. They also execute the example above from relocated packages.

### Resource-containing values

Packages using the [explicit ownership profile](../publish/cpan.md#export-resource-containing-values)
can put resources inside records, variants and recursive values. Install them
through the same CPAN or archive workflow. The generated module loads Lean and
its private GMP library automatically.

For the author example, save `owned.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::OwnedValues;

my ($ticket, $result, $retained);
my $ok = eval {
  $ticket = LeanBridge::OwnedValues::new_ticket(Math::BigInt->new(42), 'receipt');
  my $payload = LeanBridge::OwnedValues::Payload->new(
    count => Math::BigInt->new(-7), bytes => "\0\xff"
  );
  my $bundle = LeanBridge::OwnedValues::Bundle->new(
    primary => $ticket, spare => undef, peers => [], history => [],
    payload => $payload
  );
  $result = LeanBridge::OwnedValues::callback_record($bundle, sub {
    $retained = $_[0]->primary->retain;
    return $_[0];
  });
  print LeanBridge::OwnedValues::serial($result->primary)->bstr, "\n";
  $result->primary->close;
  $ticket->close;
  print LeanBridge::OwnedValues::serial($retained)->bstr, "\n";
  1;
};
my $error = $@;
$result->primary->close if defined $result;
$ticket->close if defined $ticket;
$retained->close if defined $retained;
die $error unless $ok;
```

Run `perl owned.pl`. It prints `42` twice. The retained resource survives both
the callback and the original ticket's closure. An unretained callback resource
expires when its callback returns.

Resource and closure wrappers expose `retain`, `close` and `closed`. Retention
creates an independent owner. Repeated `close` is safe; a plain Perl assignment
aliases the same wrapper, so closing either alias closes it for both references.
Finalization releases abandoned wrappers, but explicit cleanup gives predictable
resource use. Returned Lean closures also expose `call`.

Use exact generated record and constructor classes. Arrays and Lists use dense
array references; options use `undef` or `Some`, results use `Ok` or `Err`,
and products stay nested pairs. Calls reject cycles, tied containers, malformed
fields and resources from another component. Copied payloads retain independent
storage. Each resource belongs to its creating interpreter, thread and process;
serialization, cross-thread use and calls after fork reject.

Callbacks run synchronously and may reenter the API. Original Perl exceptions
return after native cleanup. A callback signature without an argument-derived
recovery value uses `Runtime::Callback->new(code => $callback,
recovery => $value)` wrapper, named in the package's POD. The typed recovery
value lets Lean finish cleanup after an exception; it does not turn the failure
into a successful result.

Input, callback and result conversions share depth 128, 262,144 visits and a
16 MiB native data budget, with a separate 16 MiB conversion-storage budget.
Native reentry permits 64 active calls. [Borrowed results](#borrowed-results)
use whole-value owners. Retained host callbacks and asynchronous delivery remain
unsupported.

### Consuming inputs

An author can mark an argument as consuming. Its generated POD names that
argument. Packages without borrowed results or receiver exports use the same
Perl values. Either feature requires a `Value` owner for each consuming argument.
Validation errors preserve inputs. Once Lean takes ownership, shared
aliases close even if a callback throws or converting the result fails.
An independent `retain` survives that handoff.

For the [author's transfer example](../publish/cpan.md#transfer-input-ownership),
save `consume-owned.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::OwnedValues;

my ($ticket, $retained, $result);
my $ok = eval {
  $ticket = LeanBridge::OwnedValues::new_ticket(Math::BigInt->new(42), 'receipt');
  my $alias = $ticket;
  $retained = $ticket->retain;
  my $bundle = LeanBridge::OwnedValues::Bundle->new(
    primary => $ticket, spare => undef, peers => [], history => [],
    payload => LeanBridge::OwnedValues::Payload->new(
      count => Math::BigInt->new(-7), bytes => "\0\xff"
    )
  );
  $result = LeanBridge::OwnedValues::callback_record($bundle, sub {
    die "Input still open at handoff\n" unless $alias->closed;
    return $_[0];
  });
  print $alias->closed ? "consumed\n" : "open\n";
  print LeanBridge::OwnedValues::serial($result->primary)->bstr, "\n";
  print LeanBridge::OwnedValues::serial($retained)->bstr, "\n";
  1;
};
my $error = $@;
$result->primary->close if defined $result;
$ticket->close if defined $ticket;
$retained->close if defined $retained;
die $error unless $ok;
```

Run `perl consume-owned.pl`. It prints `consumed`, `42`, and `42`. Resource leaves
from one returned aggregate can share an owner, so consuming one can close its
siblings. Retain any resource you need independently. Callback arguments are
borrowed and need an explicit `retain` before a consuming call.

### Borrowed results

An author can tie a result to an input owner's lifetime. In these packages,
resource-containing results return a `Value` owner, including empty arrays and
`None`. `get` checks that owner before exposing its Perl payload. `share` creates
another wrapper for the same owner; `retain` creates independent ownership.
Close owners explicitly when finished. Resource leaves from `get` expire when
the last whole owner closes, even if a Perl reference to the leaf remains.

For the [author's borrowed-result example](../publish/cpan.md#borrow-a-result-from-an-input),
save `borrowed.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::OwnedValues;

my ($ticket, $owner, $view, $retained);
my $ok = eval {
  $ticket = LeanBridge::OwnedValues::new_ticket(Math::BigInt->new(42), 'receipt');
  $owner = LeanBridge::OwnedValues::copy_value(
    LeanBridge::OwnedValues::Bundle->new(
      primary => $ticket->get, spare => undef, peers => [], history => [],
      payload => LeanBridge::OwnedValues::Payload->new(
        count => Math::BigInt->new(-7), bytes => "\0\xff"
      )
    )
  );
  $view = LeanBridge::OwnedValues::callback_record($owner, sub { $_[0] });
  $retained = $view->retain;
  print LeanBridge::OwnedValues::serial($view->get->primary)->bstr, "\n";
  $owner->close;
  print $view->closed ? "expired\n" : "unexpectedly open\n";
  print LeanBridge::OwnedValues::serial($retained->get->primary)->bstr, "\n";
  1;
};
my $error = $@;
$_->close for grep { defined } ($ticket, $owner, $view, $retained);
die $error unless $ok;
```

Run `perl borrowed.pl`. It prints `42`, `expired`, and `42`. An expired owner's
`get` or `retain` raises a closed-resource error. Borrowing again from a borrowed
result preserves the original dependency. Resources expose `same_identity` to
compare native identity across different views; expired operands reject.

Use `copy_value($value, result_of => 'function')` for a container whose schema
cannot be inferred from its Perl class. `parameter_of => ['function', 0]`
selects a parameter by index; its declared name also works. These selectors
preserve the owners of empty containers and `None`.

Consuming parameters in these packages take whole `Value` owners and consume
their original native slots. Shared owners and borrowed descendants expire
together. Independently retained owners survive. A borrowed result must be
retained before it can be consumed. Packages without borrowed results, receiver
exports, or callback-result anchors keep the ordinary-value API described above.

### Callback-result owners

A returned Lean closure can declare that its result borrows one of its call
arguments. Pass a whole `Value` owner at that argument position. The result and
its descendants expire when the original argument owner closes or transfers,
even if the closure itself remains open. This applies to empty containers too.
Call `retain` before that happens to keep an independent result.

The closure's `copy_arg0`, `copy_arg1`, and other generated factories make whole
owners for its resource-containing arguments. The numbers refer to the closure's
visible arguments, starting at zero; they do not count the closure itself.
`copy_result` makes an independent owner for its result type. These factories
also handle container types that have no named Perl class.

Host callbacks in these packages can return the declared raw Perl value or a
whole result owner. The bridge checks and copies the reply before the callback's
borrowed arguments expire. Recovery values use the same rule. An already-closed
owner is rejected, and a returned native closure keeps its identity when passed
back to Lean.

The [Perl callback-result evidence](../evidence/owned-perl-callback-results-20261003.md)
records direct-runtime checks and installed combined-capability CPAN packages.
The [optional installed extension](../evidence/owned-perl-callback-result-variants-20261003.md)
also validates ordinary-source and reviewed-IR no-host and host-only packages
on four pinned Perl ABIs, using both prebuilt-only and build-XS installation.
The no-host producer uses the installed native build API, not a CLI build flag.
Neither receipt promotes the versioned type-conversion table below or claims
installed native allocation counters.

### Methods and properties

Declared receivers become `snake_case` methods on nominal owners such as
`TicketValue` and `BundleValue`. Properties are read-only, zero-argument methods.
For the [author's receiver contracts](../publish/cpan.md#export-methods-and-properties),
save `members.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::OwnedValues;

my ($ticket, $owner, $view, $retained);
my $ok = eval {
  $ticket = LeanBridge::OwnedValues::new_ticket(Math::BigInt->new(42), 'receipt');
  $owner = LeanBridge::OwnedValues::copy_value(
    LeanBridge::OwnedValues::Bundle->new(
      primary => $ticket->get, spare => undef, peers => [], history => [],
      payload => LeanBridge::OwnedValues::Payload->new(
        count => Math::BigInt->new(-1), bytes => "\0\xff"
      )
    )
  );
  $view = $owner->callback_record(sub { $_[0] });
  $retained = $view->retain;
  print $view->get->primary->serial->bstr, "\n";
  $owner->close;
  print $view->closed ? "expired\n" : "live\n";
  print $retained->get->primary->serial->bstr, "\n";
  1;
};
my $error = $@;
$_->close for grep { defined } ($ticket, $owner, $view, $retained);
die $error unless $ok;
```

Run `perl members.pl`. It prints `42`, `expired`, and `42`. `share`, `retain`,
and `copy_value` preserve the nominal owner's methods. A receiver-anchored
result follows the original receiver owner; an argument-anchored result follows
the selected argument owner. Independent retains survive either owner's closure.
Consuming methods invalidate the original owner and its shared aliases at the
Lean call boundary.

Raw resources expose methods that need neither a receiver anchor nor a consuming
receiver. Use the whole owner for those lifetime-sensitive methods. Ordinary
module-level functions remain available. Packages with receiver exports use
whole-value owners even when they declare no borrowed results.

### Bounded integers

The [scalar Fin checks](../evidence/perl-scalar-20261009.md) and [container refinement checks](../evidence/perl-refinements-20261009.md) cover ordinary-source and reviewed-IR packages on Perl 5.36.3 and 5.38.2, each threaded and unthreaded. Both suites rerun the installed consumer after moving its complete installation. The scalar suite also measures entry into three named Lean functions and confirms that its invalid-only calls enter none of them.

A Lean `Fin n` parameter or result is a `Math::BigInt`, the same as `Nat`. For `Library.mirror (value : Fin 10) : Fin 10`, `mirror(Math::BigInt->new(3))` returns `6`. `mirror(Math::BigInt->new(10))` dies with the message `arg0 is not below its Fin 10 bound`. A negative value dies with the error that `Nat` raises, and a value that is not a `Math::BigInt` dies as for `Nat`. The generated XS compares each argument with its exact bound, including bounds wider than 64 bits, before the guarded adapter or the exported function runs, so caller data is unchanged. `Fin` inside an array, `List` or option is checked the same way for every present element: an empty array reference or `undef` is accepted even for `Fin 0`, a present `Fin 0` element is rejected, and the message names the failing element's path and bound, for example `arg0[2]? is not below its Fin 10 bound` for the third element of an array of options or `arg0[1][0] is not below its Fin 10 bound` for the first element of the second row. The package POD lists each checked path, such as `arg0[*]? < 10`.

Both ordinary-source and independently reviewed packages preserve Fin bounds in pairs, active `Except` branches and plain record or variant fields, including Array/List/Option compositions. Use `Math::BigInt` for each bounded value. The [hosted product and field checks](../evidence/fin-native-hosted-20261010/receipt.json) cover all four Perl ABIs. Empty containers, absent options and inactive Fin 0 payloads are valid; present Fin 0 values reject without changing caller data. These reports do not add recursive, generic, indexed or callback refinements.

### Checked values

Independently reviewed packages support top-level primitive-base `Subtype`
parameters and results. The [reviewed native checks](../evidence/reviewed-subtype-native-promotion-20261010.md)
ran twelve exports with 2,025 checks on each of Perl 5.36.3 and 5.38.2, threaded and unthreaded. They verify constructor selection,
normalization, rejection recovery and replay after moving the installed package.
Error messages use the parameter names in the reviewed API. These earlier runs cover top-level parameters and results and did not measure
dispatch counts.

A Lean `Subtype` parameter or result over a primitive base, such as `{ value : String // value.length > 0 }`, uses the base's usual Perl value: a `Math::BigInt` for `Nat` and `Int`, an integer scalar for machine words, a text scalar for `String` and an octet string for `ByteArray`. The generated XS runs the author's checked constructor from the export contract, through the exported validator, after every `Fin` bound passed and before the guarded adapter or the exported function; a rejected value dies with a message naming the parameter and constructor (`arg0 was rejected by Library.checkedWord`), and caller data stays unchanged. The exported function receives the constructed value, which a normalizing constructor may change. The package POD names each constructor. These earlier checks cover top-level parameters and results.

Ordinary-source packages have [installed checks](../evidence/perl-refinements-20261009.md) for `String`, `Nat`, `Int`, `ByteArray` and `UInt32` on Perl 5.36.3 and 5.38.2, threaded and unthreaded. These checks include rejection, normalization, recovery and a full rerun after moving the installed package. Reviewed packages have the separate twelve-export acceptance described above.

### Checked records

A Lean record can carry proofs relating its runtime fields. Pass only those
fields in the generated Perl class. The Lean function call runs the selected
checked constructor; creating the Perl object alone does not establish the
Lean invariant.

For the installed `LeanBridge::CheckedRecords` acceptance package, save
`checked-records.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::CheckedRecords;

my $interval = LeanBridge::CheckedRecords::Interval->new(
    lo => Math::BigInt->new(3),
    hi => Math::BigInt->new(10)
);
print LeanBridge::CheckedRecords::width($interval)->bstr, "\n"; # 7
```

The [Lean example and export contract](../lean/existing-package.md#export-a-record-with-proof-fields)
select `CheckedRecords.mkInterval` to check `lo <= hi`. An invalid interval
dies with the parameter and constructor name. A selected constructor can
normalize accepted payloads without changing the caller's record. Results
contain copied payload fields and no proofs.

For a type such as `Sized 3`, the generated record contains its `data` array
reference; the fixed length stays in the package's type metadata. Pass
`Math::BigInt` elements. The checked constructor validates the length at the
call boundary. Lean-produced records also work in packages that have no
checked inputs.

[Installed checks](../evidence/checked-record-perl-installed-20261011.md) cover
ordinary and independently reviewed packages, including separate result-only
packages, on all four pinned Perl ABIs and both installation modes.

The [closed value-index archive](../evidence/checked-record-value-index-perl-promotion-20261020.md)
adds top-level copied records indexed by closed `Bool`, `String`, and `Nat`
values. The index remains authenticated Lean metadata rather than a Perl field;
`Math::BigInt` carries every Nat payload field.

The [nested `Packet` archive](../evidence/nested-checked-record-perl-20261016/index.json)
adds a record containing a `Fin 10` digit and a checked `Nat` subtype word. Full
packages cover direct and repeated parameters, `Array`, `List`, `Option`,
products, both `Except` branches, `Holder.packet`, and the active
`Choice::Packet` field. Result-only packages return `Array Packet` and
`Option Packet` without checked-input metadata. The generated adapter runs each
selected inner constructor before the outer record constructor. Rejected graphs
remain unchanged, and later valid calls recover.

Both author routes reproduce complete CPAN component and runtime archives from
two roots. The harness removes author sources before each offline, source-free
package installation, then runs the unchanged caller before and after moving the
complete installation. Threaded and unthreaded Perl 5.36.3 and 5.38.2 each run
in prebuilt-only and build-XS modes, giving sixteen installed executions per
selection on Linux x64/glibc 2.36. Lean erases proof fields before compilation;
the installed runtime performs only the selected `Fin`, `Subtype`, and record
boundary checks. The [dedicated workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-perl.yml)
rebuilds all four selections on Ubuntu 24.04 with the glibc 2.38 floor.

[Inherited checked-record acceptance](../evidence/inherited-checked-record-promotion-20261018.md)
separately covers the tested proof-free `Span → Ticket → Stamped` chain. Generic
or recursive checked records, value-carrying receiver-dependent inherited fields,
other index kinds, open dependent or zero-payload records, callbacks and owned
positions remain unfinished.

## Values and cleanup

### Arrays of generic records

Ordinary-source packages also accept Array-valued fields and arrays of alias-named generic records. Use the generated record types and the array representation listed below; no Lean type arguments are passed at runtime. The [native Array acceptance](../evidence/generic-record-array-rollout-20261009.md) covers round trips, empty arrays, invalid members and recovery while retaining the original List, Option and specialization checks. These are local installed-package results; the page records their exact runtime scope.

### Subtypes inside containers

Ordinary-source and reviewed packages also accept checked `Subtype` leaves
inside `Array`, `List`, `Option`, products and `Except`. Use the base value
inside each generated host container listed in the conversion table. The package
runs the selected Lean constructor for each present leaf; absent options, empty
containers and inactive branches need no value or proof. Accepted normalization
reaches the Lean export. Rejection leaves the caller's input unchanged, and a
subsequent valid call can use the same package.

The [installed structural checks](../evidence/structural-subtype-promotion-20261011.md)
cover primitive `Nat`, `String` and `UInt8` bases, mixed `Fin`, transparent
aliases with distinct constructor choices, and one closed `List` specialization.
They cover both author routes on all four pinned Perl ABIs in both installation modes.
Directional callback Subtypes use the explicit recovery and returned-closure
rules below. Owned Subtypes remain unsupported. These local runs do not measure
dispatch counters or memory, or establish hosted release-floor acceptance.

### Subtypes in copied records

Ordinary-source and reviewed CPAN packages accept checked Subtype fields inside
acyclic copied records and variants. Use the generated record or case wrapper
and pass each checked field as its primitive's Perl value: `undef` for `Unit`,
a native boolean from the generated `true()`/`false()` for `Bool`, IV or UV
scalars for fixed-width integers and machine words, `Math::BigInt` for `Nat`
and `Int`, NV scalars for `Float32` and `Float`, and strings for `String`,
`Char` and `ByteArray`. The tested Linux x64 packages use 64-bit machine words.
Each export site selects its own checked Lean constructor, so two uses of the
same record can normalize the same input differently. Only the active variant
case runs its field constructors. Rejected calls identify the field or active
case, leave caller data unchanged, and do not prevent later valid calls.

Copied results contain the values Lean produced. They do not run an input
constructor, including in standalone result-only packages. The
[original nominal checks](../evidence/nominal-subtype-perl-acceptance-20261012.md)
cover Nat fields, aliases, nested containers, repeated fields, mixed Fin checks
and 100-bit results. The
[expanded installed checks](../evidence/nominal-primitive-subtype-perl-20261015/index.json)
cover all nineteen primitive bases: `Unit`, `Bool`, unsigned and signed
fixed-width integers, `Nat`, `Int`, `Float32`, `Float`, `String`, `ByteArray`,
`Char`, `USize` and `ISize`. Ordinary and reviewed packages reproduce the same
complete CPAN component and runtime archives from two author roots. Full and
standalone result-only APIs install offline after author removal, as
prebuilt-only and build-xs deliveries, and replay unchanged callers after
physical relocation on all four pinned Perl ABIs (5.36.3 and 5.38.2, threaded
and unthreaded), using Linux x64/glibc 2.36 with an explicit 2.36 package
floor. The four accepted selections ran serially under two frozen producer
revisions with recorded per-run host-load admission ceilings; four other
launches are preserved in the archive and not counted. The Perl caller's check
counts equal the Python caller's; that equality is a consistency check between
callers, not evidence borrowed from Python.

The [required Perl workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-perl.yml)
runs those four selections on the hosted glibc 2.38 floor. The local archive
does not establish its hosted result. Refined callbacks, owned values,
recursive and broader generic or dependent Subtypes, plus constructor/source
entry counts and memory measurement, remain separate work.

### Type conversions

Profiles: Perl. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

[Hosted zero-payload checked-record acceptance](../evidence/zero-payload-checked-record-matrix-closure-20261022.md) covers Perl in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The tested copied parameters and results distinguish proof-only Witness, Unit-bearing Token, plain empty Marker, Option presence, arrays and both Mark branches. Fields, callback positions, owned positions and other zero-payload shapes remain outside this evidence.

[Hosted dependent checked-record acceptance](../evidence/dependent-checked-record-promotion.md) covers Perl in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The proof-free host value carries the tested runtime bound and bounded value. Full packages validate inputs with the selected dependent constructor before Lean execution; standalone result-only packages expose Lean-produced values without checked-input metadata. Fields, callbacks, owned positions, other dependent field kinds, nested or recursive dependent records and open or opaque indices remain outside this evidence.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `undef` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `Native Perl boolean scalar; generated true()/false()` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Requires a native Boolean value; does not use Perl truthiness as a conversion. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Exact 64-bit integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Preserves the complete UInt64 range with UV; no intermediate floating point. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Exact 64-bit integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Preserves signed 64-bit endpoints with IV; no intermediate floating point. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Math::BigInt (nonnegative)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Requires Math::BigInt; rejects negative values and nonfinite decimal text. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Math::BigInt (signed)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Requires Math::BigInt; preserves sign and magnitude. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Numeric scalar (NV), rounded to binary32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Numeric scalar (NV), binary64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `Unicode scalar string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Preserves Unicode scalar values and embedded NUL; rejects invalid Unicode. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Octet scalar string, UTF-8 flag off` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Requires an unflagged octet string; copies owned result bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Plain dense array reference` (input, result, field); `Plain array reference with independently copied elements` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Plain unblessed, untied dense array references preserve all nineteen primitive elements, empty arrays, order, duplicates, nested records and independent copied payloads. Input slots are pinned before converters invoke Perl. Calls reject malformed elements, sparse arrays, fixed-schema cycles and over-budget copies, then recover. Weak references do not affect array admission. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `undef or Some` (input, result, field); `undef or generated Some(value), including Some(undef)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | None is undef; Some->new(value) retains presence. Some->new(undef) preserves present Unit or an outer Some containing None, according to the declared payload type. Some->new(Some->new(undef)) preserves two layers. Branches are exact generated classes with one mutable value field; subclasses, tied hashes and malformed field sets are rejected. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok or Err` (input, result, field); `Generated Ok(value) or Err(error)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean Except E T becomes Ok->new(value) or Err->new(error), both exposing ->value. Exact classes preserve the success/error branch, including same-typed payloads. Payloads are copied and checked against the concrete Lean type. Domain errors return Err; bridge failures throw. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Plain two-element array reference (nested binary products)` (input, result, field); `Two-element array reference (nested binary products)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two dense elements in an unblessed, untied array reference, preserving binary nesting and per-position validation. Inputs and outputs share a 16 MiB copied-value budget. Returned arrays, records, branch payloads and Math::BigInt values are independently owned. Perl reference equality is not deep value equality. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Exact generated record class with named fields` (input, result, field); `Generated blessed record with named fields` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Named generated classes preserve field identity, order and meaning, including empty, one-field and nested records. Record constructor keywords keep Perl last-value-wins hash semantics; missing, extra or unnamed fields reject. Calls require the exact class and plain untied hash; subclasses reject. Fields are pinned before converters invoke Perl. Returned records, arrays, octet strings and Math::BigInt payloads own independent copied storage. Perl reference equality is not deep value equality. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Perl target value; named Lean contract in archive metadata and installed POD` (input, result, field); `Target's Perl value without an extra wrapper` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Aliases preserve exact target conversion rules, original type names and independent copied storage. Nat requires nonnegative Math::BigInt; Unit uses undef; Char requires one Unicode scalar. Integer-scalar inputs include Perl native Boolean scalars as 0 or 1, matching the existing integer target checks. List/Array identity, Option/Result presence, 32-level schema depth and the 16 MiB shared copy budget remain unchanged. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `named Perl constructor class with keyword payloads` (input, result, field); `Generated constructor class with named payload fields` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Construct values with Family::Case->new(field => value). Calls require exact generated classes and fields. Empty constructors and undef Unit payloads stay distinct. Inputs and outputs own independent copied storage. Input fields are pinned before child conversion can invoke Perl. Compiler-owned helpers construct variants and read active payloads without exposing native constructor numbers or object layouts. Invalid tags reject before getters; scoped cleanup releases partial conversions on exceptions. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Generated resource object with close/closed and canonical identity` (input, result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `CODE reference, valid for the synchronous call` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `Plain array reference` (input, result, field); `Plain array reference with independently copied elements` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Plain dense unblessed, untied array references preserve empty Lists, order, duplicates and nesting. Returned arrays and mutable payloads own independent storage. Calls reject invalid containers, sparse elements, malformed payloads and oversized copies. Typed Lean helpers avoid cons-cell layout assumptions. Sequence slots are pinned before element conversion can invoke Perl code; exceptions release temporary values and preserve the original host error. Weak references to input arrays do not affect admission. Callback arguments, results and captured values preserve constructor identity, option presence and independent mutable storage. Host exceptions retain their original objects after cleanup. Invalid fields, expired borrows and over-budget copies reject without retaining conversion owners or closure leases. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `text scalar` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Inputs must be text scalars; numeric-only values and references are rejected. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `unsigned integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `signed integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | `Math::BigInt checked against the declared bound` (input); `Math::BigInt below the bound` (result); `Math::BigInt checked against the field's closed bound` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Use Math::BigInt with the exact closed bound, including inside Array/List/Option/Prod/Except compositions, plain records and active variant fields. Empty containers, absent options and inactive Fin 0 branches are valid; present Fin 0 values are rejected. Rejections preserve caller values and name the failing path and bound. For Option, use undef for absence and the generated Some->new(value) for presence. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | `Primitive base value checked by the named Lean constructor; also in generated structural containers; also in tested acyclic records and variants` (input); `Constructed subtype projected to its primitive base value; also in generated structural containers; also in tested acyclic records and variants` (result); `declared primitive's host value in generated blessed record and variant wrappers across nineteen tested bases; no proof field` (field); `base values checked by the selected constructor in returned-closure inputs` (callback input); `base values from a host callback checked by Lean with an explicit Runtime::Callback recovery` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass the primitive base value, including inside Array, List, Option, Prod and Except containers using their generated host representations. Each present Subtype leaf uses the selected checked Lean constructor; accepted normalization reaches the export. A rejected leaf fails the call without changing the input; later valid calls still work. Results expose the proof-backed base values. Transparent aliases and the tested closed List specialization keep their constructor choices. In Perl, checked fields retain the declared primitive's host representation across all nineteen tested bases: undef for Unit, the generated native boolean for Bool, IV or UV scalars for fixed-width integers and native machine words, Math::BigInt for Nat and Int, NV scalars for Float32 and Float, and strings for String, Char and ByteArray. Generated blessed wrappers carry the record and variant fields. Each input site keeps its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves caller values and later valid calls succeed. Copied results project existing Lean payloads without proof fields or input constructor selections, including standalone result-only packages. Use Runtime::Callback->new(code => $callback, recovery => $value) for a host callback with a checked result. Lean checks the recovery before the callback can run and checks every returned value; the recovery is never successful output. Returned Lean closures validate checked inputs before invoking their body. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | `Generated Perl record with Math::BigInt and plain array-reference payload fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved; Exact blessed Perl Witness class backed by a plain empty hash; Token keeps Unit and Marker remains a distinct blessed class` (input, result); `Generated Perl Packet class with Math::BigInt digit and word fields nested inside Holder and Choice::Packet; no proof field; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free recursive Packet and Envelope/Step graphs with nominal identities and active variants preserved` (field); `proof-free generated Perl record objects validated by the selected constructors when passed to returned Lean closures` (callback input); `proof-free generated Perl record objects returned by Runtime::Callback with an exact typed recovery value` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass generated record objects containing Math::BigInt values and plain array references, without proofs. Lean runs the selected constructor for each input; it may normalize accepted data, or reject with the parameter and constructor name while preserving caller values. Results contain independent copied payload fields with proofs erased. Ordinary and reviewed packages, including standalone result-only packages, passed installed checks. The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as Math::BigInt values. Holder nests Packet, and Choice::Packet carries it in the active Choice branch. Generated Perl adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Closed Bool, String and Nat indices remain authenticated metadata rather than Perl fields. Generated blessed records use `Math::BigInt` for `count`, `size` and every `EmptySized.data` element. Full packages exercise exact per-site constructors, negative-Nat host refusal, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata. Proof-only Witness crosses as an exact blessed Perl class backed by a plain empty hash. Token retains its Unit value, Marker remains a distinct blessed class, undef stays distinct from a present Witness, arrays retain length, and Mark keeps its branch. Full CPAN packages validate exact classes across four ABI interpreters, the nullary constructor and recovery; result-only packages project Lean-produced proof-erased values without input-constructor metadata. The proof-free host value carries bound and below as payload fields. Full packages validate each host input through the selected DependentRecords.mkDependent constructor, which rejects below >= bound before Lean code runs, preserve rejected caller values and return the exact proof-free result. Standalone result-only packages expose Lean-produced results without checked-input metadata. Pass generated record objects containing Math::BigInt values and plain array references, without proofs. Lean runs the selected constructor for each input; it may normalize accepted data, or reject with the parameter and constructor name while preserving caller values. Results contain independent copied payload fields with proofs erased. Ordinary and reviewed packages, including standalone result-only packages, passed installed checks. The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as Math::BigInt values. Holder nests Packet, and Choice::Packet carries it in the active Choice branch. Generated Perl adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Perl passes generated record objects and uses Runtime::Callback recovery for host callbacks returning checked records. Recovery is validated before callback entry and is never successful output. Returned Lean closures apply nested-field constructors before the enclosing record constructor. Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named Perl record/constructor classes, plain array references, explicit Some/Ok/Err` (input, result, field); `Named Perl records and constructors, array references, synchronous CODE callbacks and owned LeanClosure values` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Use exact generated classes and named fields. Arrays and Lists use plain dense array references; aliases retain their target representation. Unit uses undef, Option presence uses Some, and Nat/Int use Math::BigInt. Values own independent copied storage. Calls reject cycles, malformed branches and excessive copies before native entry. Registered destructors release scratch storage and native outputs on exceptions and delivered signals. Malformed native output retires the shared runtime; retained copied values remain usable. Process, interpreter and thread ownership remain enforced. Recursive records, variants and aliases retain their public representations and independent copied storage. Callback frames retain reply buffers until native copying finishes; callback exceptions propagate after cleanup without losing their identity. Malformed native output retires the runtime. Private closure leases release on close or finalization, with deferred release during active invocation. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Concrete named Perl subroutine for each configured specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Each configured type application becomes a distinct monomorphic Perl subroutine. The unspecialized Lean declaration is absent. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Array-valued fields and arrays of alias-named records use the host's ordinary array representation with recursive element checks. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | `Concrete Perl signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean elaboration supplies configured type arguments before native compilation; Perl passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | `Concrete Perl signature with the Lean-selected instance dictionary erased` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean synthesizes the selected dictionary before native compilation. Perl cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Generated closure object with call, close and closed` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Workshop example API

| Lean type | Perl representation | Conversion |
| --- | --- | --- |
| `Bool` | Native boolean scalar; generated `true()` / `false()` | Strings and arbitrary truthy values are rejected. |
| `UInt32` | Exact integer scalar | Full range `0..4294967295`; no numeric-text coercion. |
| `String` | Unicode scalar string | Preserves embedded NUL and Unicode; rejects surrogates. |
| `ByteArray` | Unflagged octet string | Use `pack`; UTF-8-flagged strings are rejected. |
| `Array UInt32` | Array reference of exact integers | Copies each element and validates its range. |
| `Packet` | Generated `LeanBridge::Workshop::Packet` | A copied record containing another record, an array and a boolean. |
| `Counter` | Generated resource object | Canonical identity, `close`, and `closed`; a closed value is not `undef`. |
| `Nat` / `Int` | `Math::BigInt` | Exact sign and magnitude, with a 16 MiB per-call copy budget. |
| `UInt32 → UInt32` | CODE reference on input; generated callable object on output | Host callbacks are synchronous; returned Lean closures provide `call` and `close`. |

Fixed-width signed and unsigned integers use Perl's 64-bit integer representation, never an intermediate floating-point value. `Float32` rounds to binary32; `Float` uses binary64. NaN classification, infinities and signed zero are supported; NaN payload bits are not preserved as a contract.

Ordinary-source and reviewed CPAN packages support all nineteen primitives in synchronous callback arguments/results and returned-closure calls. The same host representations and checks apply there, including `Math::BigInt`, one-scalar `Char`, and 64-bit `USize`/`ISize`. [Installed tests](../evidence/perl-callables-20260918.md) check exact values, captured state, malformed callback returns, nested calls and cleanup. A returned closure's arguments are passed to `call`; release its captured Lean values with `close`.

When a host callback result contains a selected checked `Subtype`, pass a
`LeanBridge::YourModule::Runtime::Callback` instead of a bare CODE reference:

```perl
my $callback = LeanBridge::YourModule::Runtime::Callback->new(
    code => sub { $_[0]->copy->badd(1) },
    recovery => Math::BigInt->new(1),
);
my $result = LeanBridge::YourModule::call_host($callback);
```

The recovery has the callback's exact erased result shape. The adapter validates
and copies it before Lean or the callback runs, then Lean applies the selected
constructor to the callback's actual result. An invalid recovery prevents the
CODE reference from running. An invalid result or Perl exception preserves the
first failure, suppresses later callbacks in that call and leaves the runtime
usable. The recovery only completes Lean's failure path; it is not returned as
success. A returned Lean closure with checked `Subtype` arguments needs no
recovery. Its `call` validates those arguments first, preserves rejected caller
values and remains usable until `close`.

A host callback that replies with a checked record uses the same
`Runtime::Callback` wrapper with a generated record as its recovery, for
example `Interval->new(lo => ..., hi => ...)` carrying payload fields only.
The adapter validates and copies the recovery before Lean or the CODE
reference runs; Lean then applies the selected record constructor to the
actual reply, a checked payload field's own constructor first. A reply that
fails either constructor dies after exactly one callback invocation and leaves
later calls usable. Records Lean produces for the host, as callback arguments
or returned-closure results, are the same generated objects without proof
fields; a returned Lean closure constructs its checked-record arguments before
its body runs, and records inside `Some`, array references or `Ok` keep the
direction of their site. The `callback-checked-record-perl` workflow describes
the installed acceptance on all four pinned interpreters.

Float parameters accept integer or floating-point scalars. Native boolean scalars also carry integer values and are accepted in fixed-width integer parameters. Numeric text such as `'12'` is rejected. `Bool` parameters still require native booleans, not arbitrary numbers or strings.

## Ownership and failures

Arrays, records, options, results, products and finite recursive values are copied. Identity resources remain in the shared Lean runtime and retain their nominal type across components. Call `close` when finished; finalization is a fallback. Closing twice is harmless.

Callbacks may reenter the generated API. A callback can close the resource or closure involved in its own call; the active call retains what it needs until it returns. Perl exceptions, including exception objects, are rethrown after native cleanup. Lean may not retain a host callback beyond that call. An expired callback fails safely when invoked later.

Keep calls and handles in the creating process, Perl interpreter and thread.
Calls and fresh imports reject inherited runtime state after a fork. Automatic
cleanup discards inherited wrappers without entering Lean or changing the
parent's resources. Start a fresh process before importing the module when
process isolation is needed. Cross-interpreter handles, retained host callbacks,
asynchronous calls and iterators are not supported.

### Verify the installation

Use `perl -MLeanBridge::Workshop -e 'print LeanBridge::Workshop::add(19,23), "\n"'` to check the example release. `perldoc LeanBridge::Workshop` lists the generated functions. Installed packages retain a receipt identifying the chosen XS binary and, for fallback builds, the XS source, Perl ABI, compiler, linker and commands. Native Lean libraries must remain byte-identical to the release inputs.

## Start from a raw Lean package

Follow [the Perl build-and-publish guide](../publish/cpan.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

Maintainers can run the [installed consumer checks](../contributing/testing.md#consumer-acceptance).
