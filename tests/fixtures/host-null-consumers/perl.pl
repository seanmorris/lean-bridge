# Independent HostNull consumer for installed, source-free CPAN archives.
use strict;
use warnings;
use Cwd qw(abs_path);
use JSON::PP;
use Scalar::Util qw(refaddr);
use LeanBridge::HostNullDemo;

my $checks = 0;
sub check ($;$) {
  ++$checks;
  die "HostNull check $checks: " . ($_[1] // '') . "\n" unless $_[0];
}
sub none { LeanBridge::HostNullDemo::None->new() }
sub some { LeanBridge::HostNullDemo::Some->new($_[0]) }
sub rejected {
  my ($call) = @_;
  my $passed = eval { $call->(); 1 }; my $error = $@;
  check(!$passed && length("$error"), "expected rejection");
  return $error;
}

check(!defined(LeanBridge::HostNullDemo::echo(undef)), 'direct null');
check(LeanBridge::HostNullDemo::echo(42) == 42, 'direct value');
check(!defined(LeanBridge::HostNullDemo::nullable_option(undef)), 'nullable Option outer null');
check(ref(LeanBridge::HostNullDemo::nullable_option(none())) eq 'LeanBridge::HostNullDemo::None', 'nullable Option none');
check(LeanBridge::HostNullDemo::nullable_option(some(42))->value == 42, 'nullable Option value');
check(ref(LeanBridge::HostNullDemo::optional_nullable(none())) eq 'LeanBridge::HostNullDemo::None', 'optional nullable none');
check(!defined(LeanBridge::HostNullDemo::optional_nullable(some(undef))->value), 'optional nullable null');
check(LeanBridge::HostNullDemo::optional_nullable(some(42))->value == 42, 'optional nullable value');
check(!defined(LeanBridge::HostNullDemo::nullable_option(undef)) &&
  ref(LeanBridge::HostNullDemo::nullable_option(none())) eq 'LeanBridge::HostNullDemo::None',
  'HostNull null differs from Option.none');
check(ref(LeanBridge::HostNullDemo::optional_nullable(none())) eq 'LeanBridge::HostNullDemo::None' &&
  !defined(LeanBridge::HostNullDemo::optional_nullable(some(undef))->value),
  'Option.none differs from Some HostNull.null');

my $packet = LeanBridge::HostNullDemo::Packet->new(
  direct => undef, nullableOption => none(), optionalNullable => some(undef));
my $echoed = LeanBridge::HostNullDemo::echo_packet($packet);
check(ref($echoed) eq 'LeanBridge::HostNullDemo::Packet', 'record type');
check(refaddr($echoed) != refaddr($packet), 'record copied');
check(!defined($echoed->direct), 'record direct field');
check(ref($echoed->nullableOption) eq 'LeanBridge::HostNullDemo::None', 'record nullable Option field');
check(!defined($echoed->optionalNullable->value), 'record optional nullable field');

my $result = LeanBridge::HostNullDemo::call_host(undef, sub {
  check(!defined($_[0]), 'callback null parameter'); return none();
});
check(ref($result) eq 'LeanBridge::HostNullDemo::None', 'callback tagged result');
$result = LeanBridge::HostNullDemo::call_host(42, sub {
  check($_[0] == 42, 'callback value parameter'); return some(43);
});
check($result->value == 43, 'callback value result');
$result = LeanBridge::HostNullDemo::call_host(0, sub {
  check($_[0] == 0, 'callback zero parameter'); return undef;
});
check(!defined($result), 'callback outer null result');
my $marker = bless({ marker => 1 }, 'HostNullMarker');
my $caught = rejected(sub { LeanBridge::HostNullDemo::call_host(undef, sub { die $marker }) });
check(ref($caught) && refaddr($caught) == refaddr($marker), 'callback exception identity');

my $closure = LeanBridge::HostNullDemo::make_closure(some(77));
check(!$closure->closed, 'open closure');
check($closure->call(undef)->value == 77, 'closure null parameter');
check($closure->call(2)->value == 77, 'closure value parameter');
my $alias = $closure;
check(refaddr($alias) == refaddr($closure), 'closure identity');
$closure->close; $closure->close;
check($closure->closed, 'idempotent closure close');
rejected(sub { $alias->call(undef) });

rejected(sub { LeanBridge::HostNullDemo::echo([]) });
rejected(sub { LeanBridge::HostNullDemo::nullable_option(some(undef)) });
rejected(sub { LeanBridge::HostNullDemo::optional_nullable(undef) });
rejected(sub { LeanBridge::HostNullDemo::echo_packet(LeanBridge::HostNullDemo::Packet->new(
  direct => [], nullableOption => none(), optionalNullable => none())) });
rejected(sub { LeanBridge::HostNullDemo::call_host(undef, []) });
rejected(sub { LeanBridge::HostNullDemo::call_host(undef, sub { [] }) });
rejected(sub { LeanBridge::HostNullDemo::make_closure(some(undef)) });

print JSON::PP->new->canonical->encode({ checks => $checks,
  api => abs_path($INC{'LeanBridge/HostNullDemo.pm'}), perl => "$^V" }) . "\n";
