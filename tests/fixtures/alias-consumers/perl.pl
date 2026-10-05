# Independent consumer of the installed CPAN API. No generated converter access.
use strict;
use warnings;
use Carp qw(confess);
use B qw(svref_2object SVf_IOK SVf_NOK SVf_POK);
use builtin qw(is_bool);
no warnings 'experimental::builtin';
use Config;
use Cwd qw(abs_path);
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed weaken);
use LeanBridge::Aliases;

my $checks = 0;
sub check ($;$) { confess("Alias assertion #$checks failed: " . ($_[1] // '')) unless $_[0]; ++$checks; }
sub some { LeanBridge::Aliases::Some->new($_[0]) }
sub ok { LeanBridge::Aliases::Ok->new($_[0]) }
sub err { LeanBridge::Aliases::Err->new($_[0]) }
sub recovered {
  check(LeanBridge::Aliases::make() == 41, 'public API recovers after errors');
}
sub rejected {
  my ($call, $message) = @_;
  my $passed = eval { $call->(); 1 }; my $error = $@;
  check(!$passed && "$error" =~ $message, "expected rejection: $error"); recovered();
}
sub encode {
  my ($type, $value) = @_;
  if ($type eq 'unit') { check(!defined($value), 'Unit'); return 'unit'; }
  if ($type eq 'bool') { check(is_bool($value), 'Bool'); return $value ? 'true' : 'false'; }
  if ($type eq 'nat' || $type eq 'int') {
    check(blessed($value) && $value->isa('Math::BigInt'), 'exact integer'); return $value->bstr;
  }
  check(defined($value) && !ref($value) && !is_bool($value), "scalar $type");
  my $flags = svref_2object(\$value)->FLAGS;
  if ($type =~ /\A(?:u?int(?:8|16|32|64)|[ui]size)\z/) {
    check($flags & SVf_IOK, 'integer scalar'); return "$value";
  }
  if ($type eq 'float32' || $type eq 'float64') {
    check($flags & (SVf_NOK | SVf_IOK), 'numeric scalar');
    return 'nan' if $value != $value;
    return unpack('H*', pack($type eq 'float32' ? 'f<' : 'd<', $value));
  }
  check($flags & SVf_POK, 'text or octets');
  if ($type eq 'bytes') { check(!utf8::is_utf8($value), 'octets'); return unpack('H*', $value); }
  check($type eq 'string' || ($type eq 'char' && length($value) == 1), 'Unicode scalar text');
  return join(',', unpack('U*', $value));
}
sub same {
  my ($actual, $expected) = @_;
  check(ref($actual) eq ref($expected), 'same host type');
  if (!defined($expected)) { check(!defined($actual), 'undef'); }
  elsif (blessed($expected) && $expected->isa('Math::BigInt')) { check($actual->bstr eq $expected->bstr, 'BigInt'); }
  elsif (ref($expected) eq 'ARRAY') {
    check(@$actual == @$expected, 'array size');
    same($actual->[$_], $expected->[$_]) for 0 .. $#$expected;
  } elsif (ref($expected)) {
    check(join(',', sort keys %$actual) eq join(',', sort keys %$expected), 'field set');
    same($actual->{$_}, $expected->{$_}) for sort keys %$expected;
  } else {
    check(defined($actual) && is_bool($actual) == is_bool($expected) && $actual eq $expected, 'value');
  }
}
sub leaf {
  my ($type, $actual, $expected) = @_;
  check(encode($type, $actual) eq encode($type, $expected), "$type value");
}
my $true = LeanBridge::Aliases::true();
my $false = LeanBridge::Aliases::false();
my $huge = Math::BigInt->bone->blsft(5120)->badd(19);
my $negative = $huge->copy->bneg;
my @floats32 = map { unpack('f<', pack('L<', $_)) } (0, 2147483648, 1, 8388607, 8388608, 1065353216, 2139095039, 2139095040, 4286578688, 2143289344);
my @floats64 = map { unpack('d<', pack('Q<', $_)) } (0, 9223372036854775808, 1, 4503599627370495, 4503599627370496, 4607182418800017408, 9218868437227405311, 9218868437227405312, 18442240474082181120, 9221120237041090560);
my @cases = (
  ['unit', [undef], [0, '', []], qr/Unit requires/],
  ['bool', [$false, $true], [0, 1, 'true', undef], qr/Bool requires/],
  ['uint8', [0, 1, 255], [-1, 256, 1.5, '1'], qr/unsigned integer/],
  ['uint16', [0, 1, 65535], [-1, 65536, 1.5, '1'], qr/unsigned integer/],
  ['uint32', [0, 1, 2147483648, 4294967295], [-1, 4294967296, 1.5, '1'], qr/unsigned integer/],
  ['uint64', [0, 1, 4294967296, 9007199254740993, 18446744073709551615], [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/],
  ['int8', [-128, -1, 0, 127], [-129, 128, '1'], qr/signed integer/],
  ['int16', [-32768, -1, 0, 32767], [-32769, 32768, '1'], qr/signed integer/],
  ['int32', [-2147483648, -1, 0, 2147483647], [-2147483649, 2147483648, '1'], qr/signed integer/],
  ['int64', [-9223372036854775808, -9007199254740993, -1, 0, 9223372036854775807], [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/],
  ['nat', [Math::BigInt->new(0), Math::BigInt->new(1), $huge], [0, Math::BigInt->new(-1), Math::BigInt->bnan], qr/Math::BigInt|Nat cannot|invalid decimal/],
  ['int', [$negative, Math::BigInt->new(0), $huge], [0, Math::BigInt->bnan, Math::BigInt->binf], qr/Math::BigInt|invalid decimal/],
  ['float32', [@floats32, 1.0000000596046448, 1e300], ['1', [], undef], qr/Float requires/],
  ['float64', \@floats64, ['1', [], undef], qr/Float requires/],
  ['string', ['', "\0", "A\0B", "e\x{301}\x{1f642}", "\x{10ffff}"], [1, [], undef, "\x{d800}", "\x{110000}"], qr/String requires|invalid Unicode/],
  ['bytes', ['', "\0\xff", pack('C*', 0 .. 255)], [1, [], undef, "\x{100}"], qr/ByteArray requires/],
  ['char', ["\0", 'A', "\x{301}", "\x{d7ff}", "\x{e000}", "\x{ffff}", "\x{1f642}", "\x{10ffff}"], ['', 'ab', "\x{d800}", "\x{110000}", 65, undef, []], qr/Char requires/],
  ['usize', [0, 1, 4294967295, 9007199254740993, 18446744073709551615], [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/],
  ['isize', [-9223372036854775808, -9007199254740993, -1, 0, 9223372036854775807], [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/]
);
my @primitives;
for my $case (@cases) {
  my ($type, $values, $invalid, $message) = @$case;
  my $echo = LeanBridge::Aliases->can("echo_$type");
  check($echo, "public echo_$type"); my $before = $checks;
  for (1 .. 16) { leaf($type, $echo->($_), $_) for @$values; }
  rejected(sub { $echo->($_) }, qr/$message|scalar value/) for @$invalid;
  rejected(sub { $echo->() }, qr/expects 1 arguments/);
  rejected(sub { $echo->($values->[0], $values->[0]) }, qr/expects 1 arguments/);
  push @primitives, { name => $type, checks => $checks - $before, rejected_cases => 2 + @$invalid };
}
check(@primitives == 19, 'all primitive aliases');
same(LeanBridge::Aliases::make(), 41);
same(LeanBridge::Aliases::increment(41), 42);
same(LeanBridge::Aliases::increment(4294967295), 0);
same(LeanBridge::Aliases::label(), "alias\x{1f331}");
check(!LeanBridge::Aliases->can('Count'), 'alias does not add a wrapper');

# Lean independently checks every field, including exact large integers.
my %fields = (v_unit => undef, v_bool => $true, v_uint8 => 255, v_uint16 => 65535,
  v_uint32 => 4294967295, v_uint64 => 18446744073709551615, v_int8 => -128,
  v_int16 => -32768, v_int32 => -2147483648, v_int64 => -9223372036854775808,
  v_nat => $huge, v_int => Math::BigInt->bone->blsft(5120)->badd(31)->bneg,
  v_float32 => 1.5, v_float64 => -2.25, v_string => "A\0\x{1f331}",
  v_bytes => "\0\xff\1", v_char => "\x{1f331}", v_usize => 4294967295, v_isize => -2147483648);
my $original = LeanBridge::Aliases::Scalars->new(%fields);
leaf('bool', LeanBridge::Aliases::inspect($original), $true);
my $copied = LeanBridge::Aliases::echo_scalars($original);
for my $case (@cases) {
  my ($type, $field) = ($case->[0], 'v_' . $case->[0]);
  leaf($type, $copied->{$field}, $fields{$field});
  next if $type eq 'unit';
  my $other = $type eq 'bool' ? $false : $type eq 'char' ? 'x' :
    $type eq 'string' || $type eq 'bytes' ? '' : $type eq 'nat' || $type eq 'int' ? Math::BigInt->bzero : 0;
  leaf('bool', LeanBridge::Aliases::inspect(LeanBridge::Aliases::Scalars->new(%fields, $field => $other)), $false);
}
$copied->v_nat->binc; substr($copied->{v_string}, 0, 1) = 'z';
same($original->v_nat, $huge); same($original->v_string, "A\0\x{1f331}");
rejected(sub { LeanBridge::Aliases::echo_scalars(LeanBridge::Aliases::Scalars->new(%fields, v_nat => Math::BigInt->new(-1))) }, qr/Nat cannot/);
rejected(sub { LeanBridge::Aliases::echo_scalars(LeanBridge::Aliases::Scalars->new(%fields, v_unit => 0)) }, qr/Unit requires/);

same(LeanBridge::Aliases::echo_maybe($_), $_) for (undef, some(undef), some(some(undef)));
same(LeanBridge::Aliases::echo_outcome($_), $_) for (ok([0, '']), ok([4294967295, "\0\xff"]), err(''), err("oops\0\x{1f331}"));
for my $index (0 .. 23) {
  my $rows = [[1, 2, 3], [], [$index]];
  my $packet = LeanBridge::Aliases::Packet->new(count => $index, text => "a\0\x{1f331}",
    rows => $rows, maybe => some(some(undef)), outcome => ok([7, "\0\xff"]));
  my $changed = LeanBridge::Aliases::change_packet($packet);
  same($changed, LeanBridge::Aliases::Packet->new(%$packet, count => $index + 1));
  my $packets = LeanBridge::Aliases::reverse_packets([$packet, $changed]);
  same($packets, [$changed, $packet]);
  @$rows = (); $packet->{text} = 'changed'; substr($packet->outcome->value->[1], 0, 1) = 'x';
  same($changed->rows, [[1, 2, 3], [], [$index]]);
  same($packets->[1]->rows, [[1, 2, 3], [], [$index]]);
  same($changed->text, "a\0\x{1f331}"); same($packets->[1]->outcome, ok([7, "\0\xff"]));
  $packets->[0]->rows->[0]->[0] = 9; same($packets->[1]->rows->[0], [1, 2, 3]);
}
same(LeanBridge::Aliases::reverse_rows([[1, 2], [], [3]]), [[2, 1], [], [3]]);
same(LeanBridge::Aliases::reverse_rows([]), []); same(LeanBridge::Aliases::reverse_packets([]), []);
same(LeanBridge::Aliases::duplicate("\0\xff"), ok([7, "\0\xff\0\xff"]));
my $shared = [1, 2]; my $copies = LeanBridge::Aliases::reverse_rows([$shared, $shared]);
$copies->[0]->[0] = 7; same($copies->[1], [2, 1]); same($shared, [1, 2]);
my $weak = $shared; weaken($weak); undef $shared; check(!defined($weak), 'no retained copied input');

for my $bad (undef, 0, {}, sub {}, bless([], 'PretendList')) {
  rejected(sub { LeanBridge::Aliases::reverse_packets($bad) }, qr/List requires/);
}
my $sparse = []; $sparse->[1] = 1;
rejected(sub { LeanBridge::Aliases::reverse_rows([$sparse]) }, qr/sparse/);
my $cycle = []; push @$cycle, $cycle;
rejected(sub { LeanBridge::Aliases::reverse_rows($cycle) }, qr/scalar/); @$cycle = ();
rejected(sub { LeanBridge::Aliases::echo_outcome(ok([])) }, qr/Prod requires/);
rejected(sub { LeanBridge::Aliases::echo_outcome(ok([1, '', 2])) }, qr/Prod requires/);
# Aliases retain Perl's existing integer-scalar target checks. Native Boolean
# scalars also carry exact integer flags and therefore map to 0 or 1 here.
leaf('uint32', LeanBridge::Aliases::echo_uint32($true), 1);
leaf('uint32', LeanBridge::Aliases::echo_uint32($false), 0);
same(LeanBridge::Aliases::echo_outcome(ok([$true, ''])), ok([1, '']));
rejected(sub { LeanBridge::Aliases::echo_outcome(ok([-1, ''])) }, qr/unsigned integer|scalar/);
rejected(sub { LeanBridge::Aliases::echo_outcome(err(7)) }, qr/String requires/);
rejected(sub { LeanBridge::Aliases::echo_maybe(some(some(0))) }, qr/Unit requires/);
rejected(sub { LeanBridge::Aliases::change_packet(\%fields) }, qr/expected LeanBridge::Aliases::Packet/);
{
  package TiedList;
  sub TIEARRAY { bless [], shift }
  sub FETCHSIZE { die 'unexpected tied array access' }
  sub FETCH { die 'unexpected tied array access' }
  package PretendSome; our @ISA = ('LeanBridge::Aliases::Some');
}
tie my @tied, 'TiedList';
rejected(sub { LeanBridge::Aliases::reverse_rows([\@tied]) }, qr/List requires/);
rejected(sub { LeanBridge::Aliases::echo_maybe(bless({value => undef}, 'PretendSome')) }, qr/Option requires/);
for my $class (qw(Some Ok Err)) {
  my $name = "LeanBridge::Aliases::$class";
  rejected(sub { $name->new() }, qr/expects one payload/);
  rejected(sub { $name->new(1, 2) }, qr/expects one payload/);
}
rejected(sub { LeanBridge::Aliases::echo_bytes('x' x (16 * 1024 * 1024 + 1)) }, qr/16 MiB/);
for (1 .. 3) {
  rejected(sub { LeanBridge::Aliases::produce(Math::BigInt->new(16 * 1024 * 1024 + 1)) }, qr/16 MiB/);
  same(LeanBridge::Aliases::produce(Math::BigInt->new(3)), "\7\7\7");
}
my $root = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) { my ($path) = /\s(\/\S+\.so)$/; next unless $path && index($path, "$root/") == 0;
  open my $file, '<:raw', $path or die $!; local $/; $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
print JSON::PP->new->canonical->encode({ checks => $checks, primitives => \@primitives, perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  word_bits => 8 * $Config{ptrsize}, api => abs_path($INC{'LeanBridge/Aliases.pm'}), native_libraries => \%libraries }) . "\n";
