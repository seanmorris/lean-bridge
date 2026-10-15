package LeanBridge::NominalPrimitiveSubtypes;
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Runtime;
die "Incompatible shared Lean runtime package version\n" unless $LeanBridge::Runtime::VERSION eq '0.0020592716822581412637753637152461205682916576183240901183894178635322362377514011';
use XSLoader;
our $VERSION = '1.000';
LeanBridge::Runtime::_load_component(__FILE__, 'libcomponent_19ad06f04a0c2d39db76.so', 'b7b85b630534423c7c72abcecdcdec481bb8b9892a9b67459b7b3edc40718194', '12ae9a901392dc563536477c96fa46c1f72387387097b7c4d3e2c22d01815302', { 'NominalPrimitiveSubtypes' => '1b82df85335f49de3dbfbef1d0070f42ecf83cd1896936a28b71de47af1994a9' }, 'nominalprimitivesubtypes@1.0.0');
XSLoader::load(__PACKAGE__, $VERSION);
sub true () { !!1 }
sub false () { !!0 }
sub CLONE_SKIP { 1 }

package LeanBridge::NominalPrimitiveSubtypes::Some;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Some->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Some';
  return bless { value => $_[1] }, 'LeanBridge::NominalPrimitiveSubtypes::Some';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalPrimitiveSubtypes::Ok;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Ok->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Ok';
  return bless { value => $_[1] }, 'LeanBridge::NominalPrimitiveSubtypes::Ok';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalPrimitiveSubtypes::Err;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Err->new expects one payload\n" unless @_ == 2 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Err';
  return bless { value => $_[1] }, 'LeanBridge::NominalPrimitiveSubtypes::Err';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalPrimitiveSubtypes::RawPacket;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::RawPacket->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::RawPacket';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid record field\n" if !defined($key) || ref($key);
    $fields{$key} = $value;
  }
  my @required = qw(unitValue boolValue uint8Value uint16Value uint32Value uint64Value int8Value int16Value int32Value int64Value natValue intValue float32Value float64Value textValue bytesValue charValue usizeValue isizeValue digit);
  die "record fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::RawPacket';
}
sub unitValue { $_[0]->{unitValue} }
sub boolValue { $_[0]->{boolValue} }
sub uint8Value { $_[0]->{uint8Value} }
sub uint16Value { $_[0]->{uint16Value} }
sub uint32Value { $_[0]->{uint32Value} }
sub uint64Value { $_[0]->{uint64Value} }
sub int8Value { $_[0]->{int8Value} }
sub int16Value { $_[0]->{int16Value} }
sub int32Value { $_[0]->{int32Value} }
sub int64Value { $_[0]->{int64Value} }
sub natValue { $_[0]->{natValue} }
sub intValue { $_[0]->{intValue} }
sub float32Value { $_[0]->{float32Value} }
sub float64Value { $_[0]->{float64Value} }
sub textValue { $_[0]->{textValue} }
sub bytesValue { $_[0]->{bytesValue} }
sub charValue { $_[0]->{charValue} }
sub usizeValue { $_[0]->{usizeValue} }
sub isizeValue { $_[0]->{isizeValue} }
sub digit { $_[0]->{digit} }
package LeanBridge::NominalPrimitiveSubtypes::Packet;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Packet->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Packet';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid record field\n" if !defined($key) || ref($key);
    $fields{$key} = $value;
  }
  my @required = qw(unitValue boolValue uint8Value uint16Value uint32Value uint64Value int8Value int16Value int32Value int64Value natValue intValue float32Value float64Value textValue bytesValue charValue usizeValue isizeValue digit);
  die "record fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::Packet';
}
sub unitValue { $_[0]->{unitValue} }
sub boolValue { $_[0]->{boolValue} }
sub uint8Value { $_[0]->{uint8Value} }
sub uint16Value { $_[0]->{uint16Value} }
sub uint32Value { $_[0]->{uint32Value} }
sub uint64Value { $_[0]->{uint64Value} }
sub int8Value { $_[0]->{int8Value} }
sub int16Value { $_[0]->{int16Value} }
sub int32Value { $_[0]->{int32Value} }
sub int64Value { $_[0]->{int64Value} }
sub natValue { $_[0]->{natValue} }
sub intValue { $_[0]->{intValue} }
sub float32Value { $_[0]->{float32Value} }
sub float64Value { $_[0]->{float64Value} }
sub textValue { $_[0]->{textValue} }
sub bytesValue { $_[0]->{bytesValue} }
sub charValue { $_[0]->{charValue} }
sub usizeValue { $_[0]->{usizeValue} }
sub isizeValue { $_[0]->{isizeValue} }
sub digit { $_[0]->{digit} }
package LeanBridge::NominalPrimitiveSubtypes::Pair;
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Pair->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Pair';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid record field\n" if !defined($key) || ref($key);
    $fields{$key} = $value;
  }
  my @required = qw(left right);
  die "record fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::Pair';
}
sub left { $_[0]->{left} }
sub right { $_[0]->{right} }
package LeanBridge::NominalPrimitiveSubtypes::Event;
sub new { die "select a named variant constructor\n" }

package LeanBridge::NominalPrimitiveSubtypes::Event::Empty;
our @ISA = ('LeanBridge::NominalPrimitiveSubtypes::Event');
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Event::Empty->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Event::Empty';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw();
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::Event::Empty';
}

package LeanBridge::NominalPrimitiveSubtypes::Event::Box;
our @ISA = ('LeanBridge::NominalPrimitiveSubtypes::Event');
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Event::Box->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Event::Box';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw(value);
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::Event::Box';
}
sub value { $_[0]->{value} }

package LeanBridge::NominalPrimitiveSubtypes::Event::Choices;
our @ISA = ('LeanBridge::NominalPrimitiveSubtypes::Event');
sub new {
  die "LeanBridge::NominalPrimitiveSubtypes::Event::Choices->new expects named fields\n" unless @_ % 2 == 1 && $_[0] eq 'LeanBridge::NominalPrimitiveSubtypes::Event::Choices';
  shift; my %fields;
  while (@_) {
    my ($key, $value) = splice @_, 0, 2;
    die "invalid constructor field\n" if !defined($key) || ref($key);
    die "duplicate constructor field\n" if exists $fields{$key};
    $fields{$key} = $value;
  }
  my @required = qw(values);
  die "constructor fields do not match the generated schema\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;
  return bless \%fields, 'LeanBridge::NominalPrimitiveSubtypes::Event::Choices';
}
sub values { $_[0]->{values} }

1;

__END__
=head1 NAME

LeanBridge::NominalPrimitiveSubtypes - Generated functions from nominalprimitivesubtypes

=head1 API

=head2 produce

Calls C<NominalPrimitiveSubtypes.produce> in the compiled Lean component.

Checked Lean Fin bounds: result?.unitValue projects the Subtype base value; result?.boolValue projects the Subtype base value; result?.uint8Value projects the Subtype base value; result?.uint16Value projects the Subtype base value; result?.uint32Value projects the Subtype base value; result?.uint64Value projects the Subtype base value; result?.int8Value projects the Subtype base value; result?.int16Value projects the Subtype base value; result?.int32Value projects the Subtype base value; result?.int64Value projects the Subtype base value; result?.natValue projects the Subtype base value; result?.intValue projects the Subtype base value; result?.float32Value projects the Subtype base value; result?.float64Value projects the Subtype base value; result?.textValue projects the Subtype base value; result?.bytesValue projects the Subtype base value; result?.charValue projects the Subtype base value; result?.usizeValue projects the Subtype base value; result?.isizeValue projects the Subtype base value; result?.digit < 3.

Parameter C<value0>: C<RawPacket>. Returns C<optionE<lt>PacketE<gt>>.

=head2 produce_choices

Calls C<NominalPrimitiveSubtypes.produceChoices> in the compiled Lean component.

Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.

Parameter C<value0>: C<RawPacket>. Returns C<Event>.

=head2 produce_event

Calls C<NominalPrimitiveSubtypes.produceEvent> in the compiled Lean component.

Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.

Parameter C<value0>: C<RawPacket>. Returns C<Event>.

=head2 produce_group

Calls C<NominalPrimitiveSubtypes.produceGroup> in the compiled Lean component.

Checked Lean Fin bounds: result[*]?.unitValue projects the Subtype base value; result[*]?.boolValue projects the Subtype base value; result[*]?.uint8Value projects the Subtype base value; result[*]?.uint16Value projects the Subtype base value; result[*]?.uint32Value projects the Subtype base value; result[*]?.uint64Value projects the Subtype base value; result[*]?.int8Value projects the Subtype base value; result[*]?.int16Value projects the Subtype base value; result[*]?.int32Value projects the Subtype base value; result[*]?.int64Value projects the Subtype base value; result[*]?.natValue projects the Subtype base value; result[*]?.intValue projects the Subtype base value; result[*]?.float32Value projects the Subtype base value; result[*]?.float64Value projects the Subtype base value; result[*]?.textValue projects the Subtype base value; result[*]?.bytesValue projects the Subtype base value; result[*]?.charValue projects the Subtype base value; result[*]?.usizeValue projects the Subtype base value; result[*]?.isizeValue projects the Subtype base value; result[*]?.digit < 3.

Parameter C<value0>: C<RawPacket>. Returns C<arrayE<lt>optionE<lt>PacketAliasE<gt>E<gt>>.

=head2 produce_pair

Calls C<NominalPrimitiveSubtypes.producePair> in the compiled Lean component.

Checked Lean Fin bounds: result.left[*]?.unitValue projects the Subtype base value; result.left[*]?.boolValue projects the Subtype base value; result.left[*]?.uint8Value projects the Subtype base value; result.left[*]?.uint16Value projects the Subtype base value; result.left[*]?.uint32Value projects the Subtype base value; result.left[*]?.uint64Value projects the Subtype base value; result.left[*]?.int8Value projects the Subtype base value; result.left[*]?.int16Value projects the Subtype base value; result.left[*]?.int32Value projects the Subtype base value; result.left[*]?.int64Value projects the Subtype base value; result.left[*]?.natValue projects the Subtype base value; result.left[*]?.intValue projects the Subtype base value; result.left[*]?.float32Value projects the Subtype base value; result.left[*]?.float64Value projects the Subtype base value; result.left[*]?.textValue projects the Subtype base value; result.left[*]?.bytesValue projects the Subtype base value; result.left[*]?.charValue projects the Subtype base value; result.left[*]?.usizeValue projects the Subtype base value; result.left[*]?.isizeValue projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.unitValue projects the Subtype base value; result.right[*]?.boolValue projects the Subtype base value; result.right[*]?.uint8Value projects the Subtype base value; result.right[*]?.uint16Value projects the Subtype base value; result.right[*]?.uint32Value projects the Subtype base value; result.right[*]?.uint64Value projects the Subtype base value; result.right[*]?.int8Value projects the Subtype base value; result.right[*]?.int16Value projects the Subtype base value; result.right[*]?.int32Value projects the Subtype base value; result.right[*]?.int64Value projects the Subtype base value; result.right[*]?.natValue projects the Subtype base value; result.right[*]?.intValue projects the Subtype base value; result.right[*]?.float32Value projects the Subtype base value; result.right[*]?.float64Value projects the Subtype base value; result.right[*]?.textValue projects the Subtype base value; result.right[*]?.bytesValue projects the Subtype base value; result.right[*]?.charValue projects the Subtype base value; result.right[*]?.usizeValue projects the Subtype base value; result.right[*]?.isizeValue projects the Subtype base value; result.right[*]?.digit < 3.

Parameter C<value0>: C<RawPacket>. Returns C<Pair>.

=head2 word_bits

Calls C<NominalPrimitiveSubtypes.wordBits> in the compiled Lean component.

Returns C<uint32>.

=head1 COPIED ALIASES

Alias names, original targets and chains remain in the binding manifest and this POD. Call with ordinary Perl target values; aliases do not create separate packages or wrapper classes. Nat requires a nonnegative Math::BigInt; Int accepts negative values. Fixed-width and machine-word integers retain their ranges. Char requires one Unicode scalar. Unit uses undef. Copied payloads own independent storage. Existing copy budgets, schema depth and ownership checks apply. Recursive copies, compound callables and identity-bearing alias targets remain unsupported.

=over 4

=item C<PacketAlias>

Contract: C<Packet>. Perl value: C<LeanBridge::NominalPrimitiveSubtypes::Packet>.

=back

=head1 RECORD FIELD CONTRACTS

=over 4

=item C<Packet.unitValue>

Contract: C<unit>.

=item C<Packet.boolValue>

Contract: C<bool>.

=item C<Packet.uint8Value>

Contract: C<uint8>.

=item C<Packet.uint16Value>

Contract: C<uint16>.

=item C<Packet.uint32Value>

Contract: C<uint32>.

=item C<Packet.uint64Value>

Contract: C<uint64>.

=item C<Packet.int8Value>

Contract: C<int8>.

=item C<Packet.int16Value>

Contract: C<int16>.

=item C<Packet.int32Value>

Contract: C<int32>.

=item C<Packet.int64Value>

Contract: C<int64>.

=item C<Packet.natValue>

Contract: C<nat>.

=item C<Packet.intValue>

Contract: C<int>.

=item C<Packet.float32Value>

Contract: C<float32>.

=item C<Packet.float64Value>

Contract: C<float64>.

=item C<Packet.textValue>

Contract: C<string>.

=item C<Packet.bytesValue>

Contract: C<bytes>.

=item C<Packet.charValue>

Contract: C<char>.

=item C<Packet.usizeValue>

Contract: C<usize>.

=item C<Packet.isizeValue>

Contract: C<isize>.

=item C<Packet.digit>

Contract: C<nat>.

=item C<Pair.left>

Contract: C<arrayE<lt>optionE<lt>PacketAliasE<gt>E<gt>>.

=item C<Pair.right>

Contract: C<arrayE<lt>optionE<lt>PacketAliasE<gt>E<gt>>.

=item C<RawPacket.unitValue>

Contract: C<unit>.

=item C<RawPacket.boolValue>

Contract: C<bool>.

=item C<RawPacket.uint8Value>

Contract: C<uint8>.

=item C<RawPacket.uint16Value>

Contract: C<uint16>.

=item C<RawPacket.uint32Value>

Contract: C<uint32>.

=item C<RawPacket.uint64Value>

Contract: C<uint64>.

=item C<RawPacket.int8Value>

Contract: C<int8>.

=item C<RawPacket.int16Value>

Contract: C<int16>.

=item C<RawPacket.int32Value>

Contract: C<int32>.

=item C<RawPacket.int64Value>

Contract: C<int64>.

=item C<RawPacket.natValue>

Contract: C<nat>.

=item C<RawPacket.intValue>

Contract: C<int>.

=item C<RawPacket.float32Value>

Contract: C<float32>.

=item C<RawPacket.float64Value>

Contract: C<float64>.

=item C<RawPacket.textValue>

Contract: C<string>.

=item C<RawPacket.bytesValue>

Contract: C<bytes>.

=item C<RawPacket.charValue>

Contract: C<char>.

=item C<RawPacket.usizeValue>

Contract: C<usize>.

=item C<RawPacket.isizeValue>

Contract: C<isize>.

=item C<RawPacket.digit>

Contract: C<nat>.

=back

=head1 TAGGED VARIANTS

Concrete copied Lean variants use named constructor classes with keyword fields. Construct a case with C<< Signal::Data->new(count => 42, label => 'ready') >> under this component's namespace. The family itself cannot be constructed. Payload accessors keep the original field names. Calls require the exact generated class and field set, reject tied or magical hashes and unknown subclasses, and copy only the active payload. Empty cases and cases carrying undef for Unit stay distinct.

Fields and contained arrays remain mutable. Returned payloads own independent storage. Perl reference equality is not deep value equality, and Perl does not check match exhaustiveness. Input field slots are pinned before conversion can invoke Perl. Scoped cleanup releases partial conversions. The shared per-call copied-value limit is 16 MiB and schema nesting is limited to 32 levels. Generic, indexed, recursive, proof-bearing, callable and identity-bearing payloads remain unsupported.

=over 4

=item C<LeanBridge::NominalPrimitiveSubtypes::Event::Empty>

No payload fields.

=item C<LeanBridge::NominalPrimitiveSubtypes::Event::Box>

Required fields: C<value>.

=item C<LeanBridge::NominalPrimitiveSubtypes::Event::Choices>

Required fields: C<values>.

=back

=head1 COPIED VALUES

Option uses undef for None and Some->new($value) for Some, including Some->new(undef). Unit uses undef. Except uses distinct Ok->new($value) and Err->new($value) objects; ->value returns the payload. Branch classes live under this component's namespace. Prod uses a plain two-element array reference; nested pairs stay nested.

Branches are mutable one-field hashes. Calls check the exact class and field set, reject tied branches and products, and copy their contents. Returned arrays, records and payloads are independent of input values. Perl reference equality is not deep value equality. The shared per-call copied-value limit is 16 MiB; schema nesting is limited to 32 levels. Compound callbacks and resources inside copied values are unsupported.

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
