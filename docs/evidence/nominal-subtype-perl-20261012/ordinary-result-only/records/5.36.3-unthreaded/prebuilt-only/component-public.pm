package LeanBridge::NominalSubtypes;
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Runtime;
die "Incompatible shared Lean runtime package version\n" unless $LeanBridge::Runtime::VERSION eq '0.0020592716822581412637753637152461205682916576183240901183894178635322362377514011';
use XSLoader;
our $VERSION = '1.000';
LeanBridge::Runtime::_load_component(__FILE__, 'libcomponent_7f8bfe55e5831a9133c5.so', '2e275d73caf7f0f531dac887cee6833e3bb953d5098bc94483c2e82a04171990', '12ae9a901392dc563536477c96fa46c1f72387387097b7c4d3e2c22d01815302', { 'NominalSubtypes' => 'a6a8860e98d12739ef16ea0b92b003a9e752326f39517dfe7eeb9d8b53ef3108' }, 'nominalsubtypes@1.0.0');
XSLoader::load(__PACKAGE__, $VERSION);
sub true () { !!1 }
sub false () { !!0 }
sub CLONE_SKIP { 1 }

package LeanBridge::NominalSubtypes::Some;
sub new {
  die "LeanBridge::NominalSubtypes::Some->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalSubtypes::Some';
  return bless { value => $_[1] }, 'LeanBridge::NominalSubtypes::Some';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalSubtypes::Ok;
sub new {
  die "LeanBridge::NominalSubtypes::Ok->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalSubtypes::Ok';
  return bless { value => $_[1] }, 'LeanBridge::NominalSubtypes::Ok';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalSubtypes::Err;
sub new {
  die "LeanBridge::NominalSubtypes::Err->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalSubtypes::Err';
  return bless { value => $_[1] }, 'LeanBridge::NominalSubtypes::Err';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalSubtypes::Envelope;
sub new {
  die "LeanBridge::NominalSubtypes::Envelope->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalSubtypes::Envelope';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid record field\n" if !defined($key) || ref($key);
    $fields{$key} = $value;
  }
  my @required = qw(payload digit);
  die "record fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalSubtypes::Envelope';
}
sub payload { $_[0]->{payload} }
sub digit { $_[0]->{digit} }
package LeanBridge::NominalSubtypes::AliasPair;
sub new {
  die "LeanBridge::NominalSubtypes::AliasPair->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalSubtypes::AliasPair';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid record field\n" if !defined($key) || ref($key);
    $fields{$key} = $value;
  }
  my @required = qw(left right);
  die "record fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalSubtypes::AliasPair';
}
sub left { $_[0]->{left} }
sub right { $_[0]->{right} }
package LeanBridge::NominalSubtypes::Event;
sub new { die "select a named variant constructor\n" }

package LeanBridge::NominalSubtypes::Event::Empty;
our @ISA = ('LeanBridge::NominalSubtypes::Event');
sub new {
  die "LeanBridge::NominalSubtypes::Event::Empty->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalSubtypes::Event::Empty';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw();
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalSubtypes::Event::Empty';
}

package LeanBridge::NominalSubtypes::Event::Box;
our @ISA = ('LeanBridge::NominalSubtypes::Event');
sub new {
  die "LeanBridge::NominalSubtypes::Event::Box->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalSubtypes::Event::Box';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw(value);
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalSubtypes::Event::Box';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalSubtypes::Event::Choices;
our @ISA = ('LeanBridge::NominalSubtypes::Event');
sub new {
  die "LeanBridge::NominalSubtypes::Event::Choices->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalSubtypes::Event::Choices';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw(values);
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalSubtypes::Event::Choices';
}
sub values { $_[0]->{values} }

1;

__END__
=head1 NAME

LeanBridge::NominalSubtypes - Generated functions from nominalsubtypes

=head1 API

=head2 array_values

Calls C<NominalSubtypes.arrayValues> in the compiled Lean component.

Checked Lean Fin bounds: result[*] projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<arrayE<lt>natE<gt>>.

=head2 branch

Calls C<NominalSubtypes.branch> in the compiled Lean component.

Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<resultE<lt>nat, natE<gt>>.

=head2 event_choices

Calls C<NominalSubtypes.eventChoices> in the compiled Lean component.

Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<Event>.

=head2 event_empty

Calls C<NominalSubtypes.eventEmpty> in the compiled Lean component.

Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<Event>.

=head2 event_value

Calls C<NominalSubtypes.eventValue> in the compiled Lean component.

Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<Event>.

=head2 group_values

Calls C<NominalSubtypes.groupValues> in the compiled Lean component.

Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.

Parameter C<arg0>: C<nat>. Returns C<arrayE<lt>optionE<lt>EnvelopeAliasE<gt>E<gt>>.

=head2 list_values

Calls C<NominalSubtypes.listValues> in the compiled Lean component.

Checked Lean Fin bounds: result[*] projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<listE<lt>natE<gt>>.

=head2 no_items

Calls C<NominalSubtypes.noItems> in the compiled Lean component.

Checked Lean Fin bounds: result[*] projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<arrayE<lt>natE<gt>>.

=head2 optional

Calls C<NominalSubtypes.optional> in the compiled Lean component.

Checked Lean Fin bounds: result? projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<optionE<lt>natE<gt>>.

=head2 pair_values

Calls C<NominalSubtypes.pairValues> in the compiled Lean component.

Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.

Parameter C<arg0>: C<nat>. Returns C<AliasPair>.

=head2 produce_envelope

Calls C<NominalSubtypes.produceEnvelope> in the compiled Lean component.

Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3.

Parameter C<arg0>: C<nat>. Returns C<Envelope>.

=head2 product

Calls C<NominalSubtypes.product> in the compiled Lean component.

Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<tupleE<lt>nat, natE<gt>>.

=head2 scalar

Calls C<NominalSubtypes.scalar> in the compiled Lean component.

Checked Lean Fin bounds: result projects the Subtype base value.

Parameter C<arg0>: C<nat>. Returns C<nat>.

=head1 COPIED ALIASES

Alias names, original targets and chains remain in the binding manifest and this POD. Call with ordinary Perl target values; aliases do not create separate packages or wrapper classes. Nat requires a nonnegative Math::BigInt; Int accepts negative values. Fixed-width and machine-word integers retain their ranges. Char requires one Unicode scalar. Unit uses undef. Copied payloads own independent storage. Existing copy budgets, schema depth and ownership checks apply. Recursive copies, compound callables and identity-bearing alias targets remain unsupported.

=over 4

=item C<EnvelopeAlias>

Contract: C<Envelope>. Perl value: C<LeanBridge::NominalSubtypes::Envelope>.

=back

=head1 RECORD FIELD CONTRACTS

=over 4

=item C<AliasPair.left>

Contract: C<arrayE<lt>optionE<lt>EnvelopeAliasE<gt>E<gt>>.

=item C<AliasPair.right>

Contract: C<arrayE<lt>optionE<lt>EnvelopeAliasE<gt>E<gt>>.

=item C<Envelope.payload>

Contract: C<nat>.

=item C<Envelope.digit>

Contract: C<nat>.

=back

=head1 TAGGED VARIANTS

Concrete copied Lean variants use named constructor classes with keyword fields. Construct a case with C<< Signal::Data->new(count => 42, label => 'ready') >> under this component's namespace. The family itself cannot be constructed. Payload accessors keep the original field names. Calls require the exact generated class and field set, reject tied or magical hashes and unknown subclasses, and copy only the active payload. Empty cases and cases carrying undef for Unit stay distinct.

Fields and contained arrays remain mutable. Returned payloads own independent storage. Perl reference equality is not deep value equality, and Perl does not check match exhaustiveness. Input field slots are pinned before conversion can invoke Perl. Scoped cleanup releases partial conversions. The shared per-call copied-value limit is 16 MiB and schema nesting is limited to 32 levels. Generic, indexed, recursive, proof-bearing, callable and identity-bearing payloads remain unsupported.

=over 4

=item C<LeanBridge::NominalSubtypes::Event::Empty>

No payload fields.

=item C<LeanBridge::NominalSubtypes::Event::Box>

Required fields: C<value>.

=item C<LeanBridge::NominalSubtypes::Event::Choices>

Required fields: C<values>.

=back

=head1 COPIED VALUES

Option uses undef for None and Some->new($value) for Some, including Some->new(undef). Unit uses undef. Except uses distinct Ok->new($value) and Err->new($value) objects; ->value returns the payload. Branch classes live under this component's namespace. Prod uses a plain two-element array reference; nested pairs stay nested.

Branches are mutable one-field hashes. Calls check the exact class and field set, reject tied branches and products, and copy their contents. Returned arrays, records and payloads are independent of input values. Perl reference equality is not deep value equality. The shared per-call copied-value limit is 16 MiB; schema nesting is limited to 32 levels. Compound callbacks and resources inside copied values are unsupported.

=head1 LISTS

Lean List inputs, results and record fields use copied plain array references. Calls reject blessed, tied and sparse arrays. Empty Lists, order, duplicates and nesting are preserved. Slots are pinned before element conversion can invoke Perl code. Returned arrays and mutable payloads own independent storage. List and Array retain distinct IR/native identities. Typed Lean helpers perform List conversion without inspecting cons-cell layouts. The shared per-call copied-value limit is 16 MiB; List callback payloads remain unsupported.

=head1 ARRAYS AND RECORDS

Lean Array values use plain dense array references. Calls reject blessed, tied and sparse arrays. Copied records use generated classes with named fields and accessors. Record keyword arguments keep Perl's last-value-wins hash semantics, including new(%old_fields, field => $replacement). Constructors reject missing, extra or unnamed fields; calls require the exact generated class and reject tied hashes and subclasses. Empty records and one-field records retain their named types.

Array slots and record fields are pinned before conversion can invoke Perl code. Returned arrays, records, octet strings and Math::BigInt payloads own independent copied storage. Reference equality is not deep value equality. Nested copied values share a 16 MiB conversion budget and a 32-level schema limit; these are not limits on all Perl allocations or Lean working memory. Recursive copied types remain unsupported.

=head1 CHECKED VALUES

A Lean C<Subtype> parameter over a primitive base takes the plain base value: L<Math::BigInt> for C<Nat> and C<Int>, an ordinary integer for machine words, a text scalar for C<String> and an octet string for C<ByteArray>. The exported checked constructor named at each function runs on the argument after every Fin bound passed and before the guarded adapter or the exported function; a rejected value dies with a message naming the parameter and the constructor, and the function receives the constructed value. Results are projected to their base value after Lean returns. Each checked site is listed as C<arg0 checked by Module.constructor> at its function.

=head1 BOUNDED INTEGERS

Lean C<Fin n> parameters and results are L<Math::BigInt> values below C<n>. Each argument is compared with its exact bound, including bounds wider than 64 bits, before the guarded adapter or the exported function runs. A value that is not a Math::BigInt, or a negative one, is rejected as for Nat; a value at or above its bound dies with a message naming the Lean parameter and bound. C<Fin 0> has no values, so every call to a function taking one dies. Results are Math::BigInt values below their declared bound. Inside arrays, Lists and options every present element is checked the same way before the guarded adapter or the exported function runs, so a C<Fin 0> element is rejected while an empty array or an undefined option is accepted; each checked path is listed as C<arg0[*]? < n> at its function, and a rejection names the failing element's own path and bound, such as C<arg0[2]? is not below its Fin 10 bound>. Every field of a record and only the fields of the active variant case are checked the same way; a rejection names the field path, such as C<arg0.inner.digit> or C<arg0.circle.radius>. Fin inside callbacks, generic record instantiations or reviewed Binding IR is not supported in CPAN packages.

=head1 OWNERSHIP

Close resource and closure objects when finished. Host callbacks are synchronous and may not be retained by Lean.

=cut
