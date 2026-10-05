# Separate process with isolated instrumented XS, never edits installed files.
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
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Aliases';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Aliases') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Aliases::bootstrap', $symbol, $ARGV[0]);
    $boot->(@_);
  };
  require LeanBridge::Aliases;
}
my $context = 'initialization';
sub check ($;$) { confess("Alias cleanup assertion ($context): " . ($_[1] // '')) unless $_[0]; }
sub some { LeanBridge::Aliases::Some->new($_[0]) }
sub ok { LeanBridge::Aliases::Ok->new($_[0]) }
sub err { LeanBridge::Aliases::Err->new($_[0]) }
sub quiet {
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0 && $live->{live_wrappers} == 0, JSON::PP->new->encode($live));
}
sub recovered { check(LeanBridge::Aliases::make() == 41); quiet(); }
sub faults {
  my ($call) = @_;
  LeanBridge::Aliases::_alias_probe(0); $call->();
  my $count = LeanBridge::Aliases::_alias_probe(0); quiet(); check($count > 0);
  for my $target (1 .. $count) {
    $context = "conversion checkpoint $target of $count";
    LeanBridge::Aliases::_alias_probe($target);
    my $passed = eval { $call->(); 1 }; my $error = $@;
    LeanBridge::Aliases::_alias_probe(0);
    check(!$passed && "$error" =~ /injected alias conversion failure/, "passed=" . ($passed // '') . " error=$error"); quiet(); recovered();
  }
  return $count;
}
my $huge = Math::BigInt->bone->blsft(5120)->badd(19);
my $packet = LeanBridge::Aliases::Packet->new(count => 9, text => "a\0\x{1f331}",
  rows => [[1, 2, 3], [], [4]], maybe => some(some(undef)), outcome => ok([7, "\0\xff"]));
my $scalars = LeanBridge::Aliases::Scalars->new(v_unit => undef, v_bool => LeanBridge::Aliases::true(),
  v_uint8 => 255, v_uint16 => 65535, v_uint32 => 4294967295, v_uint64 => 18446744073709551615,
  v_int8 => -128, v_int16 => -32768, v_int32 => -2147483648, v_int64 => -9223372036854775808,
  v_nat => $huge, v_int => $huge->copy->bneg, v_float32 => 1.5, v_float64 => -2.25,
  v_string => "A\0\x{1f331}", v_bytes => "\0\xff\1", v_char => "\x{1f331}", v_usize => 4294967295, v_isize => -2147483648);
my $count = faults(sub { LeanBridge::Aliases::change_packet($packet) })
  + faults(sub { LeanBridge::Aliases::reverse_packets([$packet, $packet]) })
  + faults(sub { LeanBridge::Aliases::duplicate("\0\xff") })
  + faults(sub { LeanBridge::Aliases::echo_scalars($scalars) })
  + faults(sub { LeanBridge::Aliases::echo_nat($huge) })
  + faults(sub { LeanBridge::Aliases::echo_int($huge->copy->bneg) })
  + faults(sub { LeanBridge::Aliases::echo_maybe(some(some(undef))) })
  + faults(sub { LeanBridge::Aliases::echo_outcome(err("bad\0")) })
  + faults(sub { LeanBridge::Aliases::reverse_rows([[1, 2, 3], [], [4]]) });
my $partial_inputs = 0;
for (1 .. 32) {
  $context = "partial record input $_";
  my $bad = LeanBridge::Aliases::Packet->new(%$packet, outcome => ok([7, []]));
  my $weak = $bad; weaken($weak);
  my $passed = eval { LeanBridge::Aliases::change_packet($bad); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /ByteArray requires|scalar value/); quiet();
  undef $bad; check(!defined($weak)); recovered(); ++$partial_inputs;
}
for (1 .. 32) {
  $context = "partial List input $_";
  my $bad = [$packet, undef]; my $weak = $bad; weaken($weak);
  my $passed = eval { LeanBridge::Aliases::reverse_packets($bad); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /expected LeanBridge::Aliases::Packet/); quiet();
  undef $bad; check(!defined($weak)); recovered(); ++$partial_inputs;
}
my $error_object = bless {}, 'ConversionError';
my $host_failures = 0;
for my $method ('bstr', 'new') {
  no strict 'refs'; no warnings 'redefine';
  my $original = Math::BigInt->can($method);
  for my $target (1, 2) {
    $context = "$method exception $target";
    my $seen = 0;
    local *{"Math::BigInt::$method"} = sub { die $error_object if ++$seen == $target; $original->(@_) };
    my $passed = eval { LeanBridge::Aliases::echo_scalars($scalars); 1 }; my $error = $@;
    check(!$passed && refaddr($error) == refaddr($error_object)); quiet(); ++$host_failures;
  }
}
recovered();
print JSON::PP->new->canonical->encode({ checks => $count + $partial_inputs + $host_failures,
  conversion_checkpoints => $count, partial_inputs => $partial_inputs, host_exceptions => $host_failures }) . "\n";
