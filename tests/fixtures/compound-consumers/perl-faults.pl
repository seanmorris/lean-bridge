# Separate process, isolated test XS. Installed package files stay unchanged.
use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr weaken);
use DynaLoader;
use XSLoader;
my $original_loader = \&XSLoader::load;
{
  no warnings 'redefine';
  local *XSLoader::load = sub {
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Compounds';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Compounds') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Compounds::bootstrap', $symbol, $ARGV[0]);
    $boot->(@_);
  };
  require LeanBridge::Compounds;
}
sub check { die "Compound cleanup assertion\n" unless $_[0]; }
sub some { LeanBridge::Compounds::Some->new($_[0]) }
sub ok { LeanBridge::Compounds::Ok->new($_[0]) }
sub err { LeanBridge::Compounds::Err->new($_[0]) }
sub quiet {
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0 && $live->{live_wrappers} == 0);
}
sub faults {
  my ($call) = @_;
  LeanBridge::Compounds::_compound_probe(0); $call->();
  my $count = LeanBridge::Compounds::_compound_probe(0); quiet(); check($count > 0);
  for my $target (1 .. $count) {
    LeanBridge::Compounds::_compound_probe($target);
    my $passed = eval { $call->(); 1 }; my $error = $@;
    LeanBridge::Compounds::_compound_probe(0);
    check(!$passed && "$error" =~ /injected compound conversion failure/); quiet();
    check(LeanBridge::Compounds::classify(some(some(undef))) == 2);
  }
  return $count;
}
my $huge = Math::BigInt->new('9' x 1234);
my $packet = LeanBridge::Compounds::Packet->new(choice => some(ok([$huge, undef])), products => [[42, "copied\0\x{3bb}"], [LeanBridge::Compounds::true(), "\x{1f33f}"]],
  rows => [some(err(["\0\xff", $huge->copy->bneg])), some(ok(['row', 1]))], nested => ok(some(err('nested'))));
my $count = faults(sub { LeanBridge::Compounds::transform($packet) }) + faults(sub { LeanBridge::Compounds::duplicate(some("\0\xff")) })
  + faults(sub { LeanBridge::Compounds::option_nat(some($huge)) }) + faults(sub { LeanBridge::Compounds::result_string(ok('success')) })
  + faults(sub { LeanBridge::Compounds::result_string(err('error')) }) + faults(sub { LeanBridge::Compounds::tuple_string(['left', 'right']) });
for (1 .. 16) {
  my $input = LeanBridge::Compounds::Packet->new(%$packet, rows => undef);
  my $weak = $input; weaken($weak);
  my $passed = eval { LeanBridge::Compounds::transform($input); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /Array requires/); quiet();
  undef $input; check(!defined($weak));
}
# Host code can throw partway through either direction without losing its error.
my $error_object = bless {}, 'ConversionError';
my $host_failures = 0;
for my $method ('bstr', 'new') {
  no strict 'refs'; no warnings 'redefine';
  my $original = Math::BigInt->can($method);
  for my $target (1, 2) {
    my $seen = 0;
    local *{"Math::BigInt::$method"} = sub { die $error_object if ++$seen == $target; $original->(@_) };
    my $passed = eval { LeanBridge::Compounds::tuple_nat([$huge, $huge]); 1 }; my $error = $@;
    check(!$passed && refaddr($error) == refaddr($error_object)); quiet(); ++$host_failures;
  }
}
# Pinning the second product slot keeps it alive if the first callback clears the array.
{
  no warnings 'redefine';
  my ($pair, $original) = ([$huge, Math::BigInt->new(42)], Math::BigInt->can('bstr'));
  local *Math::BigInt::bstr = sub { @$pair = (); $original->(@_) };
  my $out = LeanBridge::Compounds::tuple_nat($pair);
  check($out->[0]->bcmp(42) == 0 && $out->[1]->bcmp($huge) == 0); quiet();
}
print JSON::PP->new->canonical->encode({ checks => $count + 16 + $host_failures + 1, conversion_checkpoints => $count, partial_inputs => 16, host_exceptions => $host_failures, reentrant_products => 1 }) . "\n";
