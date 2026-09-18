# Exercise independently specified values through installed Perl callbacks and closures.
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
use LeanBridge::Callables;

my $checks = 0;
sub check { die "Callable assertion failed: $_[1]\n" unless $_[0]; ++$checks; }
sub rejected {
  my ($call, $message) = @_;
  my $ok = eval { $call->(); 1 }; my $error = $@;
  check(!$ok && "$error" =~ $message, "expected rejection: $error");
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
sub quiet {
  my ($wrappers) = @_;
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0 && $live->{live_wrappers} == $wrappers, 'deterministic cleanup');
}
my $true = LeanBridge::Callables::true();
my $false = LeanBridge::Callables::false();
my $huge = Math::BigInt->new('9' x 1234);
my $negative = $huge->copy->bneg;
my @floats32 = map { unpack('f<', pack('L<', $_)) } (0, 2147483648, 1, 8388607, 8388608, 1065353216, 2139095039, 2139095040, 4286578688, 2143289344);
my @floats64 = map { unpack('d<', pack('Q<', $_)) } (0, 9223372036854775808, 1, 4503599627370495, 4503599627370496, 4607182418800017408, 9218868437227405311, 9218868437227405312, 18442240474082181120, 9221120237041090560);
my @cases = (
  ['unit', 'unit', [undef], [0, '', []], qr/Unit requires/],
  ['bool', 'bool', [$false, $true], [0, 1, 'true', undef], qr/Bool requires/],
  ['uint8', 'uint8', [0, 1, 255], [-1, 256, 1.5, '1'], qr/unsigned integer/],
  ['uint16', 'uint16', [0, 1, 65535], [-1, 65536, 1.5, '1'], qr/unsigned integer/],
  ['uint32', 'uint32', [0, 1, 2147483648, 4294967295], [-1, 4294967296, 1.5, '1'], qr/unsigned integer/],
  ['uint64', 'uint64', [0, 1, 4294967296, 9007199254740993, 18446744073709551615], [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/],
  ['int8', 'int8', [-128, -1, 0, 127], [-129, 128, '1'], qr/signed integer/],
  ['int16', 'int16', [-32768, -1, 0, 32767], [-32769, 32768, '1'], qr/signed integer/],
  ['int32', 'int32', [-2147483648, -1, 0, 2147483647], [-2147483649, 2147483648, '1'], qr/signed integer/],
  ['int64', 'int64', [-9223372036854775808, -9007199254740993, -1, 0, 9223372036854775807], [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/],
  ['nat', 'nat', [Math::BigInt->new(0), Math::BigInt->new(1), $huge], [0, Math::BigInt->new(-1), Math::BigInt->bnan], qr/Math::BigInt|Nat cannot|invalid decimal/],
  ['int', 'int', [$negative, Math::BigInt->new(0), $huge], [0, Math::BigInt->bnan, Math::BigInt->binf], qr/Math::BigInt|invalid decimal/],
  ['float32', 'float32', [@floats32, 1.0000000596046448], ['1', [], undef], qr/Float requires/],
  ['float64', 'float', \@floats64, ['1', [], undef], qr/Float requires/],
  ['string', 'string', ['', "\0", "A\0B", "e\x{301}\x{1f642}", "\x{10ffff}"], [1, [], undef, "\x{d800}", "\x{110000}"], qr/String requires|invalid Unicode/],
  ['bytes', 'bytes', ['', "\0\xff", pack('C*', 0 .. 255)], [1, [], undef, "\x{100}"], qr/ByteArray requires/],
  ['char', 'char', ["\0", 'A', "\x{301}", "\x{d7ff}", "\x{e000}", "\x{ffff}", "\x{1f642}", "\x{10ffff}"], ['', 'ab', "\x{d800}", "\x{110000}", 65, undef, []], qr/Char requires/],
  ['usize', 'usize', [0, 1, 4294967295, 9007199254740993, 18446744073709551615], [-1, 1.8446744073709552e19, '1'], qr/unsigned integer/],
  ['isize', 'isize', [-9223372036854775808, -9007199254740993, -1, 0, 9223372036854775807], [18446744073709551615, -9.223372036854778e18, '1'], qr/signed integer/]
);
check(LeanBridge::Callables::word_bits() == 64, 'compiled word width');
my $prefix = abs_path($ENV{PERL5LIB}) . '/';
for my $module ('LeanBridge/Callables.pm', 'LeanBridge/Runtime.pm') {
  check(index(abs_path($INC{$module}), $prefix) == 0, 'installed module');
}
my @observations;
for my $case (@cases) {
  my ($type, $suffix, $values, $bad_values, $message) = @$case;
  my ($call, $twice, $make) = map { LeanBridge::Callables->can($_ . '_' . $suffix) } ('call', 'twice', 'make');
  check($call && $twice && $make, "generated functions: $suffix");
  my $start = $checks;
  for my $index (0 .. $#$values) {
    my $value = $values->[$index]; my $other = $values->[($index + 1) % @$values];
    my ($expected, $changed) = (encode($type, $value), encode($type, $other));
    my $invocations = 0;
    my $result = $call->($value, sub { ++$invocations; check(encode($type, $_[0]) eq $expected, 'callback input'); return $other; });
    check($invocations == 1 && encode($type, $result) eq $changed, 'callback result');
    my $closure = $make->($value);
    check(encode($type, $closure->call($true, $other)) eq $expected, 'captured closure result');
    check(encode($type, $closure->call($false, $other)) eq $changed, 'closure input and result');
    check(encode($type, $call->($other, sub { $closure->call($false, $_[0]) })) eq $changed, 'callback to Lean closure re-entry');
    check(encode($type, $call->($value, sub { $call->($_[0], sub { $_[0] }) })) eq $expected, 'nested host re-entry');
    $closure->close;
    check($closure->closed, 'closed closure');
    rejected(sub { $closure->call($false, $value) }, qr/closed/);
    quiet(0);
  }
  my $value = $values->[0]; my $closure = $make->($value);
  for my $bad (@$bad_values) {
    my $calls = 0;
    rejected(sub { $twice->($value, sub { ++$calls; $bad }) }, $message);
    check($calls == 1, 'failed callback must suppress later invocations');
    rejected(sub { $closure->call($false, $bad) }, $message);
    rejected(sub { $make->($bad) }, $message);
    check(encode($type, $call->($value, sub { $_[0] })) eq encode($type, $value), 'recovery');
    quiet(1);
  }
  my $error = bless { primitive => $type }, 'CallableError';
  my $ok = eval { $call->($value, sub { die $error }); 1 }; my $caught = $@;
  check(!$ok && refaddr($caught) == refaddr($error), 'original exception object');
  check(encode($type, $closure->call($true, $value)) eq encode($type, $value), 'exception recovery');
  $closure->close; quiet(0);
  my $expect = encode($type, $values->[-1]);
  for (1 .. 100) {
    my $retained = $make->($values->[-1]);
    check(encode($type, $retained->call($true, $value)) eq $expect, 'repeated capture');
    $retained->close;
  }
  quiet(0);
  push @observations, { primitive => $type, validCases => scalar(@$values), rejectedCases => scalar(@$bad_values), checks => $checks - $start };
}
# Captured exact integers are independent of mutable Math::BigInt inputs and results.
my $mutable = $huge->copy; my $captured = LeanBridge::Callables::make_nat($mutable);
$mutable->bzero;
my $returned = $captured->call($true, Math::BigInt->bzero); $returned->bzero;
check($captured->call($true, Math::BigInt->bzero)->bstr eq $huge->bstr, 'captured integer copy');
$captured->close;
my $wrong = LeanBridge::Callables::make_char('A');
rejected(sub { LeanBridge::Callables::call_char('A', $wrong) }, qr/kind|type/);
$wrong->close; quiet(0);
# The callback's output allocation budget rejects before building an oversized Lean value.
rejected(sub { LeanBridge::Callables::call_bytes('', sub { 'a' x (16 * 1024 * 1024 + 1) }) }, qr/16 MiB/);
quiet(0);
my @keys = qw(api_revision api_version api_subversion archname byteorder ptrsize ivsize uvsize nvsize nvtype longsize useithreads usemultiplicity uselongdouble use64bitint use64bitall useperlio usequadmath quadkind);
my $abi = {map { $_ => defined($Config{$_}) ? "$Config{$_}" : '' } @keys};
$abi->{binary_options} = [sort Config::bincompat_options()];
my $json = JSON::PP->new->utf8->canonical;
print $json->encode({ schemaVersion => 1, checks => $checks, wordBits => 64, primitives => \@observations,
  hostVersion => $Config{version}, abi => $abi, abiKey => sha256_hex($json->encode($abi)) }), "\n";
