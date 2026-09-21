# Independent consumer of the installed public CPAN API.
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
use Scalar::Util qw(blessed refaddr);
use LeanBridge::Variants;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub check ($;$) { confess("Variant assertion #$checks: " . ($_[1] // '')) unless $_[0]; ++$checks; }
sub call {
  my ($name, @args) = @_; my $fn = LeanBridge::Variants->can($name);
  check($fn, "public function $name"); ++$calls; return $fn->(@args);
}
sub ctor { my ($name, @args) = @_; return "LeanBridge::Variants::$name"->new(@args); }
sub some { LeanBridge::Variants::Some->new($_[0]) }
sub ok { LeanBridge::Variants::Ok->new($_[0]) }
sub err { LeanBridge::Variants::Err->new($_[0]) }
my %fields = (
  'Signal::Idle' => [], 'Signal::Stopped' => [], 'Signal::Data' => [qw(count label)], 'Signal::Marker' => ['value'],
  'Mode::First' => [], 'Mode::Second' => [], 'Mode::Third' => [],
  'Nested::Empty' => [], 'Nested::Packet' => ['value'], 'Nested::Outcome' => ['value'],
  'Scalars::Absent' => [], 'Scalars::All' => [qw(unit bool u8 u16 u32 u64 i8 i16 i32 i64 natural integer f32 f64 text bytes char word signedWord)],
  'Anonymous::Number' => ['arg0'], 'Anonymous::Pair' => [qw(arg0 arg1)], 'Anonymous::Collision' => [qw(arg1 arg1_)],
  'One::Only' => ['value'], 'Buffers::Empty' => [], 'Buffers::Pair' => [qw(first second)],
  'Packet' => [qw(current events fallback modes)], 'Some' => ['value'], 'Ok' => ['value'], 'Err' => ['value']
);
my @primitive_fields = ([unit => 'unit'], [bool => 'bool'], [u8 => 'uint8'], [u16 => 'uint16'], [u32 => 'uint32'], [u64 => 'uint64'],
  [i8 => 'int8'], [i16 => 'int16'], [i32 => 'int32'], [i64 => 'int64'], [natural => 'nat'], [integer => 'int'],
  [f32 => 'float32'], [f64 => 'float64'], [text => 'string'], [bytes => 'bytes'], [char => 'char'], [word => 'usize'], [signedWord => 'isize']);
sub encode {
  my ($type, $value) = @_;
  if ($type eq 'unit') { check(!defined($value), 'Unit'); return 'unit'; }
  if ($type eq 'bool') { check(is_bool($value), 'Bool'); return $value ? 'true' : 'false'; }
  if ($type eq 'nat' || $type eq 'int') {
    check(blessed($value) && $value->isa('Math::BigInt'), 'exact integer'); return $value->bstr;
  }
  check(defined($value) && !ref($value) && !is_bool($value), "scalar $type");
  my $flags = svref_2object(\$value)->FLAGS;
  if ($type =~ /\A(?:u?int(?:8|16|32|64)|[ui]size)\z/) { check($flags & SVf_IOK, 'integer'); return "$value"; }
  if ($type eq 'float32' || $type eq 'float64') {
    check($flags & (SVf_NOK | SVf_IOK), 'numeric'); return 'nan' if $value != $value;
    return unpack('H*', pack($type eq 'float32' ? 'f<' : 'd<', $value));
  }
  check($flags & SVf_POK, 'text or octets');
  if ($type eq 'bytes') { check(!utf8::is_utf8($value), 'octets'); return unpack('H*', $value); }
  check($type eq 'string' || ($type eq 'char' && length($value) == 1), 'Unicode scalar');
  return join(',', unpack('U*', $value));
}
sub leaf { my ($type, $actual, $expected) = @_; check(encode($type, $actual) eq encode($type, $expected), $type); }
sub same {
  my ($actual, $expected) = @_; check(ref($actual) eq ref($expected), 'same host type');
  if (!defined($expected)) { check(!defined($actual), 'undef'); }
  elsif (blessed($expected) && $expected->isa('Math::BigInt')) { check($actual->bstr eq $expected->bstr, 'BigInt'); }
  elsif (ref($expected) eq 'ARRAY') {
    check(@$actual == @$expected, 'array size'); same($actual->[$_], $expected->[$_]) for 0 .. $#$expected;
  } elsif (ref($expected)) {
    my $name = ref($expected); $name =~ s/\ALeanBridge::Variants:://;
    check(exists $fields{$name}, 'independent constructor catalog');
    check(join(',', sort keys %$actual) eq join(',', sort @{$fields{$name}}), 'exact fields');
    if ($name eq 'Scalars::All') { leaf($_->[1], $actual->{$_->[0]}, $expected->{$_->[0]}) for @primitive_fields; }
    else { same($actual->{$_}, $expected->{$_}) for @{$fields{$name}}; }
  } else { check(defined($actual) && is_bool($actual) == is_bool($expected) && $actual eq $expected, 'value'); }
}
sub recovered { same(call('next', ctor('Signal::Idle')), ctor('Signal::Stopped')); }
sub rejects {
  my ($invoke, $pattern) = @_; my $passed = eval { $invoke->(); 1 }; my $error = $@;
  check(!$passed && "$error" =~ $pattern, "expected rejection: $error"); ++$rejected; recovered();
}
for my $family (qw(Signal Mode Nested Scalars Anonymous One Buffers)) {
  rejects(sub { ctor($family) }, qr/named variant constructor/);
}
for my $name (sort keys %fields) {
  my $class = "LeanBridge::Variants::$name";
  check($class->can('new'), 'constructor'); check($class->can($_), "accessor $name.$_") for @{$fields{$name}};
}
for my $name (qw(echo echo_mode echo_nested echo_scalars echo_anonymous echo_one echo_buffers signals next code make inspect duplicate produce)) {
  check(LeanBridge::Variants->can($name), $name);
}
my %scalars = (unit => undef, bool => LeanBridge::Variants::true(), u8 => 255, u16 => 65535,
  u32 => 4294967295, u64 => 18446744073709551615, i8 => -128, i16 => -32768, i32 => -2147483648, i64 => -9223372036854775808,
  natural => Math::BigInt->bone->blsft(5120)->badd(19), integer => Math::BigInt->bone->blsft(5120)->badd(31)->bneg,
  f32 => 1.5, f64 => -2.25, text => "A\0\x{1f331}", bytes => "\0\xff\1", char => "\x{1f331}", word => 4294967295, signedWord => -2147483648);
my $scalar = ctor('Scalars::All', %scalars);
sub scalar_with { my %value = (%scalars, @_); return ctor('Scalars::All', %value); }
leaf('bool', call('inspect', $scalar), LeanBridge::Variants::true());
for my $pair (@primitive_fields) {
  my ($field, $type) = @$pair; next if $type eq 'unit';
  my $changed = $type eq 'bool' ? LeanBridge::Variants::false() : $type eq 'char' ? 'A' :
    $type eq 'string' || $type eq 'bytes' ? '' : $type eq 'nat' || $type eq 'int' ? Math::BigInt->bzero : 0;
  leaf('bool', call('inspect', scalar_with($field => $changed)), LeanBridge::Variants::false());
}
my @signals = (ctor('Signal::Idle'), ctor('Signal::Stopped'), ctor('Signal::Data', count => 42, label => "A\0\x{1f331}"), ctor('Signal::Marker', value => undef));
for my $index (0 .. 127) {
  for my $value (@signals) { my $copy = call('echo', $value); same($copy, $value); check(refaddr($copy) != refaddr($value), 'independent object'); }
  same(call('next', $signals[0]), ctor('Signal::Stopped'));
  same(call('next', $signals[1]), ctor('Signal::Marker', value => undef));
  same(call('next', $signals[2]), ctor('Signal::Data', count => 43, label => "A\0\x{1f331}!"));
  same(call('next', $signals[3]), ctor('Signal::Data', count => 42, label => 'ready'));
  my @codes = (7, 13, 48, 29); leaf('uint32', call('code', $signals[$_]), $codes[$_]) for 0 .. 3;
  for my $name (qw(First Second Third)) { same(call('echo_mode', ctor("Mode::$name")), ctor("Mode::$name")); }
  my $events = [@signals];
  my $packet = ctor('Packet', current => $signals[2], events => $events, fallback => some($signals[3]), modes => [ctor('Mode::First'), ctor('Mode::Third')]);
  my $result = call('echo_nested', ctor('Nested::Packet', value => $packet));
  same($result, ctor('Nested::Packet', value => $packet));
  @$events = (); $packet->{current} = ctor('Signal::Idle'); same($result->value->events, \@signals);
  my $empty = ctor('Packet', current => ctor('Signal::Idle'), events => [], fallback => undef, modes => []);
  for my $value (ctor('Nested::Empty'), ctor('Nested::Packet', value => $empty),
    ctor('Nested::Outcome', value => ok([ctor('Signal::Marker', value => undef), ctor('Mode::Second')])), ctor('Nested::Outcome', value => err("A\0\x{1f331}"))) {
    same(call('echo_nested', $value), $value);
  }
  same(call('signals', [[], [@signals], [$signals[2], $signals[2]]]), [[], [reverse @signals], [$signals[2], $signals[2]]]);
  same(call('echo_scalars', $scalar), $scalar); same(call('echo_scalars', ctor('Scalars::Absent')), ctor('Scalars::Absent'));
  for my $value (ctor('Anonymous::Number', arg0 => 13), ctor('Anonymous::Pair', arg0 => 17, arg1 => "A\0\x{1f331}"), ctor('Anonymous::Collision', arg1 => 19, arg1_ => "A\0\x{1f331}")) {
    same(call('echo_anonymous', $value), $value);
  }
  same(call('echo_one', ctor('One::Only', value => $index)), ctor('One::Only', value => $index + 1));
  for my $value (ctor('Buffers::Empty'), ctor('Buffers::Pair', first => '', second => ''), ctor('Buffers::Pair', first => "\0\xff", second => 'abc')) {
    same(call('echo_buffers', $value), $value);
  }
  same(call('duplicate', "\0\xff\1"), ctor('Buffers::Pair', first => "\0\xff\1", second => "\0\xff\1"));
}
for my $bits (0, 9223372036854775808, 1, 4503599627370495, 4503599627370496, 4607182418800017408, 9218868437227405311, 9218868437227405312, 18442240474082181120, 9221120237041090560) {
  my $special = unpack('d<', pack('Q<', $bits));
  my $value = scalar_with(f32 => $special, f64 => $special, word => 18446744073709551615, signedWord => -9223372036854775808);
  same(call('echo_scalars', $value), $value);
}
for my $point (0, 0xd7ff, 0xe000, 0x10ffff) { my $value = scalar_with(char => chr($point)); same(call('echo_scalars', $value), $value); }
my @invalid = (
  [unit => [0, '', []], qr/Unit requires/], [bool => [0, 1, 'true', undef], qr/Bool requires/],
  [u8 => [-1, 256, 1.5, '1'], qr/unsigned integer/], [u16 => [-1, 65536, 1.5, '1'], qr/unsigned integer/],
  [u32 => [-1, 4294967296, 1.5, '1'], qr/unsigned integer/], [u64 => [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/],
  [i8 => [-129, 128, '1'], qr/signed integer/], [i16 => [-32769, 32768, '1'], qr/signed integer/],
  [i32 => [-2147483649, 2147483648, '1'], qr/signed integer/], [i64 => [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/],
  [natural => [0, Math::BigInt->new(-1), Math::BigInt->bnan], qr/Math::BigInt|Nat cannot|invalid decimal/],
  [integer => [0, Math::BigInt->bnan, Math::BigInt->binf], qr/Math::BigInt|invalid decimal/],
  [f32 => ['1', [], undef], qr/Float requires/], [f64 => ['1', [], undef], qr/Float requires/],
  [text => [1, [], undef, "\x{d800}", "\x{110000}"], qr/String requires|invalid Unicode/],
  [bytes => [1, [], undef, "\x{100}"], qr/ByteArray requires/],
  [char => ['', 'ab', "\x{d800}", "\x{110000}", 65, undef, []], qr/Char requires/],
  [word => [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/], [signedWord => [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/]
);
for my $entry (@invalid) { my ($field, $values, $message) = @$entry; for my $value (@$values) {
  rejects(sub { call('echo_scalars', scalar_with($field => $value)) }, qr/$message|scalar value/);
} }
for my $value (undef, {}, {kind => 'idle'}, ctor('Mode::First'), bless({}, 'LeanBridge::Variants::Signal'),
  bless({extra => undef}, 'LeanBridge::Variants::Signal::Idle'), bless({count => 1}, 'LeanBridge::Variants::Signal::Data'),
  ctor('Signal::Marker', value => 1), ctor('Signal::Data', count => -1, label => 'bad'), ctor('Signal::Data', count => 1, label => undef)) {
  rejects(sub { call('echo', $value) }, qr/constructor|record field|Unit requires|unsigned integer|String requires/);
}
{
  package FakeSignal; our @ISA = ('LeanBridge::Variants::Signal::Data');
  package TiedFields;
  sub TIEHASH { bless {}, shift }
  sub FETCH { die 'tied field accessed' }
  sub FIRSTKEY { die 'tied fields enumerated' }
  sub SCALAR { die 'tied fields counted' }
  package main;
}
tie my %tied, 'TiedFields';
rejects(sub { call('echo', bless(\%tied, 'LeanBridge::Variants::Signal::Data')) }, qr/plain untied hash/);
rejects(sub { call('echo', bless({count => 1, label => 'fake'}, 'FakeSignal')) }, qr/exact.*constructor/);
rejects(sub { FakeSignal->new(count => 1, label => 'fake') }, qr/expects named fields/);
rejects(sub { ctor('Signal::Data', count => 1) }, qr/constructor fields/);
rejects(sub { ctor('Signal::Idle', value => undef) }, qr/constructor fields/);
rejects(sub { ctor('Signal::Data', count => 1, label => 'x', count => 2) }, qr/duplicate constructor field/);
rejects(sub { ctor('Signal::Data', 'count') }, qr/expects named fields/);
my $cycle = []; push @$cycle, $cycle; rejects(sub { call('signals', $cycle) }, qr/exact.*constructor/); @$cycle = ();
for my $name (qw(echo echo_scalars echo_nested echo_mode echo_one echo_anonymous echo_buffers)) {
  rejects(sub { call($name) }, qr/expects 1 arguments/); rejects(sub { call($name, undef, undef) }, qr/expects 1 arguments/);
}
for (1 .. 3) {
  rejects(sub { call('echo', ctor('Signal::Data', count => 1, label => 'x' x (16 * 1024 * 1024 + 1))) }, qr/16 MiB/);
  my $blob = 'x' x (8 * 1024 * 1024); rejects(sub { call('echo_buffers', ctor('Buffers::Pair', first => $blob, second => $blob)) }, qr/16 MiB/);
  rejects(sub { call('produce', Math::BigInt->new(17 * 1024 * 1024)) }, qr/16 MiB/);
}
same(call('produce', Math::BigInt->new(30000)), ctor('Buffers::Pair', first => "\21" x 30000, second => "\1"));
same(call('make', 0), ctor('Signal::Idle')); same(call('make', 7), ctor('Signal::Data', count => 7, label => 'made'));
my $blob = "\0\xff"; my $copy = call('duplicate', $blob); substr($blob, 0, 1) = "\11"; substr($copy->{first}, 1, 1) = "\7";
same($copy->second, "\0\xff"); same($blob, "\11\xff");
my $scalar_copy = call('echo_scalars', $scalar); $scalar_copy->{natural}->binc; $scalar_copy->{text} = 'changed';
same($scalar->natural, Math::BigInt->bone->blsft(5120)->badd(19)); same($scalar->text, "A\0\x{1f331}");
my $root = abs_path($ENV{PERL5LIB}); open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) { my ($path) = /\s(\/\S+\.so)$/; next unless $path && index($path, "$root/") == 0;
  open my $file, '<:raw', $path or die $!; local $/; $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
check(keys(%libraries) == 5, 'installed libraries');
print JSON::PP->new->canonical->encode({ checks => $checks, calls => $calls, rejected => $rejected, primitives => [map { $_->[1] } @primitive_fields],
  perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  word_bits => 8 * $Config{ptrsize}, api => abs_path($INC{'LeanBridge/Variants.pm'}), native_libraries => \%libraries }) . "\n";
