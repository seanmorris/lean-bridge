use strict;
use warnings;
use utf8;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
my %called;
sub check { ++$checks; die "installed scalar check $checks: $_[1]\n" unless $_[0]; }
sub invoke {
  my ($name, @arguments) = @_;
  no strict 'refs'; ++$called{$name};
  return &{'LeanBridge::OwnedProbe::' . $name}(@arguments);
}
my $session_identities = LeanBridge::Runtime::_snapshot()->{live_identities};
check($session_identities == 1, 'one ownership session is registered at import');
# Every resource below leaves lexical scope before checking the real broker.
{
  my $ticket = invoke('new_ticket', Math::BigInt->new(42), "A\0🌱");
  my $packet = invoke('make_packet', $ticket);
  check(invoke('inspect', $packet), 'Lean inspects all nineteen generated fields');
  my $echo = invoke('echo', $packet);
  check(invoke('inspect', $echo), 'all fields round trip');
  check(refaddr($echo) != refaddr($packet) && refaddr($echo->ticket) != refaddr($packet->ticket), 'independent owned result');
  check($packet->scalars->natural->bcmp(Math::BigInt->new(2)->bpow(128)->badd(1)) == 0, 'large Lean Nat decoded');
  check($packet->scalars->integer->is_neg(), 'negative Lean Int decoded');
  check($packet->scalars->text eq "A\0🌱" && $packet->scalars->bytes eq "\0\xff\x01", 'text and octets remain distinct');
  for my $width (0, 1, 31, 32, 33, 63, 64, 65, 127, 128, 129, 511, 4096) {
    my $natural = Math::BigInt->new(2)->bpow($width)->bsub(1);
    for my $sign (-1, 0, 1) {
      my %fields = %{$packet->scalars};
      $fields{natural} = $natural; $fields{integer} = $natural->copy->bmul($sign);
      my %data = %$packet; $data{scalars} = LeanBridge::OwnedProbe::Scalars->new(%fields);
      my $out = invoke('echo', LeanBridge::OwnedProbe::Packet->new(%data));
      check($out->scalars->natural->bcmp($natural) == 0, 'private GMP Nat limb boundary');
      check($out->scalars->integer->bcmp($fields{integer}) == 0, 'private GMP Int sign and limb boundary');
    }
  }
  for my $case (0..2) {
    my %data = %$packet;
    $data{optional} = $case == 0 ? undef : LeanBridge::OwnedProbe::Some->new(
      $case == 1 ? undef : LeanBridge::OwnedProbe::Some->new(undef));
    my $out = invoke('echo', LeanBridge::OwnedProbe::Packet->new(%data));
    check(invoke('option_case', $out) == $case, 'None and nested optional Unit');
  }
  for my $bits (0, 0x80000000, 1, 0x7f800000, 0xff800000, 0x7fc12345, 0x3f800001) {
    my $value = unpack('f<', pack('L<', $bits));
    my %fields = %{$packet->scalars}; $fields{f32} = $value;
    my %data = %$packet; $data{scalars} = LeanBridge::OwnedProbe::Scalars->new(%fields);
    my $input = LeanBridge::OwnedProbe::Packet->new(%data);
    check(invoke('bits32', $input) == ($value != $value ? 0x7fc00000 : $bits), 'Lean Float32 bits');
    check(unpack('L<', pack('f<', invoke('echo', $input)->scalars->f32)) == $bits, 'Float32 round-trip bits');
  }
  for my $hex ('0000000000000000', '0000000000000080', '0100000000000000',
      '000000000000f07f', '000000000000f0ff', 'bc9a78563412f87f', '010000000000f03f') {
    my $bytes = pack('H*', $hex); my $value = unpack('d<', $bytes);
    my %fields = %{$packet->scalars}; $fields{f64} = $value;
    my %data = %$packet; $data{scalars} = LeanBridge::OwnedProbe::Scalars->new(%fields);
    my $input = LeanBridge::OwnedProbe::Packet->new(%data);
    my $canonical = $value != $value ? pack('H*', '000000000000f87f') : $bytes;
    check(invoke('bits64', $input) == unpack('Q<', $canonical), 'Lean Float64 bits');
    check(pack('d<', invoke('echo', $input)->scalars->f64) eq $bytes, 'Float64 round-trip bits');
  }
  check(@{invoke('units', [])} == 0, 'empty List Unit');
  my $units = invoke('units', [(undef) x 127]);
  check(@$units == 127 && !(grep { defined($_) } @$units), 'List Unit');
  for my $case (['unit', 1], ['flag', 1], ['natural', Math::BigInt->new(-1)],
      ['u8', 256], ['char', "ab"], ['text', []]) {
    my %fields = %{$packet->scalars}; $fields{$case->[0]} = $case->[1];
    my %data = %$packet; $data{scalars} = LeanBridge::OwnedProbe::Scalars->new(%fields);
    my $before = LeanBridge::Runtime::_snapshot()->{live_identities};
    my $ok = eval { invoke('echo', LeanBridge::OwnedProbe::Packet->new(%data)); 1 };
    check(!$ok && length($@), 'malformed installed input rejected');
    check(LeanBridge::Runtime::_snapshot()->{live_identities} == $before, 'rejection preserves broker owners');
  }
  $ticket->close();
  check(invoke('inspect', $packet), 'returned ownership survives closing the input');
  my $retained = $packet->ticket->retain();
  $packet->ticket->close();
  check(!$retained->closed(), 'explicit retention survives sibling close');
  $retained->close();
}
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $session_identities, 'public results return to the session-only broker baseline');
LeanBridge::OwnedProbe::Runtime::shutdown();
check(LeanBridge::Runtime::_snapshot()->{live_identities} == 0, 'shutdown releases the final session identity');
print JSON::PP->new->canonical->encode({ checks => $checks, exports => [sort keys %called], live => LeanBridge::Runtime::_snapshot()->{live_identities} });
