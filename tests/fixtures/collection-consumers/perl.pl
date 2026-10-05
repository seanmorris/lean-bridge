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
use LeanBridge::Collections;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub call { my $name = shift; ++$calls; my $function = LeanBridge::Collections->can($name) or die "missing public function $name"; return $function->(@_); }
sub check ($;$) { die "Collection assertion #$checks failed: $_[1]\n" unless $_[0]; ++$checks; }
sub recovered {
  my $out = call('array_reverse_uint32', [[1, 2, 3]]); check(join(',', @{$out->[0]}) eq '3,2,1', 'public API recovers after errors');
}
sub rejected {
  my ($call, $message) = @_;
  my $passed = eval { $call->(); 1 }; my $error = $@;
  check(!$passed && "$error" =~ $message, "expected rejection: $error"); ++$rejected; recovered();
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
my $true = LeanBridge::Collections::true();
my $false = LeanBridge::Collections::false();
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
my @fields = qw(unit flag u8 u16 u32 u64 i8 i16 i32 i64 natural integer f32 f64 text bytes char usize isize);
sub primitive {
  my ($index) = @_;
  return LeanBridge::Collections::Primitives->new(map { $fields[$_] => $cases[$_][1][$index % @{$cases[$_][1]}] } 0 .. $#fields);
}
sub same_primitive {
  my ($actual, $expected) = @_;
  check(ref($actual) eq 'LeanBridge::Collections::Primitives', 'nominal record');
  check(join(',', sort keys %$actual) eq join(',', sort @fields), 'record fields');
  leaf($cases[$_][0], $actual->{$fields[$_]}, $expected->{$fields[$_]}) for 0 .. $#fields;
}
my @primitives;
for my $case (@cases) {
  my ($type, $values, $invalid, $message) = @$case;
  my $before = $checks;
  same(call("array_reverse_$type", []), []);
  same(call("array_reverse_$type", [[], []]), [[], []]);
  for my $index (0 .. 127) {
    my $row = [@$values[$index % @$values, ($index + 1) % @$values, ($index + 2) % @$values, $index % @$values]];
    my $input = [$row, [], [$values->[0]], $row];
    my $actual = call("array_reverse_$type", $input);
    check(ref($actual) eq 'ARRAY' && @$actual == 4, 'outer Array');
    for my $i (0 .. 3) {
      my $expected = $input->[3 - $i];
      check(ref($actual->[$i]) eq 'ARRAY' && @{$actual->[$i]} == @$expected, 'inner Array');
      leaf($type, $actual->[$i][$_], $expected->[$#$expected - $_]) for 0 .. $#$expected;
    }
  }
  rejected(sub { call("array_reverse_$type", undef) }, qr/Array requires/);
  for my $value (@$invalid) {
    rejected(sub { call("array_reverse_$type", [[$values->[0]], [$values->[0], $value]]) }, qr/$message|scalar value/);
  }
  push @primitives, { name => $type, checks => $checks - $before, rejected_cases => 1 + @$invalid };
}
for my $index (0 .. 127) {
  my $a = primitive($index); my $b = primitive($index + 1);
  my $out = call('record_reverse', [$a, $b, $a]);
  same_primitive($out->[0], $a); same_primitive($out->[1], $b); same_primitive($out->[2], $a);
}
same(call('record_reverse', []), []);

my $power = Math::BigInt->bone->blsft(200);
my @interpreted = (undef, $true, 255, 65535, 4294967295, 18446744073709551615,
  -128, -32768, -2147483648, -9223372036854775808, $power, $power->copy->bneg,
  unpack('f<', pack('L<', 2147483648)), 3.25, "\x{1f331}\0", "\xff\0\x80", "\x{1f331}", 18446744073709551615, -2147483648);
check(call('array_check_elements', map { [$_] } @interpreted), 'Lean independently interprets boxed elements');
my $record = LeanBridge::Collections::Primitives->new(map { $fields[$_] => $interpreted[$_] } 0 .. $#fields);
check(call('record_inspect', $record), 'Lean independently interprets fields');
for my $i (1 .. $#fields) {
  my @changed = @interpreted; $changed[$i] = $cases[$i][1][0];
  $changed[$i] = $cases[$i][1][1] if encode($cases[$i][0], $changed[$i]) eq encode($cases[$i][0], $interpreted[$i]);
  check(!call('array_check_elements', map { [$_] } @changed), "Lean rejects changed element $fields[$i]");
  my $changed = LeanBridge::Collections::Primitives->new(map { $fields[$_] => $changed[$_] } 0 .. $#fields);
  check(!call('record_inspect', $changed), "Lean rejects changed field $fields[$i]");
}
same(call('array_add', Math::BigInt->new(7), [[$negative, $huge], []]), [[$negative->copy->badd(7), $huge->copy->badd(7)], []]);
same(call('array_total', [[$huge, Math::BigInt->new(1)], [], [$huge]]), $huge->copy->bmul(2)->binc);
same(call('array_total', []), Math::BigInt->new(0));
same(call('array_words'), [["\x{feff}Lean", "\x{1f331}\0"], []]);
same(call('array_size', [undef, undef]), 2); same(call('array_size', []), 0);
same(call('record_empty', LeanBridge::Collections::Empty->new()), LeanBridge::Collections::Empty->new());
same(call('record_single', LeanBridge::Collections::Single->new(value => 18446744073709551615)), LeanBridge::Collections::Single->new(value => 0));
same(call('record_count', LeanBridge::Collections::Count->new(value => $huge)), LeanBridge::Collections::Count->new(value => $huge->copy->binc));
same(call('record_make'), LeanBridge::Collections::Pair->new(first => 42, second => "\x{feff}\x{1f331}\0"));
for my $index (0 .. 31) {
  my $packet = LeanBridge::Collections::Packet->new(label => "parcel\0", values => [[$record], [], [$record, $record]],
    empty => LeanBridge::Collections::Empty->new(), single => LeanBridge::Collections::Single->new(value => 18446744073709551615),
    count => LeanBridge::Collections::Count->new(value => $huge), pair => LeanBridge::Collections::Pair->new(first => 4294967295, second => 'a'),
    reversed => LeanBridge::Collections::Reversed->new(second => 'b', first => $index));
  my $out = call('record_shuffle', $packet);
  same($out, LeanBridge::Collections::Packet->new(label => "parcel\0!", values => [[$record, $record], [], [$record]],
    empty => LeanBridge::Collections::Empty->new(), single => LeanBridge::Collections::Single->new(value => 0),
    count => LeanBridge::Collections::Count->new(value => $huge->copy->badd(7)), pair => LeanBridge::Collections::Pair->new(first => 0, second => 'ap'),
    reversed => LeanBridge::Collections::Reversed->new(second => 'br', first => $index + 2)));
  my $copies = call('record_duplicate', $packet);
  same($copies, [$packet, $packet]);
  $copies->[0]->count->value->binc; $copies->[0]->values->[0][0]->natural->binc;
  substr($copies->[0]->values->[0][0]{bytes}, 0, 1) = 'x';
  same($copies->[1], $packet); check($packet->count->value->bcmp($huge) == 0, 'record owns copied BigInt');
  check($packet->values->[0][0]->natural->bcmp($power) == 0, 'nested fields own independent values');
  $packet->{label} = 'changed'; $packet->values->[0][0] = primitive(1);
  check($out->label eq "parcel\0!", 'input record mutation isolated'); same_primitive($out->values->[2][0], $record);
}
my $input = "\0\xff"; my $copies = call('array_duplicate', [$input]);
same($copies, [$input, $input]); substr($copies->[0], 0, 1) = 'x'; check($copies->[1] eq $input && $input eq "\0\xff", 'byte results independent');
my $shared = [1, 2]; my $copied = call('array_reverse_uint32', [$shared, $shared]);
$copied->[0][0] = 9; same($copied->[1], [2, 1]); same($shared, [1, 2]);
for my $depth (0 .. 24) {
  my $value = $depth == 24 ? 42 : []; $value = [$value] for 1 .. $depth;
  same(call('deep', $value), $value);
}

# A host conversion may resize the input. Later slots must keep their original values.
my $reentrant_arrays = 0;
for my $mutation ('clear', 'replace', 'append') {
  my $row = [$huge, Math::BigInt->new(42)];
  my $original = Math::BigInt->can('bstr'); my $seen = 0;
  no warnings 'redefine';
  local *Math::BigInt::bstr = sub {
    if (!$seen++) {
      @$row = () if $mutation eq 'clear';
      @$row = (Math::BigInt->new(99)) if $mutation eq 'replace';
      push @$row, Math::BigInt->new(99) if $mutation eq 'append';
    }
    $original->(@_);
  };
  my $out = call('array_reverse_nat', [$row]);
  check(@{$out->[0]} == 2 && $out->[0][0]->bcmp(42) == 0 && $out->[0][1]->bcmp($huge) == 0, "reentrant $mutation"); ++$reentrant_arrays;
}
for my $value (undef, 1, '1', {}, sub {}, bless([], 'PretendArray')) {
  rejected(sub { call('array_reverse_uint32', $value) }, qr/Array requires/);
}
my $sparse = []; $sparse->[1] = 1;
rejected(sub { call('array_reverse_uint32', [$sparse]) }, qr/sparse/);
my $cycle = []; push @$cycle, $cycle;
rejected(sub { call('deep', $cycle) }, qr/scalar/); @$cycle = ();
my $wrong_depth = 42; $wrong_depth = [$wrong_depth] for 1 .. 25;
rejected(sub { call('deep', $wrong_depth) }, qr/scalar/);
my $watched = [1, 2]; my $weak = $watched; weaken($weak);
same(call('array_reverse_uint32', [$watched]), [[2, 1]]); undef $watched; check(!defined($weak), 'weak references remain supported');
{
  package TiedCollection;
  sub TIEARRAY { bless [], shift }
  sub FETCHSIZE { die 'unexpected tied array access' }
  sub FETCH { die 'unexpected tied access' }
  sub TIEHASH { bless {}, shift }
  sub SCALAR { die 'unexpected tied hash access' }
  package PretendRecord; our @ISA = ('LeanBridge::Collections::Single');
}
tie my @tied, 'TiedCollection'; tie my %tied, 'TiedCollection';
rejected(sub { call('array_reverse_uint32', \@tied) }, qr/Array requires/);
rejected(sub { call('record_single', bless(\%tied, 'LeanBridge::Collections::Single')) }, qr/expected LeanBridge::Collections::Single/);
rejected(sub { call('record_single', bless({value => 1}, 'PretendRecord')) }, qr/expected LeanBridge::Collections::Single/);
rejected(sub { call('record_single', {value => 1}) }, qr/expected LeanBridge::Collections::Single/);
rejected(sub { call('record_single', LeanBridge::Collections::Count->new(value => Math::BigInt->new(1))) }, qr/expected LeanBridge::Collections::Single/);
for my $fields ({}, {wrong => 1}, {value => 1, extra => 2}) {
  rejected(sub { call('record_single', bless($fields, 'LeanBridge::Collections::Single')) }, qr/record fields|missing record field/);
}
rejected(sub { LeanBridge::Collections::Single->new() }, qr/record fields/);
same(call('record_single', LeanBridge::Collections::Single->new(value => 1, value => 2)), LeanBridge::Collections::Single->new(value => 3));
rejected(sub { LeanBridge::Collections::Single->new('value') }, qr/expects named fields/);
rejected(sub { PretendRecord->new(value => 1) }, qr/expects named fields/);
for my $i (0 .. $#fields) {
  my $bad = LeanBridge::Collections::Primitives->new(%$record); $bad->{$fields[$i]} = $cases[$i][2][0];
  rejected(sub { call('record_inspect', $bad) }, qr/$cases[$i][3]|scalar value/);
}
rejected(sub { call('array_reverse_bytes', [['x' x (16 * 1024 * 1024)]]) }, qr/16 MiB/);
rejected(sub { call('array_reverse_uint32', [[(0) x (2097153)]]) }, qr/16 MiB/);
for (1 .. 3) { rejected(sub { call('array_duplicate', ['x' x (6 * 1024 * 1024)]) }, qr/16 MiB/); }
rejected(sub { call('generate', Math::BigInt->new(2097153)) }, qr/16 MiB/);
same(call('generate', Math::BigInt->new(0)), []); same(call('generate', Math::BigInt->new(1)), [undef]);
same(call('generate', Math::BigInt->new(30000)), [(undef) x 30000]); recovered();

my $root = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) { my ($path) = /\s(\/\S+\.so)$/; next unless $path && index($path, "$root/") == 0;
  open my $file, '<:raw', $path or die $!; local $/; $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
print JSON::PP->new->canonical->encode({ checks => $checks, calls => $calls, rejected => $rejected, primitives => \@primitives,
  record_types => [qw(Primitives Empty Single Count Pair Reversed Packet)], reentrant_arrays => $reentrant_arrays,
  perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  word_bits => 8 * $Config{ptrsize}, api => abs_path($INC{'LeanBridge/Collections.pm'}), native_libraries => \%libraries }) . "\n";
