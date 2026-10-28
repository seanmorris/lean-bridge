use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::ReviewedCallbacks;

my ($checks, $calls, $rejected) = (0, 0, 0);
sub check { die "callback Fin assertion $checks: $_[1]\n" unless $_[0]; ++$checks }
sub n { Math::BigInt->new($_[0]) }
sub invoke {
	my ($name, @arguments) = @_;
	my $function = LeanBridge::ReviewedCallbacks->can($name);
	check($function, "public export $name");
	return $function->(@arguments);
}
sub rejects {
	my ($run) = @_;
	my $passed = eval { $run->(); 1 }; my $error = $@;
	check(!$passed && length("$error"), 'expected rejection'); ++$rejected;
	return $error;
}
sub descriptor {
	my ($code, $recovery) = @_;
	LeanBridge::ReviewedCallbacks::Runtime::Callback->new(
		code => $code, recovery => $recovery);
}

my $scaler = invoke('scaler', n(3));
check($scaler->call(n(4))->bstr eq '12', 'bounded closure argument');
rejects(sub { $scaler->call(n(10)) });
check($scaler->call(n(9))->bstr eq '27', 'closure remains usable');

my $counter = invoke('counter', n(8));
check($counter->call(n(4))->bstr eq '2', 'Lean-produced Fin result');

my $host = descriptor(sub {
	++$calls;
	die 'Lean supplied an invalid Fin' unless $_[0] >= n(0) && $_[0] < n(5);
	return $_[0];
}, n(0));
check(invoke('visit', $host)->bstr eq '10', 'checked host callback arguments');
check($calls == 5, 'host receives every Fin 5 value');
my $before = $calls;
rejects(sub { invoke('visit', sub { ++$calls; $_[0] }) });
check($calls == $before, 'missing recovery stops callback entry');
my $sentinel = bless({ message => 'callback Fin sentinel' }, 'CallbackFinError');
my $caught = rejects(sub {
	invoke('visit', descriptor(sub { die $sentinel }, n(0)));
});
check(ref($caught) && refaddr($caught) == refaddr($sentinel), 'exception identity');
check(invoke('apply', sub { $_[0]->copy->badd(1) }, n(2))->bstr eq '3',
	'unrefined callback stays direct');

my $digits = invoke('digits', undef);
check($digits->call([n(1), n(2)])->bstr eq '5', 'nested Fin callback argument');
rejects(sub { $digits->call([n(3)]) });
check($digits->call([])->bstr eq '0', 'nested closure remains usable');

my $tiles = invoke('tiles', undef);
my $tile = LeanBridge::ReviewedCallbacks::Tile->new(digit => n(4), count => n(2));
check($tiles->call([$tile])->bstr eq '402', 'nominal Fin callback field');
rejects(sub {
	$tiles->call([LeanBridge::ReviewedCallbacks::Tile->new(
		digit => n(5), count => n(2))]);
});

my $tile_maker = invoke('tile_maker', n(3));
my $made = $tile_maker->call(n(4));
check(ref($made) eq 'LeanBridge::ReviewedCallbacks::Tile'
	&& $made->digit->bstr eq '2' && $made->count->bstr eq '4',
	'Lean-produced nominal Fin field');

for my $closure ($scaler, $counter, $digits, $tiles, $tile_maker) {
	$closure->close; $closure->close;
	check($closure->closed, 'closure closes idempotently');
}

print JSON::PP->new->canonical->encode({
	schemaVersion => 1, checks => $checks, calls => $calls, rejected => $rejected
}), "\n";
