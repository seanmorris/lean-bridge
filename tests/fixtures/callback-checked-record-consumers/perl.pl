use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::CallbackCheckedRecords;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub check { die "callback checked-record assertion $checks: $_[1]\n" unless $_[0]; ++$checks }
sub n { Math::BigInt->new($_[0]) }
sub interval { LeanBridge::CallbackCheckedRecords::Interval->new(lo => n($_[0]), hi => n($_[1])) }
sub weighted { LeanBridge::CallbackCheckedRecords::Weighted->new(weight => n($_[0]), limit => n($_[1])) }
sub interval_is {
	my ($value, $lo, $hi) = @_;
	return ref($value) eq 'LeanBridge::CallbackCheckedRecords::Interval'
		&& $value->lo->bstr eq "$lo" && $value->hi->bstr eq "$hi";
}
sub invoke {
	my ($name, @arguments) = @_;
	my $function = LeanBridge::CallbackCheckedRecords->can($name);
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
	LeanBridge::CallbackCheckedRecords::Runtime::Callback->new(
		code => $code, recovery => $recovery);
}

# A host reply selects mkInterval: Lean computes hi - lo of the constructed reply.
my $widen = descriptor(sub {
	++$calls; check(interval_is($_[0], 1, 3), 'proof-free host argument'); return interval(1, 4);
}, interval(1, 3));
check(invoke('call_host', $widen)->bstr eq '3', 'valid host reply');
my $before = $calls;
my $invalid_recovery = descriptor(sub { ++$calls; $_[0] }, interval(3, 1));
rejects(sub { invoke('call_host', $invalid_recovery) });
check($calls == $before, 'invalid recovery stops callback');
my $invalid_reply = descriptor(sub { ++$calls; interval(5, 2) }, interval(1, 3));
rejects(sub { invoke('call_host', $invalid_reply) });
check($calls == $before + 1, 'unordered reply calls once');
check(invoke('call_host', $widen)->bstr eq '3', 'host call recovers');

my $sentinel = bless({message => 'callback failed'}, 'CallbackCheckedRecordError');
my $caught = rejects(sub { invoke('call_host', descriptor(sub { die $sentinel }, interval(1, 3))) });
check(ref($caught) && refaddr($caught) == refaddr($sentinel), 'exception identity');

my $mixed_host = descriptor(sub {
	++$calls; check($_[0]->bstr eq '7', 'mixed marker');
	return interval($_[1]->lo, $_[1]->hi->copy->badd(2));
}, interval(1, 3));
check(invoke('call_host_mixed', $mixed_host)->bstr eq '4', 'mixed host reply');

# A leased closure constructs its interval argument before its body runs.
my $closure = invoke('make_closure', n(9));
check($closure->call(interval(2, 5))->bstr eq '3', 'closure result');
rejects(sub { $closure->call(interval(5, 2)) });
check($closure->call(interval(3, 3))->bstr eq '0', 'closure recovers');
$closure->close; $closure->close; check($closure->closed, 'closure close');

# A Lean-produced closure result crosses as the proof-free interval.
my $mixed = invoke('make_mixed_closure', n(0));
check(interval_is($mixed->call(n(9), interval(2, 5)), 2, 5), 'mixed closure result');
rejects(sub { $mixed->call(n(9), interval(5, 2)) });
check(interval_is($mixed->call(n(9), interval(3, 4)), 3, 4), 'mixed closure recovers');
$mixed->close; check($mixed->closed, 'mixed closure close');

# Checked records inside structural containers keep their direction.
my $container = invoke('call_host_container', descriptor(sub {
	++$calls; check(!defined($_[0]), 'container none argument');
	return LeanBridge::CallbackCheckedRecords::Ok->new(LeanBridge::CallbackCheckedRecords::Some->new(interval(1, 4)));
}, LeanBridge::CallbackCheckedRecords::Ok->new(undef)));
check($container->bstr eq '3', 'container host reply');
rejects(sub { invoke('call_host_container', descriptor(sub {
	++$calls; return LeanBridge::CallbackCheckedRecords::Ok->new(LeanBridge::CallbackCheckedRecords::Some->new(interval(4, 1)));
}, LeanBridge::CallbackCheckedRecords::Ok->new(undef))) });
my $container_closure = invoke('make_container_closure', n(0));
check(!defined($container_closure->call([undef, LeanBridge::CallbackCheckedRecords::Some->new(interval(2, 5))])), 'container closure result');
rejects(sub { $container_closure->call([LeanBridge::CallbackCheckedRecords::Some->new(interval(5, 2))]) });
check(!defined($container_closure->call([])), 'container closure recovers');
$container_closure->close; check($container_closure->closed, 'container closure close');

# A checked payload field runs its own constructor before the record constructor.
my ($reply_weight, $reply_limit) = (2, 5);
my $reweigh = descriptor(sub {
	++$calls; check($_[0]->weight->bstr eq '1' && $_[0]->limit->bstr eq '2', 'proof-free weighted argument');
	return weighted($reply_weight, $reply_limit);
}, weighted(1, 2));
check(invoke('call_host_nested', $reweigh)->bstr eq '3', 'nested host reply');
$before = $calls;
$reply_weight = 0;
rejects(sub { invoke('call_host_nested', $reweigh) });
check($calls == $before + 1, 'zero weight calls once');
$reply_weight = 6;
rejects(sub { invoke('call_host_nested', $reweigh) });
check($calls == $before + 2, 'weight above limit calls once');
rejects(sub { invoke('call_host_nested', descriptor(sub { ++$calls; $_[0] }, weighted(0, 2))) });
check($calls == $before + 2, 'invalid weighted recovery stops callback');
$reply_weight = 2;
check(invoke('call_host_nested', $reweigh)->bstr eq '3', 'nested host recovers');

my $nested = invoke('make_nested_closure', n(0));
check($nested->call(weighted(2, 5))->bstr eq '3', 'nested closure result');
rejects(sub { $nested->call(weighted(0, 5)) });
rejects(sub { $nested->call(weighted(6, 5)) });
check($nested->call(weighted(5, 5))->bstr eq '0', 'nested closure recovers');
$nested->close; check($nested->closed, 'nested closure close');

print JSON::PP->new->canonical->encode({
	schemaVersion => 1, checks => $checks, calls => $calls, rejected => $rejected
}), "\n";
