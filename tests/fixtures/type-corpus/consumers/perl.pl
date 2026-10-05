# Exercise public APIs from the installed runtime and component CPAN archives.
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

sub check { die "Corpus assertion failed: $_[1]\n" unless $_[0]; }
sub json { return JSON::PP->new->utf8->canonical->encode($_[0]); }
sub decode {
  my ($value, $type, $api) = @_;
  if (exists $value->{integer}) {
    return Math::BigInt->new($value->{integer}) if !ref($type) && ($type eq 'nat' || $type eq 'int');
    return 0 + $value->{integer};
  }
  return $value->{string} if exists $value->{string};
  return $api->can($value->{bool} ? 'true' : 'false')->() if exists $value->{bool};
  return undef if exists $value->{unit};
  return pack('C*', @{$value->{bytes}}) if exists $value->{bytes};
  for my $kind ('float32', 'float64') {
    next unless exists $value->{$kind};
    my ($float, $integer, $nan) = $kind eq 'float32' ? ('f<', 'L<', '2143289344') : ('d<', 'Q<', '9221120237041090560');
    return unpack($float, pack($integer, 0 + ($value->{$kind} eq 'nan' ? $nan : $value->{$kind})));
  }
  return [map { decode($_, $type->{array}, $api) } @{$value->{array}}] if exists $value->{array};
  if (exists $value->{record}) {
    my %fields = map { $_ => decode($value->{fields}{$_}, $type->{fields}{$_}, $api) } keys %{$value->{fields}};
    return ($api . '::' . $value->{record})->new(%fields);
  }
  die "Unknown corpus wire value\n";
}
sub encode {
  my ($value, $type, $api) = @_;
  if (ref($type)) {
    if (exists $type->{array}) {
      check(ref($value) eq 'ARRAY', 'array result');
      return {array => [map { encode($_, $type->{array}, $api) } @$value]};
    }
    my ($name) = $type->{record} =~ /\.([^.]+)\z/;
    check(blessed($value) && ref($value) eq "$api\::$name", 'record result');
    check(join(',', sort keys %$value) eq join(',', sort keys %{$type->{fields}}), 'record fields');
    return {record => $name, fields => {map { $_ => encode($value->{$_}, $type->{fields}{$_}, $api) } keys %$value}};
  }
  if ($type eq 'unit') { check(!defined($value), 'unit result'); return {unit => JSON::PP::true}; }
  if ($type eq 'bool') { check(is_bool($value), 'boolean result'); return {bool => $value ? JSON::PP::true : JSON::PP::false}; }
  if ($type eq 'nat' || $type eq 'int') {
    check(blessed($value) && $value->isa('Math::BigInt'), 'exact integer result');
    return {integer => '' . $value->bstr};
  }
  check(defined($value) && !ref($value), 'scalar result');
  my $flags = svref_2object(\$value)->FLAGS;
  if ($type =~ /\A(?:u?int)(?:8|16|32|64)\z/) {
    check(($flags & SVf_IOK) && !is_bool($value), 'fixed integer result');
    return {integer => "$value"};
  }
  if ($type eq 'float32' || $type eq 'float64') {
    check($flags & SVf_NOK, 'floating result');
    my ($float, $integer) = $type eq 'float32' ? ('f<', 'L<') : ('d<', 'Q<');
    my $bits = $value != $value ? 'nan' : '' . unpack($integer, pack($float, $value));
    return {$type => $bits};
  }
  check($flags & SVf_POK, 'string result');
  if ($type eq 'bytes') {
    check(!utf8::is_utf8($value), 'byte result must not carry the Unicode flag');
    return {bytes => [unpack('C*', $value)]};
  }
  check($type eq 'string' && utf8::is_utf8($value), 'Unicode result');
  return {string => $value};
}
sub clear_arrays {
  my ($value, $type) = @_;
  return unless ref($type);
  if (exists $type->{array}) { clear_arrays($_, $type->{array}) for @$value; @$value = (); }
  else { clear_arrays($value->{$_}, $type->{fields}{$_}) for keys %{$type->{fields}}; }
}

open my $input, '<:raw', $ARGV[0] or die "Cannot read corpus request: $!\n";
my $request = JSON::PP->new->utf8->decode(do { local $/; <$input> });
my $api = $request->{module};
(my $module_file = "$api.pm") =~ s{::}{/}g;
require $module_file;
my $prefix = abs_path($ENV{PERL5LIB}) . '/';
for my $module ($module_file, 'LeanBridge/Runtime.pm') {
  check(index(abs_path($INC{$module}), $prefix) == 0, 'load from isolated installed prefix');
}
my $baseline = $request->{cases}[0];
my @results;
for my $entry (@{$request->{cases}}) {
  my $signature = $request->{signatures}{$entry->{operation}};
  my @args = map { decode($entry->{arguments}[$_], $signature->{parameters}[$_], $api) } 0 .. $#{$entry->{arguments}};
  my $call = $api->can($request->{operations}{$entry->{operation}});
  check(defined($call), 'generated public function');
  if ($entry->{expectation}{kind} eq 'host-rejection') {
    my $ok = eval { $call->(@args); 1 };
    my $error = $@;
    check(!$ok && !ref($error) && index($error, "$entry->{rejectionMessage} at ") == 0, $entry->{id} . ': ' . $error);
    my $recover = $request->{signatures}{$baseline->{operation}};
    my @recovery_args = map { decode($baseline->{arguments}[$_], $recover->{parameters}[$_], $api) } 0 .. $#{$baseline->{arguments}};
    my $result = $api->can($request->{operations}{$baseline->{operation}})->(@recovery_args);
    check(json(encode($result, $recover->{result}, $api)) eq json($request->{oracle}{$baseline->{oracleKey}}), 'recovery');
    push @results, {id => $entry->{id}, status => 'rejected-as-expected', exception => 'croak', message => $error, recovered => JSON::PP::true};
    next;
  }
  my $result = $call->(@args);
  my $observed = encode($result, $signature->{result}, $api);
  check(json($observed) eq json($request->{oracle}{$entry->{oracleKey}}), $entry->{id});
  if ($entry->{checkIndependentCopy}) {
    check(refaddr($result) != refaddr($args[0]), 'independent record');
    clear_arrays($args[0], $signature->{parameters}[0]);
    check(json(encode($result, $signature->{result}, $api)) eq json($observed), 'independent nested arrays');
  }
  push @results, {id => $entry->{id}, status => 'matched', observed => $observed, independentCopy => $entry->{checkIndependentCopy}};
}
# Read the interpreter configuration independently of the package's ABI helper.
my @keys = qw(api_revision api_version api_subversion archname byteorder ptrsize ivsize uvsize
  nvsize nvtype longsize useithreads usemultiplicity uselongdouble use64bitint use64bitall
  useperlio usequadmath quadkind);
my $abi = {map { $_ => defined($Config{$_}) ? "$Config{$_}" : '' } @keys};
$abi->{binary_options} = [sort Config::bincompat_options()];
print json({schemaVersion => 1, profile => 'perl', module => $api, hostVersion => $Config{version},
  abi => $abi, abiKey => sha256_hex(json($abi)), results => \@results}), "\n";
