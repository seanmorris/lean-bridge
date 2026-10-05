# Independent public consumer. The installer prepends perl-values.pl unchanged.
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
use Scalar::Util qw(blessed refaddr);
use LeanBridge::Structured;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub check ($;$) {
  confess("Structured assertion #$checks: " . ($_[1] // '')) unless $_[0];
  ++$checks;
}
my %fields = (Some => ['value'], Ok => ['value'], Err => ['value'],
  Payload => [qw(text rows count nested)], 'Packet::Empty' => [],
  'Packet::Payload' => [qw(label rows)], 'Packet::Counts' => [qw(positive negative)]);
sub same {
  my ($actual, $expected, $independent) = @_;
  check(ref($actual) eq ref($expected), 'exact public type');
  if (!defined($expected)) { check(!defined($actual), 'absent or Unit'); return; }
  if (ref($expected)) {
    check(refaddr($actual) != refaddr($expected), 'independent storage') if $independent;
    if (blessed($expected) && $expected->isa('Math::BigInt')) {
      check($actual->bstr eq $expected->bstr, 'exact large integer'); return;
    }
    if (ref($expected) eq 'ARRAY') {
      check(@$actual == @$expected, 'array size');
      same($actual->[$_], $expected->[$_], $independent) for 0 .. $#$expected;
      return;
    }
    my $name = ref($expected); $name =~ s/\ALeanBridge::Structured:://;
    check(exists $fields{$name}, 'independent constructor catalog');
    check(join(',', sort keys %$actual) eq join(',', sort @{$fields{$name}}), 'exact fields');
    same($actual->{$_}, $expected->{$_}, $independent) for @{$fields{$name}};
    return;
  }
  check(defined($actual) && !is_bool($actual), 'non-boolean scalar');
  my $actual_flags = svref_2object(\$actual)->FLAGS;
  my $expected_flags = svref_2object(\$expected)->FLAGS;
  if ($expected_flags & SVf_IOK) { check($actual_flags & SVf_IOK, 'integer scalar'); }
  else { check($actual_flags & SVf_POK, 'string scalar'); }
  check($actual eq $expected, 'scalar value');
}
sub poison {
  my ($value) = @_;
  return unless ref($value);
  if (blessed($value) && $value->isa('Math::BigInt')) { $value->bzero; }
  elsif (ref($value) eq 'ARRAY') { @$value = (); }
  else { $value->{$_} = 'changed after copying' for keys %$value; }
}
sub quiet {
  my ($wrappers) = @_;
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0
    && $live->{live_wrappers} == $wrappers, 'deterministic cleanup');
  check($live->{live_identities} == $wrappers, 'native identity cleanup');
  check($live->{runtime_init_runs} == 1, 'single shared runtime');
}
sub reject {
  my ($invoke, $pattern) = @_;
  my $passed = eval { $invoke->(); 1 }; my $error = $@;
  check(!$passed && "$error" =~ $pattern, "expected rejection: $error"); ++$rejected;
}
sub exported {
  my ($name) = @_;
  my $function = LeanBridge::Structured->can($name);
  check($function, "public export $name");
  return sub { ++$calls; return $function->(@_); };
}
sub invalid_values {
  my ($shape) = @_;
  return ({}, [1], [bless({value => 'text'}, 'WrongSome')]) if $shape eq 'array';
  return ({}, [[]], [structured_ok(['42', 'text'])]) if $shape eq 'list';
  return (0, structured_some(0), structured_some(structured_some(1))) if $shape eq 'option';
  return (undef, structured_ok(structured_some(-1)), structured_err([1])) if $shape eq 'result';
  return ([], ['text', []], ['text', ["\x{100}", structured_huge(0)]]) if $shape eq 'tuple';
  if ($shape eq 'record' || $shape eq 'alias') {
    my $negative = structured_record(1); $negative->{count} = Math::BigInt->new(-1);
    my $unicode = structured_record(1); $unicode->{text} = "\x{d800}";
    return ({}, $negative, $unicode);
  }
  return (undef, bless({}, 'LeanBridge::Structured::Packet'),
    structured_ctor('Packet::Payload', label => 'text', rows => [1]));
}
sub oversized_value {
  my ($shape) = @_;
  my $text = 'x' x (16 * 1024 * 1024);
  return [structured_some($text)] if $shape eq 'array';
  return [structured_err($text)] if $shape eq 'list';
  return structured_err([$text]) if $shape eq 'result';
  return [$text, ['', structured_huge(0)]] if $shape eq 'tuple';
  return structured_ctor('Packet::Payload', label => $text, rows => [])
    if $shape eq 'variant';
  my $record = structured_record(0); $record->{text} = $text;
  return $record;
}
my $true = LeanBridge::Structured::true();
my $false = LeanBridge::Structured::false();
my $prefix = abs_path($ENV{PERL5LIB}) . '/';
for my $module ('LeanBridge/Structured.pm', 'LeanBridge/Runtime.pm') {
  check(index(abs_path($INC{$module}), $prefix) == 0, 'installed module');
}
my @observations;
for my $shape (qw(array list option result tuple record variant alias)) {
  my ($call, $twice, $make) = map { exported($_ . '_' . $shape) } qw(call twice make);
  my ($start, $start_calls, $start_rejections) = ($checks, $calls, $rejected);
  for my $seed (0 .. 23) {
    my $value = structured_value($shape, $seed);
    my $other = structured_value($shape, $seed + 1);
    my $third = structured_value($shape, $seed + 2);
    my ($invoked, $retained) = (0, undef);
    my $result = $call->($value, sub {
      ++$invoked; same($_[0], $value, 1); $retained = $_[0]; return $other;
    });
    check($invoked == 1, 'single callback'); same($result, $other, 1);
    same($retained, $value, 1); poison($retained);
    same($value, structured_value($shape, $seed));
    my $step = 0;
    same($twice->($value, sub {
      same($_[0], $step ? $other : $value, 1);
      return ++$step == 1 ? $other : $third;
    }), $third, 1);
    check($step == 2, 'repeated callback');
    my $held = $make->($value); quiet(1);
    poison($value);
    same($held->call($true, $other), structured_value($shape, $seed), 1);
    same($held->call($false, $other), $other, 1);
    my $copy = $held->call($true, $other); poison($copy);
    same($held->call($true, $other), structured_value($shape, $seed), 1);
    same($call->($other, sub { $held->call($false, $_[0]) }), $other, 1);
    same($call->($other, sub { $call->($_[0], sub { $_[0] }) }), $other, 1);
    my $error = bless({shape => $shape, seed => $seed}, 'StructuredError');
    my $failed_calls = 0;
    my $passed = eval { $twice->($other, sub { ++$failed_calls; die $error }); 1 };
    my $caught = $@;
    check(!$passed && refaddr($caught) == refaddr($error), 'original exception object');
    check($failed_calls == 1, 'suppress callbacks after error');
    same($call->($other, sub { $_[0] }), $other, 1); quiet(1);
    $held->close; $held->close;
    check($held->closed, 'idempotent close');
    reject(sub { $held->call($false, $other) }, qr/closed/); quiet(0);
  }
  my ($value, $held) = (structured_value($shape, 5), $make->(structured_value($shape, 6)));
  for my $bad (invalid_values($shape)) {
    my $entered = 0;
    reject(sub { $call->($bad, sub { ++$entered; return $value }) }, qr/./s);
    check($entered == 0, 'invalid input rejected before callback');
    reject(sub { $twice->($value, sub { ++$entered; return $bad }) }, qr/./s);
    check($entered == 1, 'bad callback result suppresses later call');
    reject(sub { $make->($bad) }, qr/./s);
    reject(sub { $held->call($false, $bad) }, qr/./s);
    same($call->($value, sub { $_[0] }), $value, 1); quiet(1);
  }
  reject(sub { $call->($value, []) }, qr/\Ainvalid or foreign Lean resource object\b/);
  if ($shape ne 'option') {
    my $large = oversized_value($shape);
    my $entered = 0;
    reject(sub { $call->($large, sub { ++$entered; return $value }) }, qr/16 MiB/);
    check($entered == 0, 'budget failure before callback');
    reject(sub { $twice->($value, sub { ++$entered; return $large }) }, qr/16 MiB/);
    check($entered == 1, 'callback budget failure suppresses later invocation');
    reject(sub { $make->($large) }, qr/16 MiB/);
    reject(sub { $held->call($false, $large) }, qr/16 MiB/);
    same($call->($value, sub { $_[0] }), $value, 1); quiet(1);
  }
  $held->close; quiet(0);
  {
    my $automatic = $make->($value); quiet(1);
    same($automatic->call($true, $value), $value, 1);
  }
  quiet(0);
  push @observations, {shape => $shape, checks => $checks - $start,
    calls => $calls - $start_calls, rejected => $rejected - $start_rejections};
}
my $retained_calls = 0;
my $expired = exported('retain_record')->(sub { ++$retained_calls; return $_[0]; });
reject(sub { $expired->call(structured_record(1)) }, qr/expired|retaining/);
check($retained_calls == 0, 'expired callback never executes');
$expired->close; quiet(0);
my $marker = bless({}, 'StructuredError');
my $passed = eval { exported('after_failure')->(structured_record(1), sub { die $marker }); 1 };
my $caught = $@;
check(!$passed && refaddr($caught) == refaddr($marker), 'valid fallback preserves original failure');
quiet(0);
my %libraries;
open my $maps, '<', '/proc/self/maps' or die $!;
while (<$maps>) {
  my ($path) = /\s(\/\S+\.so)$/;
  next unless $path && index($path, $prefix) == 0;
  open my $file, '<:raw', $path or die $!;
  local $/;
  $libraries{substr($path, length($prefix))} = sha256_hex(<$file>);
}
close $maps;
my @keys = qw(api_revision api_version api_subversion archname byteorder ptrsize ivsize uvsize nvsize nvtype longsize useithreads usemultiplicity uselongdouble use64bitint use64bitall useperlio usequadmath quadkind);
my $abi = {map { $_ => defined($Config{$_}) ? "$Config{$_}" : '' } @keys};
$abi->{binary_options} = [sort Config::bincompat_options()];
my $json = JSON::PP->new->utf8->canonical;
print $json->encode({schemaVersion => 1, checks => $checks, calls => $calls,
  rejected => $rejected, shapes => \@observations, hostVersion => $Config{version},
  wordBits => 8 * $Config{ptrsize},
  api => abs_path($INC{'LeanBridge/Structured.pm'}), nativeLibraries => \%libraries,
  abi => $abi, abiKey => sha256_hex($json->encode($abi))}), "\n";
