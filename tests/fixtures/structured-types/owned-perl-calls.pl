use strict;
use warnings;
use utf8;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
sub check { my ($ok, $why) = @_; die "call check " . ($checks + 1) . ": $why\n" unless $ok; ++$checks; }
sub rejected {
    my ($code, $expected) = @_;
    my $ok = eval { $code->(); 1 };
    check(!$ok && $@ =~ $expected, "expected $expected; received $@");
}
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub restored {
    my ($before) = @_;
    my $after = snapshot();
    check(join(',', @$before[0 .. 3, 6, 7]) eq join(',', @$after[0 .. 3, 6, 7]),
        'balanced owner ledger: ' . encode_json($after));
}
my $empty = snapshot();
my $ticket = LeanBridge::OwnedProbe::new_ticket(Math::BigInt->new(42), "forest 🌿\0tail");
my $bundle = LeanBridge::OwnedProbe::Bundle->new(primary => $ticket,
    spare => LeanBridge::OwnedProbe::Some->new($ticket), peers => [$ticket, $ticket], history => [$ticket],
    payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-9), bytes => "\xff\0"));
my $baseline = snapshot();
my ($escaped, $retained);
{
    my $out = LeanBridge::OwnedProbe::callback_record($bundle, sub {
        my ($value) = @_;
        check(blessed($value) eq 'LeanBridge::OwnedProbe::Bundle', 'native callback receives the nominal record');
        check(LeanBridge::OwnedProbe::serial($value->primary)->bcmp(42) == 0, 'borrowed resource is usable');
        $escaped = $value->primary;
        $retained = $value->primary->retain();
        return $value;
    });
    check($escaped->closed(), 'escaped callback borrow expires');
    rejected(sub { LeanBridge::OwnedProbe::serial($escaped) }, qr/expired|closed/);
    check(!$retained->closed(), 'explicit retention survives callback');
    check(LeanBridge::OwnedProbe::serial($out->primary)->bcmp(42) == 0, 'reply outlives borrowed arguments');
    $out->primary->close();
    check(LeanBridge::OwnedProbe::serial($out->spare->value)->bcmp(42) == 0, 'returned leaves have independent lifetimes');
}
$retained->close(); undef $retained; undef $escaped;
restored($baseline);
{
    my $calls = 0;
    my $out = LeanBridge::OwnedProbe::twice($bundle, sub { ++$calls; return $_[0] });
    check($calls == 2, 'two sequential callbacks');
    check(LeanBridge::OwnedProbe::serial($out->primary)->bcmp(42) == 0, 'second callback receives a live first reply');
}
restored($baseline);
{
    my $out = LeanBridge::OwnedProbe::callback_record($bundle, sub {
        return LeanBridge::OwnedProbe::callback_record($_[0], sub {
            return LeanBridge::OwnedProbe::echo_record($_[0]);
        });
    });
    check($out->payload->bytes eq "\xff\0", 'nested native calls and callbacks preserve the Perl return stack');
}
restored($baseline);
{
    my $closure = LeanBridge::OwnedProbe::identity_closure(undef);
    my $other = $closure->retain();
    $closure->close();
    check($closure->closed() && !$other->closed(), 'closure retain is independent');
    rejected(sub { $closure->call($bundle) }, qr/closed/);
    my $out = $other->call($bundle);
    check(LeanBridge::OwnedProbe::serial($out->primary)->bcmp(42) == 0, 'returned Lean closure invocation');
    my $forwarded = LeanBridge::OwnedProbe::callback_record($bundle, $other);
    check($forwarded->payload->count->bcmp(-9) == 0, 'Lean closure can replace a host callback');
    $other->close();
}
restored($baseline);
{
    my $closure = LeanBridge::OwnedProbe::retain_callback(sub { die "expired host callback ran\n" });
    rejected(sub { $closure->call($bundle) }, qr/closed|callback|invalid|expired/);
    $closure->close();
}
restored($baseline);
rejected(sub { LeanBridge::OwnedProbe::factory(sub { $ticket }) }, qr/recovery/);
{
    my $factory = LeanBridge::OwnedProbe::Runtime::Callback->new(code => sub {
        check(@_ == 1 && !defined($_[0]), 'Unit callback argument');
        return $ticket;
    }, recovery => $ticket);
    my $out = LeanBridge::OwnedProbe::factory($factory);
    check(LeanBridge::OwnedProbe::serial($out)->bcmp(42) == 0, 'typed factory recovery and owned resource reply');
}
restored($baseline);
{
    my $out = LeanBridge::OwnedProbe::construct($ticket,
        LeanBridge::OwnedProbe::Runtime::Callback->new(code => sub {
            check(LeanBridge::OwnedProbe::serial($_[0])->bcmp(42) == 0, 'direct resource callback argument');
            return $bundle;
        }, recovery => $bundle));
    check($out->payload->bytes eq "\xff\0", 'callback constructs an owned record');
}
restored($baseline);
{
    my $tree = LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $ticket);
    my $out = LeanBridge::OwnedProbe::callback_recursive($tree, sub { $_[0] });
    check(LeanBridge::OwnedProbe::serial($out->ticket)->bcmp(42) == 0, 'recursive callback value');
}
restored($baseline);
{
    package FalseError;
    use overload 'bool' => sub { 0 }, '""' => sub { die "exception was stringified\n" }, fallback => 1;
    package main;
    my $error = bless {}, 'FalseError';
    my $ok = eval { LeanBridge::OwnedProbe::callback_record($bundle, sub { die $error }); 1 };
    check(!$ok && refaddr($@) == refaddr($error), 'exception identity survives native cleanup without overloads');
}
restored($baseline);
rejected(sub { LeanBridge::OwnedProbe::callback_record($bundle, sub { return {} }) }, qr/record|generated|schema|Expected/);
{
    no strict 'refs';
    my @invokers = grep { /^_owned_callback_[0-9]+$/ } keys %LeanBridge::OwnedProbe::;
    check(@invokers > 0, 'native callback converters are registered');
    rejected(sub { &{'LeanBridge::OwnedProbe::' . $invokers[0]}() }, qr/active native invocation/);
}
restored($baseline);
{
    local $@ = "caller sentinel";
    my $out = LeanBridge::OwnedProbe::callback_record($bundle, sub { $_[0] });
    check($@ eq "caller sentinel", 'successful invocation restores caller exception scalar');
}
restored($baseline);

my $exercise = sub {
    my $out = LeanBridge::OwnedProbe::callback_record($bundle, sub { $_[0] });
    die "wrong callback result\n" unless $out->payload->bytes eq "\xff\0";
};
LeanBridge::OwnedProbe::reset();
$exercise->();
my $observed = snapshot();
my ($allocations, $exceptions) = @$observed[4, 5];
restored($baseline);
my ($allocator_failures, $exception_failures, $native_failures) = (0, 0, 0);
for my $index (1 .. $allocations) {
    LeanBridge::OwnedProbe::reset($index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    check(!$ok, "XS allocation failure $index");
    ++$allocator_failures; restored($baseline);
}
for my $index (1 .. $exceptions) {
    LeanBridge::OwnedProbe::reset(0, $index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    check(!$ok, "Perl exception checkpoint $index");
    ++$exception_failures; restored($baseline);
}
for my $index (0 .. 2000) {
    LeanBridge::OwnedProbe::reset(0, 0, $index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    restored($baseline);
    last if $ok;
    ++$native_failures;
    check($index < 2000, 'native fault walk completes');
}
check($allocator_failures > 0 && $exception_failures > 0 && $native_failures > 0, 'all fault domains exercised');
undef $bundle;
$ticket->close(); undef $ticket;
restored($empty);
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
check($final->[0] == 0 && $final->[1] == 0 && $final->[2] == 0, 'all Perl and native ownership released');
print encode_json({checks => $checks, live => $final->[1], identities => $final->[2],
    allocatorFailures => $allocator_failures, exceptions => $exception_failures, nativeFailures => $native_failures});
