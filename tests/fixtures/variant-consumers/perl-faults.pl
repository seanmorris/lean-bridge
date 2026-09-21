# Separate process with isolated instrumented XS. Installed files stay unchanged.
use strict;
use warnings;
use Carp qw(confess);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr weaken);
use DynaLoader;
use XSLoader;
my $original_loader = \&XSLoader::load;
{
  no warnings 'redefine';
  local *XSLoader::load = sub {
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Variants';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Variants') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Variants::bootstrap', $symbol, $ARGV[0]); $boot->(@_);
  };
  require LeanBridge::Variants;
}
my $families = JSON::PP->new->decode($ARGV[1]);
my $context = 'initialization';
sub check ($;$) { confess("Variant cleanup assertion ($context): " . ($_[1] // '')) unless $_[0]; }
sub ctor { my ($name, @args) = @_; return "LeanBridge::Variants::$name"->new(@args); }
sub some { LeanBridge::Variants::Some->new($_[0]) }
sub ok { LeanBridge::Variants::Ok->new($_[0]) }
sub err { LeanBridge::Variants::Err->new($_[0]) }
sub quiet {
  my $expected_scopes = $_[0] // 0;
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == $expected_scopes && $live->{live_callbacks} == 0 && $live->{live_wrappers} == 0, JSON::PP->new->encode($live));
}
sub recovered { check(ref(LeanBridge::Variants::next(ctor('Signal::Idle'))) eq 'LeanBridge::Variants::Signal::Stopped'); quiet($_[0] // 0); }
sub faults {
  my ($invoke) = @_; LeanBridge::Variants::_variant_probe(0); $invoke->();
  my $count = LeanBridge::Variants::_variant_probe(0); quiet(); check($count > 0);
  for my $target (1 .. $count) {
    $context = "conversion checkpoint $target of $count";
    LeanBridge::Variants::_variant_probe($target);
    my $passed = eval { $invoke->(); 1 }; my $error = $@; my $state = LeanBridge::Variants::_variant_probe_state();
    LeanBridge::Variants::_variant_probe(0);
    check(!$passed && "$error" =~ /injected variant conversion failure/, "passed=" . ($passed // '') . " error=$error");
    check($state->[0] <= 1, 'at most one public native entry'); quiet(); recovered();
  }
  return $count;
}
my %scalars = (unit => undef, bool => LeanBridge::Variants::true(), u8 => 255, u16 => 65535,
  u32 => 4294967295, u64 => 18446744073709551615, i8 => -128, i16 => -32768, i32 => -2147483648, i64 => -9223372036854775808,
  natural => Math::BigInt->bone->blsft(5120)->badd(19), integer => Math::BigInt->bone->blsft(5120)->badd(31)->bneg,
  f32 => 1.5, f64 => -2.25, text => "A\0\x{1f331}", bytes => "\0\xff\1", char => "\x{1f331}", word => 4294967295, signedWord => -2147483648);
my $scalar = ctor('Scalars::All', %scalars);
my $data = ctor('Signal::Data', count => 42, label => "A\0\x{1f331}");
my $packet = ctor('Packet', current => $data, events => [ctor('Signal::Idle'), $data], fallback => some(ctor('Signal::Marker', value => undef)), modes => [ctor('Mode::First'), ctor('Mode::Third')]);
my @constructors = (
  ['Signal::Idle', sub { LeanBridge::Variants::echo(ctor('Signal::Idle')) }],
  ['Signal::Stopped', sub { LeanBridge::Variants::echo(ctor('Signal::Stopped')) }],
  ['Signal::Data', sub { LeanBridge::Variants::echo($data) }],
  ['Signal::Marker', sub { LeanBridge::Variants::echo(ctor('Signal::Marker', value => undef)) }],
  ['Mode::First', sub { LeanBridge::Variants::echo_mode(ctor('Mode::First')) }],
  ['Mode::Second', sub { LeanBridge::Variants::echo_mode(ctor('Mode::Second')) }],
  ['Mode::Third', sub { LeanBridge::Variants::echo_mode(ctor('Mode::Third')) }],
  ['Nested::Empty', sub { LeanBridge::Variants::echo_nested(ctor('Nested::Empty')) }],
  ['Nested::Packet', sub { LeanBridge::Variants::echo_nested(ctor('Nested::Packet', value => $packet)) }],
  ['Nested::Outcome', sub { LeanBridge::Variants::echo_nested(ctor('Nested::Outcome', value => ok([ctor('Signal::Marker', value => undef), ctor('Mode::Second')]))) }],
  ['Scalars::Absent', sub { LeanBridge::Variants::echo_scalars(ctor('Scalars::Absent')) }],
  ['Scalars::All', sub { LeanBridge::Variants::echo_scalars($scalar) }],
  ['Anonymous::Number', sub { LeanBridge::Variants::echo_anonymous(ctor('Anonymous::Number', arg0 => 7)) }],
  ['Anonymous::Pair', sub { LeanBridge::Variants::echo_anonymous(ctor('Anonymous::Pair', arg0 => 7, arg1 => "A\0\x{1f331}")) }],
  ['Anonymous::Collision', sub { LeanBridge::Variants::echo_anonymous(ctor('Anonymous::Collision', arg1 => 19, arg1_ => "A\0\x{1f331}")) }],
  ['One::Only', sub { LeanBridge::Variants::echo_one(ctor('One::Only', value => 7)) }],
  ['Buffers::Empty', sub { LeanBridge::Variants::echo_buffers(ctor('Buffers::Empty')) }],
  ['Buffers::Pair', sub { LeanBridge::Variants::echo_buffers(ctor('Buffers::Pair', first => "\0\xff", second => 'abc')) }]
);
my $count = 0; $count += faults($_->[1]) for @constructors;
$count += faults(sub { LeanBridge::Variants::next($data) })
  + faults(sub { LeanBridge::Variants::echo_nested(ctor('Nested::Outcome', value => err("bad\0"))) })
  + faults(sub { LeanBridge::Variants::signals([[ctor('Signal::Idle'), $data], [], [$data]]) })
  + faults(sub { LeanBridge::Variants::duplicate("\0\xff") });
my $partial_inputs = 0;
for (1 .. 32) {
  $context = "partial constructor input $_";
  my $bad = ctor('Buffers::Pair', first => "\0\xff", second => []); my $weak = $bad; weaken($weak);
  LeanBridge::Variants::_variant_probe(0);
  my $passed = eval { LeanBridge::Variants::echo_buffers($bad); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /ByteArray requires|scalar value/);
  check(LeanBridge::Variants::_variant_probe_state()->[0] == 0); quiet();
  undef $bad; check(!defined($weak)); recovered(); ++$partial_inputs;
}
for (1 .. 32) {
  $context = "partial List input $_";
  my $bad = [[$data, undef]]; my $weak = $bad; weaken($weak);
  LeanBridge::Variants::_variant_probe(0);
  my $passed = eval { LeanBridge::Variants::signals($bad); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /exact.*constructor/);
  check(LeanBridge::Variants::_variant_probe_state()->[0] == 0); quiet();
  undef $bad; check(!defined($weak)); recovered(); ++$partial_inputs;
}
my $error_object = bless {}, 'ConversionError'; my $host_failures = 0;
for my $method ('bstr', 'new') {
  no strict 'refs'; no warnings 'redefine'; my $original = Math::BigInt->can($method);
  for my $target (1, 2) {
    $context = "$method exception $target"; my $seen = 0;
    local *{"Math::BigInt::$method"} = sub { die $error_object if ++$seen == $target; $original->(@_) };
    my $passed = eval { LeanBridge::Variants::echo_scalars($scalar); 1 }; my $error = $@;
    check(!$passed && refaddr($error) == refaddr($error_object)); quiet(); ++$host_failures;
  }
}
my %tag_calls = (
  Signal => sub { LeanBridge::Variants::echo($data) }, Mode => sub { LeanBridge::Variants::echo_mode(ctor('Mode::First')) },
  Nested => sub { LeanBridge::Variants::echo_nested(ctor('Nested::Empty')) }, Scalars => sub { LeanBridge::Variants::echo_scalars(ctor('Scalars::Absent')) },
  Anonymous => sub { LeanBridge::Variants::echo_anonymous(ctor('Anonymous::Number', arg0 => 7)) },
  One => sub { LeanBridge::Variants::echo_one(ctor('One::Only', value => 7)) }, Buffers => sub { LeanBridge::Variants::echo_buffers(ctor('Buffers::Empty')) }
);
my $malformed_tags = 0;
for my $family (@$families) {
  $context = "invalid native tag for $family->{name}";
  LeanBridge::Variants::_variant_probe(0); LeanBridge::Variants::_variant_tag_probe($family->{index});
  my $passed = eval { $tag_calls{$family->{name}}->(); 1 }; my $error = $@;
  my $getters = LeanBridge::Variants::_variant_tag_probe(0);
  check(!$passed && "$error" =~ /Invalid native .* constructor/); check($getters == 0, 'invalid tag rejected before any accessor');
  check(LeanBridge::Variants::_variant_probe_state()->[0] == 1); quiet(); recovered(); ++$malformed_tags;
}
my $reentrant_fields = 0;
for my $mode ('delete', 'rebless') {
  $context = "$mode during BigInt conversion"; my $value = ctor('Scalars::All', %scalars); my $seen = 0;
  my $original = Math::BigInt->can('bstr'); my $result;
  {
    no warnings 'redefine';
    local *Math::BigInt::bstr = sub {
      if (++$seen == 1) { %$value = (); bless $value, 'MovedConstructor' if $mode eq 'rebless'; recovered(1); }
      $original->(@_);
    };
    $result = LeanBridge::Variants::echo_scalars($value);
  }
  check(ref($result) eq 'LeanBridge::Variants::Scalars::All'); check(LeanBridge::Variants::inspect($result));
  check($result->integer->bstr eq $scalars{integer}->bstr && $result->text eq $scalars{text}); quiet(); ++$reentrant_fields;
}
{
  package TiedCounter;
  sub TIESCALAR { bless {invoke => $_[1]}, $_[0] }
  sub FETCH { $_[0]->{invoke}->(); 42 }
  package main;
}
{
  $context = 'delete a pending field during tied scalar conversion';
  my $value = ctor('Signal::Data', count => 0, label => 'pinned'); my $seen = 0;
  tie $value->{count}, 'TiedCounter', sub { if (++$seen == 1) { delete $value->{label}; recovered(1); } };
  my $result = LeanBridge::Variants::echo($value);
  check($result->count == 42 && $result->label eq 'pinned'); untie $value->{count}; quiet(); ++$reentrant_fields;
}
recovered(); my $state = LeanBridge::Variants::_variant_probe_state();
check($state->[1] > 500 && $state->[2] == 0, 'every accessed payload belongs to the active constructor');
print JSON::PP->new->canonical->encode({ checks => $count + $partial_inputs + $host_failures + $malformed_tags + $reentrant_fields,
  constructor_probes => [map { $_->[0] } @constructors],
  conversion_checkpoints => $count, partial_inputs => $partial_inputs, host_exceptions => $host_failures,
  malformed_tags => $malformed_tags, reentrant_fields => $reentrant_fields, active_accessor_checks => $state->[1], wrong_accessors => $state->[2] }) . "\n";
