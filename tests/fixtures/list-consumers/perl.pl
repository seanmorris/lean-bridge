# Independent consumer of the installed CPAN API. No generated converter access.
use strict;
use warnings;
use B qw(svref_2object SVf_IOK SVf_NOK SVf_POK);
use builtin qw(is_bool);
no warnings 'experimental::builtin';
use Config;
use Cwd qw(abs_path);
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed weaken);
use LeanBridge::Lists;

my $checks = 0;
sub check ($;$) { die "List assertion #$checks failed: $_[1]\n" unless $_[0]; ++$checks; }
sub some { LeanBridge::Lists::Some->new($_[0]) }
sub ok { LeanBridge::Lists::Ok->new($_[0]) }
sub err { LeanBridge::Lists::Err->new($_[0]) }
sub recovered {
  my $out = LeanBridge::Lists::reverse_uint32([1, 2, 3]); check(join(',', @$out) eq '3,2,1', 'public API recovers after errors');
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
my $true = LeanBridge::Lists::true();
my $false = LeanBridge::Lists::false();
my $huge = Math::BigInt->bone->blsft(5120)->badd(Math::BigInt->bone->blsft(255))->badd(17);
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
  my $reverse = LeanBridge::Lists->can("reverse_$type");
  my $before = $checks;
  same($reverse->([]), []);
  for my $index (0 .. 127) {
    my $input = [@$values[$index % @$values, ($index + 1) % @$values, $index % @$values, ($index + 2) % @$values]];
    my $actual = $reverse->($input);
    check(ref($actual) eq 'ARRAY' && @$actual == @$input, 'List host type and length');
    leaf($type, $actual->[$_], $input->[$#$input - $_]) for 0 .. $#$input;
  }
  leaf($type, $reverse->([$values->[0]])->[0], $values->[0]);
  rejected(sub { $reverse->(undef) }, qr/List requires/);
  for my $value (@$invalid) {
    rejected(sub { $reverse->([$values->[0], $value]) }, qr/$message|scalar value/);
  }
  push @primitives, { name => $type, checks => $checks - $before, rejected_cases => 1 + @$invalid };
}
same(LeanBridge::Lists::join(["a\0", '', "\x{1f33f}"]), "a\0\x{1f331}\x{1f331}\x{1f33f}");
same(LeanBridge::Lists::join([]), '');
same(LeanBridge::Lists::mix([[1, 2, 3], [], [4]]), [[4], [], [3, 2, 1]]);
for my $index (0 .. 19) {
  my $packet = LeanBridge::Lists::Packet->new(sequences => [[1, 2, 3], [], [$index]],
    branches => [undef, some(ok([$huge, undef])), some(err("oops\0"))],
    buffers => ["\0\xff", ''], arrays => [[[$true, "\x{1f33f}"], [$false, "\0"]], []]);
  my $output = LeanBridge::Lists::transform($packet);
  same($output, LeanBridge::Lists::Packet->new(sequences => [[$index], [], [3, 2, 1]],
    branches => [some(err("oops\0!")), some(ok([$huge->copy->binc, undef])), undef],
    buffers => ['', "\0\xff"], arrays => [[], [[$false, "\0"], [$true, "\x{1f33f}"]]]));
  substr($output->buffers->[1], 0, 1) = 'x'; check($packet->buffers->[0] eq "\0\xff", 'bytes copied');
  $output->branches->[1]->value->value->[0]->binc;
  check($packet->branches->[1]->value->value->[0]->bcmp($huge) == 0, 'BigInts copied');
  $packet->sequences->[0]->[0] = 99; $packet->arrays->[0]->[0] = [$false, 'x'];
  same($output->sequences->[2], [3, 2, 1]); same($output->arrays->[1]->[1], [$true, "\x{1f33f}"]);
}
same(LeanBridge::Lists::nest(undef), undef); same(LeanBridge::Lists::nest(some([])), some([]));
same(LeanBridge::Lists::nest(some([ok([undef, undef]), err("bad\0"), ok([])])), some([ok([]), err("bad\0!"), ok([undef, undef])]));
same(LeanBridge::Lists::swap(err(['first', 'last'])), ok(['last', 'first']));
same(LeanBridge::Lists::swap(ok([[$huge, Math::BigInt->new(42)], [1, 2, 3]])), err([[Math::BigInt->new(42), $huge], [3, 2, 1]]));
for my $depth (0 .. 24) {
  my $value = $depth == 24 ? 42 : []; $value = [$value] for 1 .. $depth;
  same(LeanBridge::Lists::deep($value), $value);
}
my $input = "\0\xff"; my $copies = LeanBridge::Lists::duplicate($input);
same($copies, [$input, $input]); substr($copies->[0], 0, 1) = 'x'; check($copies->[1] eq $input && $input eq "\0\xff", 'duplicate results independent');
same(LeanBridge::Lists::duplicate(''), ['', '']);
my $shared = [1, 2]; my $copied = LeanBridge::Lists::mix([$shared, $shared]);
$copied->[0]->[0] = 9; same($copied->[1], [2, 1]); same($shared, [1, 2]);
my $watched = [1, 2]; my $weak = $watched; weaken($weak);
same(LeanBridge::Lists::reverse_uint32($watched), [2, 1]);
undef $watched; check(!defined($weak), 'weak references do not make an array tied');

for my $value (undef, 1, '1', {}, sub {}, bless([1], 'PretendList')) {
  rejected(sub { LeanBridge::Lists::reverse_uint32($value) }, qr/List requires/);
}
my $sparse = []; $sparse->[1] = 1;
rejected(sub { LeanBridge::Lists::reverse_uint32($sparse) }, qr/sparse/);
my $cycle = []; push @$cycle, $cycle;
rejected(sub { LeanBridge::Lists::reverse_uint32($cycle) }, qr/scalar/);
rejected(sub { LeanBridge::Lists::deep($cycle) }, qr/scalar/);
@$cycle = ();
my $wrong_depth = 42; $wrong_depth = [$wrong_depth] for 1 .. 25;
rejected(sub { LeanBridge::Lists::deep($wrong_depth) }, qr/scalar/);
{
  package TiedList;
  sub TIEARRAY { bless [], shift }
  sub FETCHSIZE { die 'unexpected tied array access' }
  sub FETCH { die 'unexpected tied array access' }
  package PretendSome; our @ISA = ('LeanBridge::Lists::Some');
}
tie my @tied, 'TiedList';
rejected(sub { LeanBridge::Lists::reverse_uint32(\@tied) }, qr/List requires/);
rejected(sub { LeanBridge::Lists::nest(bless({value => []}, 'PretendSome')) }, qr/Option requires/);
rejected(sub { LeanBridge::Lists::nest(some([ok([]), undef])) }, qr/Except requires/);
rejected(sub { LeanBridge::Lists::nest(some([ok([1])])) }, qr/Unit requires/);
rejected(sub { LeanBridge::Lists::mix([[1], undef]) }, qr/Array requires/);
rejected(sub { LeanBridge::Lists::transform({sequences => []}) }, qr/expected LeanBridge::Lists::Packet/);
for my $value ([], [[]], [[], [], []]) { rejected(sub { LeanBridge::Lists::swap(ok($value)) }, qr/Prod requires/); }
for my $class (qw(Some Ok Err)) {
  my $name = "LeanBridge::Lists::$class";
  rejected(sub { $name->new() }, qr/expects one payload/);
  rejected(sub { $name->new(1, 2) }, qr/expects one payload/);
}
rejected(sub { LeanBridge::Lists::reverse_bytes(['x' x (16 * 1024 * 1024)]) }, qr/16 MiB/);
rejected(sub { LeanBridge::Lists::reverse_uint32([(0) x (2097153)]) }, qr/16 MiB/);
for (1 .. 3) { rejected(sub { LeanBridge::Lists::duplicate('x' x (6 * 1024 * 1024)) }, qr/16 MiB/); }
rejected(sub { LeanBridge::Lists::generate(Math::BigInt->new(2097153)) }, qr/16 MiB/);
same(LeanBridge::Lists::generate(Math::BigInt->new(0)), []);
same(LeanBridge::Lists::generate(Math::BigInt->new(1)), [7]);
same(LeanBridge::Lists::generate(Math::BigInt->new(30000)), [(7) x 30000]);
recovered();

my $root = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) { my ($path) = /\s(\/\S+\.so)$/; next unless $path && index($path, "$root/") == 0;
  open my $file, '<:raw', $path or die $!; local $/; $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
print JSON::PP->new->canonical->encode({ checks => $checks, primitives => \@primitives, perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  word_bits => 8 * $Config{ptrsize}, api => abs_path($INC{'LeanBridge/Lists.pm'}), native_libraries => \%libraries }) . "\n";
