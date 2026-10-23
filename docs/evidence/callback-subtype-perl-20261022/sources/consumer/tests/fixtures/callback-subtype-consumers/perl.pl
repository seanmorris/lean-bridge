use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::CallbackSubtypes;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub check { die "callback Subtype assertion $checks: $_[1]\n" unless $_[0]; ++$checks }
sub n { Math::BigInt->new($_[0]) }
sub invoke {
	my ($name, @arguments) = @_;
	my $function = LeanBridge::CallbackSubtypes->can($name);
	check($function, "public export $name");
	return $function->(@arguments);
}
sub rejects {
	my ($run) = @_;
	my $passed = eval { $run->(); 1 }; my $error = $@;
	check(!$passed && length("$error"), "expected rejection"); ++$rejected;
	return $error;
}
sub descriptor {
	my ($code, $recovery) = @_;
	LeanBridge::CallbackSubtypes::Runtime::Callback->new(
		code => $code, recovery => $recovery);
}

my $increment = descriptor(sub { ++$calls; $_[0]->copy->badd(1) }, n(1));
check(invoke('call_host', $increment)->bstr eq '2', 'valid host result');
my $before = $calls;
my $invalid_recovery = descriptor(sub { ++$calls; $_[0] }, n(0));
rejects(sub { invoke('call_host', $invalid_recovery) });
check($calls == $before, 'invalid recovery stops callback');
my $invalid_result = descriptor(sub { ++$calls; n(0) }, n(1));
rejects(sub { invoke('call_host', $invalid_result) });
check($calls == $before + 1, 'invalid result calls once');
check(invoke('call_host', $increment)->bstr eq '2', 'host call recovers');

my $sentinel = bless({message => 'callback failed'}, 'CallbackSubtypeError');
my $caught = rejects(sub { invoke('call_host', descriptor(sub { die $sentinel }, n(1))) });
check(ref($caught) && refaddr($caught) == refaddr($sentinel), 'exception identity');

my $mixed_host = descriptor(sub {
	++$calls; check($_[0]->bstr eq '7', 'mixed marker'); return $_[1]->copy->badd(2);
}, n(1));
check(invoke('call_host_mixed', $mixed_host)->bstr eq '3', 'mixed host result');

my $closure = invoke('make_closure', n(9));
check($closure->call(n(2))->bstr eq '2', 'closure result');
rejects(sub { $closure->call(n(0)) });
check($closure->call(n(3))->bstr eq '3', 'closure recovers');
$closure->close; $closure->close; check($closure->closed, 'closure close');

my $mixed = invoke('make_mixed_closure', n(0));
check($mixed->call(n(9), n(2))->bstr eq '2', 'mixed closure result');
rejects(sub { $mixed->call(n(9), n(0)) });
check($mixed->call(n(9), n(3))->bstr eq '3', 'mixed closure recovers');
$mixed->close; check($mixed->closed, 'mixed closure close');

my $some_two = LeanBridge::CallbackSubtypes::Some->new(n(2));
my $some_one = LeanBridge::CallbackSubtypes::Some->new(n(1));
my $nested = invoke('call_host_container', descriptor(sub {
	++$calls; check(!defined($_[0]), 'nested none input');
	return LeanBridge::CallbackSubtypes::Ok->new($some_two);
}, LeanBridge::CallbackSubtypes::Ok->new($some_one)));
check(ref($nested) eq 'LeanBridge::CallbackSubtypes::Ok'
	&& ref($nested->value) eq 'LeanBridge::CallbackSubtypes::Some'
	&& $nested->value->value->bstr eq '2', 'nested host result');

my $container = invoke('make_container_closure', n(0));
check(!defined($container->call([undef])), 'nested closure result');
rejects(sub { $container->call([LeanBridge::CallbackSubtypes::Some->new(n(0))]) });
check(!defined($container->call([])), 'nested closure recovers');
$container->close; check($container->closed, 'nested closure close');

print JSON::PP->new->canonical->encode({
	schemaVersion => 1, checks => $checks, calls => $calls, rejected => $rejected
}), "\n";
