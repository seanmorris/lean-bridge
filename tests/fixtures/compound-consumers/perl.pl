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
use Scalar::Util qw(blessed refaddr);
use LeanBridge::Compounds;

my $checks = 0;
sub check { die "Compound assertion #$checks failed: $_[1]\n" unless $_[0]; ++$checks; }
sub some { LeanBridge::Compounds::Some->new($_[0]) }
sub ok { LeanBridge::Compounds::Ok->new($_[0]) }
sub err { LeanBridge::Compounds::Err->new($_[0]) }
sub recovered {
  check(LeanBridge::Compounds::classify(some(some(undef))) == 2, 'public API recovers after errors');
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
sub branch {
  my ($name, $type, $actual, $expected) = @_;
  check(ref($actual) eq "LeanBridge::Compounds::$name", 'branch class');
  check(keys(%$actual) == 1 && exists($actual->{value}), 'branch payload');
  leaf($type, $actual->value, $expected);
}
my $true = LeanBridge::Compounds::true();
my $false = LeanBridge::Compounds::false();
my $huge = Math::BigInt->new('9' x 1234);
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
  my ($option, $result, $product) = map { LeanBridge::Compounds->can("${_}_$type") } qw(option result tuple);
  my $before = $checks;
  same($option->(undef), undef);
  for my $index (0 .. 127) {
    my ($a, $b) = ($values->[$index % @$values], $values->[($index + 1) % @$values]);
    branch('Some', $type, $option->(some($a)), $a);
    branch('Err', $type, $result->(ok($a)), $a);
    branch('Ok', $type, $result->(err($a)), $a);
    my $pair = $product->([$a, $b]);
    check(ref($pair) eq 'ARRAY' && @$pair == 2, 'binary product');
    leaf($type, $pair->[0], $b); leaf($type, $pair->[1], $a);
  }
  for my $value (@$invalid) {
    rejected(sub { $option->(some($value)) }, $message);
    rejected(sub { $result->(ok($value)) }, $message);
    rejected(sub { $result->(err($value)) }, $message);
    rejected(sub { $product->([$values->[0], $value]) }, $message);
  }
  push @primitives, { name => $type, checks => $checks - $before, rejected_cases => 4 * @$invalid };
}
my @states = (undef, some(undef), some(some(undef)));
my $state;
for my $step (0 .. 29) {
  same($state, $states[$step % 3]); check(LeanBridge::Compounds::classify($state) == $step % 3, 'presence');
  $state = LeanBridge::Compounds::next($state);
}
same(LeanBridge::Compounds::make(), some(ok([18446744073709551615, undef])));
same(LeanBridge::Compounds::flip(ok([42, some(undef)])), err([42, some(undef)]));
same(LeanBridge::Compounds::flip(ok([0, undef])), err([0, undef]));
same(LeanBridge::Compounds::flip(err(some("a\0\x{3bb}"))), ok(some("a\0\x{3bb}")));
same(LeanBridge::Compounds::flip(err(undef)), ok(undef));
same(LeanBridge::Compounds::duplicate(undef), err('empty'));
same(LeanBridge::Compounds::duplicate(some("\0\xff")), ok(some(["\0\xff", "\0\xff"])));

for my $choice (undef, some(ok([$huge, undef])), some(err("oops\0"))) {
  for my $inside (ok(undef), ok(some(ok([42, undef]))), ok(some(err('bad'))), err(undef), err(some($huge))) {
    my $rows = [undef, some(ok(["row\0\x{1f33f}", 18446744073709551615])), some(err(["\0\xff", $negative]))];
    my $original = LeanBridge::Compounds::Packet->new(choice => $choice, products => [[4, "a\0"], [$true, "\x{1f33f}"]], rows => $rows, nested => $inside);
    my $output = LeanBridge::Compounds::transform($original);
    my $expected = !defined($choice) ? undef : ref($choice->value) eq 'LeanBridge::Compounds::Ok'
      ? some(ok([$huge->copy->binc, undef])) : some(err("oops\0!"));
    same($output, LeanBridge::Compounds::Packet->new(choice => $expected, products => [[5, "a\0!"], [$false, "\x{1f33f}"]], rows => [reverse @$rows], nested => $inside));
    substr($output->rows->[0]->value->value->[0], 0, 1) = 'x';
    check($rows->[2]->value->value->[0] eq "\0\xff", 'bytes are copied');
    $output->rows->[0]->value->value->[1]->binc;
    check($negative->bstr eq '-' . ('9' x 1234), 'BigInts are copied');
    $output->products->[0]->[1] = 'changed'; check($original->products->[0]->[1] eq "a\0", 'nested products copied');
  }
}
for my $depth (0 .. 24) {
  my $value = $depth == 24 ? ok([42, undef]) : undef;
  $value = some($value) for 1 .. $depth;
  same(LeanBridge::Compounds::deep($value), $value);
}
my $deep = err("deep\0\x{3bb}"); $deep = some($deep) for 1 .. 24;
same(LeanBridge::Compounds::deep($deep), $deep);
my $input = "\0\xff";
my $copies = LeanBridge::Compounds::duplicate(some($input))->value->value;
substr($copies->[0], 0, 1) = 'x'; check($copies->[1] eq $input && $input eq "\0\xff", 'independent output copies');
my $pair = LeanBridge::Compounds::tuple_bytes([$input, $input]);
substr($pair->[0], 0, 1) = 'y'; check($pair->[1] eq $input, 'aliased inputs copied independently');

for my $name (qw(Some Ok Err)) {
  my $class = "LeanBridge::Compounds::$name";
  same($class->new(undef)->value, undef);
  rejected(sub { $class->new() }, qr/expects one payload/);
  rejected(sub { $class->new(1, 2) }, qr/expects one payload/);
}
for my $value (0, $false, [], {}, { value => 1 }, ok(1), bless({ value => 1 }, 'PretendSome')) {
  rejected(sub { LeanBridge::Compounds::option_uint32($value) }, qr/Option requires/);
}
for my $value (undef, 42, some(42), [1, 42], { ok => 42 }) {
  rejected(sub { LeanBridge::Compounds::result_uint32($value) }, qr/Except requires/);
}
for my $name (qw(Some Ok Err)) {
  my $call = LeanBridge::Compounds->can($name eq 'Some' ? 'option_uint32' : 'result_uint32');
  for my $fields ({}, { wrong => 1 }, { value => 1, extra => 2 }) {
    rejected(sub { $call->(bless($fields, "LeanBridge::Compounds::$name")) }, qr/exactly one value|missing record field/);
  }
  rejected(sub { $call->(bless([], "LeanBridge::Compounds::$name")) }, qr/requires/);
}
for my $value (undef, 'ab', {}, bless([1, 2], 'PretendPair'), [], [1], [1, 2, 3]) {
  rejected(sub { LeanBridge::Compounds::tuple_uint32($value) }, qr/Prod requires/);
}
my $sparse = []; $sparse->[1] = 1;
rejected(sub { LeanBridge::Compounds::tuple_uint32($sparse) }, qr/sparse/);
my $cycle = []; push @$cycle, $cycle, $cycle;
rejected(sub { LeanBridge::Compounds::tuple_uint32($cycle) }, qr/scalar/);
@$cycle = ();
my $wrong_depth = undef; $wrong_depth = some($wrong_depth) for 1 .. 25;
rejected(sub { LeanBridge::Compounds::deep($wrong_depth) }, qr/Except requires/);
{
  package TiedBranch;
  sub TIEHASH { bless {}, shift }
  sub FIRSTKEY { die 'unexpected tied hash access' }
  sub FETCH { die 'unexpected tied hash access' }
  package TiedPair;
  sub TIEARRAY { bless [], shift }
  sub FETCHSIZE { die 'unexpected tied array access' }
  sub FETCH { die 'unexpected tied array access' }
}
tie my %tied_branch, 'TiedBranch';
tie my @tied_pair, 'TiedPair';
rejected(sub { LeanBridge::Compounds::option_uint32(bless(\%tied_branch, 'LeanBridge::Compounds::Some')) }, qr/Option requires/);
rejected(sub { LeanBridge::Compounds::tuple_uint32(\@tied_pair) }, qr/Prod requires/);
rejected(sub { LeanBridge::Compounds::option_bytes(some('x' x (16 * 1024 * 1024))) }, qr/16 MiB/);
rejected(sub { LeanBridge::Compounds::duplicate(some('x' x (6 * 1024 * 1024))) }, qr/16 MiB/);
same(LeanBridge::Compounds::duplicate(some($input)), ok(some([$input, $input])));
recovered();

my $root = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) { my ($path) = /\s(\/\S+\.so)$/; next unless $path && index($path, "$root/") == 0;
  open my $file, '<:raw', $path or die $!; local $/; $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
print JSON::PP->new->canonical->encode({ checks => $checks, primitives => \@primitives, perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  word_bits => 8 * $Config{ptrsize}, api => abs_path($INC{'LeanBridge/Compounds.pm'}), native_libraries => \%libraries }) . "\n";
