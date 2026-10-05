use strict;
use warnings;
use Config;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
my @held_errors;
my @attempts;
my %sweeps;
my $empty;
sub check { die 'callback fault check ' . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks }
sub invoke { my ($name, @args) = @_; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args) }
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub counters { my $value = snapshot(); return [@$value[0..3,6,7]] }
sub balanced {
    my ($label, $expected) = @_; $expected //= $empty;
    check(join(',', @{counters()}) eq join(',', @$expected), "$label balanced: " . encode_json(snapshot()));
}
sub close_all { $_->close for grep { blessed($_) && $_->can('closed') } @_ }
sub serial { invoke('serial', $_[0])->bstr }
sub record_is { check(serial($_[0]->get->primary) eq '63', $_[1]) }
sub bundle {
    my ($ticket) = @_;
    return LeanBridge::OwnedProbe::Bundle->new(primary => $ticket,
        spare => LeanBridge::OwnedProbe::Some->new($ticket), peers => [$ticket], history => [],
        payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-17), bytes => "\0\xff\3"));
}

# Keep every caught exception live until after shutdown. Each attempt owns fresh,
# independent fixtures; only the receiver's original owner is transferred.
sub attempt {
    my ($kind, $domain, $index) = @_;
    my $seed = invoke('new_ticket', Math::BigInt->new(63), 'callback-faults');
    my $raw = bundle($seed->get);
    my $receiver = invoke('echo_record', $raw);
    my $alias = $receiver->share;
    my $view = $receiver->borrow_record;
    my $retained = $receiver->retain;
    my $independent = $kind eq 'raw' ? undef : invoke('echo_record', $raw);
    my @calls = (0, 0);
    my $left = sub { ++$calls[0]; return $_[0] };
    my $right = sub { ++$calls[1]; return $_[0] };
    my $whole = sub { ++$calls[0]; return $independent };
    my $descriptor = $kind eq 'whole-recovery'
        ? LeanBridge::OwnedProbe::Runtime::Callback->new(code => $right, recovery => $independent) : undef;
    my $before = LeanBridge::OwnedProbe::handoffs();
    my ($out, $error);
    LeanBridge::OwnedProbe::reset($domain eq 'allocator' ? $index : 0,
        $domain eq 'exception' ? $index : 0, $domain eq 'native' ? $index : -1);
    my $ok = eval {
        $out = $kind eq 'whole-reply' ? $receiver->move_record($whole)
            : $receiver->move_twice($left, $kind eq 'whole-recovery' ? $descriptor : $right);
        1;
    };
    $error = $@;
    my $injected_snapshot = snapshot();
    # Native failure injection is sticky: disable it before assertions, native
    # observation calls, or explicit cleanup. reset does not clear cleanupStatus.
    LeanBridge::OwnedProbe::reset();
    my $after = LeanBridge::OwnedProbe::handoffs();
    my $delta = $after - $before;
    check($delta == 0 || $delta == 1, "$kind/$domain/$index at most one native handoff");
    check($calls[0] <= 1 && $calls[1] <= $calls[0] && ($kind ne 'whole-reply' || $calls[1] == 0),
        "$kind/$domain/$index callbacks run at most once and in order");
    my @closed = map { $_->closed ? 1 : 0 } ($receiver, $alias, $view);
    check(join(',', @closed) eq ($delta ? '1,1,1' : '0,0,0'), "$kind/$domain/$index aliases match handoff");
    if (!$delta) {
        record_is($_, "$kind/$domain/$index pre-handoff owner usable") for ($receiver, $alias, $view);
        check($calls[0] == 0 && $calls[1] == 0, 'pre-handoff failure did not invoke callbacks');
    }
    record_is($retained, "$kind/$domain/$index independent retain survives");
    record_is($independent, "$kind/$domain/$index independent reply/recovery survives") if defined $independent;
    if ($ok) {
        check($delta == 1 && defined($out) && !$out->closed, 'successful output follows handoff');
        check(join(',', @calls) eq ($kind eq 'whole-reply' ? '1,0' : '1,1'), 'all nominal callbacks executed');
        record_is($out, 'successful result preserves meaning');
        check(!ref($error) && $error eq '', 'success has no callback error');
        check($index > $injected_snapshot->[4], 'allocator sweep success exhausted actual allocation sites') if $domain eq 'allocator';
        check($index > $injected_snapshot->[5], 'exception sweep success exhausted actual checkpoints') if $domain eq 'exception';
    } else {
        check(!defined($out), 'failed call publishes no result');
        check($domain ne 'none', "uninjected baseline failed: $error");
        check($domain eq 'exception' ? $error =~ /injected Perl ownership exception/
            : $error =~ /allocation failed|status=3/, "intended $domain fault: $error");
        push @held_errors, $error;
    }
    my $observed = { kind => $kind, domain => $domain, index => $index, ok => $ok ? 1 : 0,
        handoffBefore => $before, handoffAfter => $after, handoffDelta => $delta,
        closed => \@closed, calls => [@calls], error => "$error",
        injectionSnapshot => $injected_snapshot,
        retainedSerial => 0 + serial($retained->get->primary),
        independentSerial => defined($independent) ? 0 + serial($independent->get->primary) : undef };
    close_all($seed, $receiver, $alias, $view, $retained, $independent, $out);
    return $observed;
}

$empty = counters();
check(join(',', @$empty) eq '0,1,1,0,0,0', 'only the initial native runtime session is live');
for my $kind ('raw', 'whole-reply', 'whole-recovery') {
    my $baseline = attempt($kind, 'none', 0);
    balanced("$kind baseline"); $baseline->{cleanup} = counters(); push @attempts, $baseline;
    for my $domain ('allocator', 'exception', 'native') {
        my $summary = $sweeps{$kind}{$domain} = {before => 0, after => 0, attempts => 0, replyEnteredFailures => 0};
        my $done = 0;
        for my $index (($domain eq 'native' ? 0 : 1)..4000) {
            my $observed = attempt($kind, $domain, $index);
            balanced("$kind/$domain/$index"); $observed->{cleanup} = counters(); push @attempts, $observed;
            ++$summary->{attempts};
            if ($observed->{ok}) { $summary->{firstSuccess} = $index; $done = 1; last }
            ++$summary->{$observed->{handoffDelta} ? 'after' : 'before'};
            ++$summary->{replyEnteredFailures} if $observed->{calls}[$kind eq 'whole-reply' ? 0 : 1];
        }
        check($done, "$kind/$domain bounded sweep completed");
        check($summary->{before} > 0 && $summary->{after} > 0, "$kind/$domain failures straddle handoff");
        check($summary->{replyEnteredFailures} > 0, "$kind/$domain includes failed calls whose reply callback ran");
        # A fresh successful call after the sweep proves failure state was reset.
        my $restored = attempt($kind, 'none', 0);
        balanced("$kind restored after $domain"); $restored->{cleanup} = counters(); $restored->{restoredAfter} = $domain;
        push @attempts, $restored;
    }
}

my $exception_observation;
{
    my $seed = invoke('new_ticket', Math::BigInt->new(63), 'callback-error');
    my $raw = bundle($seed->get);
    my $receiver = invoke('echo_record', $raw);
    my $alias = $receiver->share;
    my $view = $receiver->borrow_record;
    my $retained = $receiver->retain;
    my $recovery = invoke('echo_record', $raw);
    my $expected = bless {message => 'intentional callback exception'}, 'CallbackFaultException';
    my @calls = (0, 0);
    my $descriptor = LeanBridge::OwnedProbe::Runtime::Callback->new(
        code => sub { ++$calls[0]; die $expected }, recovery => $recovery);
    my $before = LeanBridge::OwnedProbe::handoffs();
    my $out;
    my $ok = eval { $out = $receiver->move_twice($descriptor, sub { ++$calls[1]; $_[0] }); 1 };
    my $error = $@;
    LeanBridge::OwnedProbe::reset();
    check(!$ok && ref($error) && refaddr($error) == refaddr($expected), 'original exception object propagated');
    check(!defined($out), 'callback exception publishes no result');
    check(join(',', @calls) eq '1,0', 'sticky callback error suppresses second callback');
    check(LeanBridge::OwnedProbe::handoffs() - $before == 1, 'callback exception occurs after handoff');
    check($receiver->closed && $alias->closed && $view->closed, 'exception consumed all receiver aliases');
    record_is($retained, 'retain survives intentional exception');
    record_is($recovery, 'whole recovery survives intentional exception');
    push @held_errors, $error;
    $exception_observation = { expectedClass => ref($expected), actualClass => ref($error),
        expectedAddress => refaddr($expected), actualAddress => refaddr($error),
        calls => [@calls], handoffBefore => $before, handoffAfter => LeanBridge::OwnedProbe::handoffs(),
        retainedSerial => 0 + serial($retained->get->primary), recoverySerial => 0 + serial($recovery->get->primary) };
    close_all($seed, $receiver, $alias, $view, $retained, $recovery, $out);
}
balanced('exception kept live'); $exception_observation->{cleanup} = counters();
my $restored = attempt('whole-recovery', 'none', 0);
balanced('restored after intentional exception'); $restored->{cleanup} = counters();
$restored->{restoredAfter} = 'intentional-exception'; push @attempts, $restored;
LeanBridge::OwnedProbe::Runtime::shutdown();
balanced('final shutdown with errors kept live', [(0) x 6]);
print JSON::PP->new->canonical->encode({ actualLean => JSON::PP::true, installedPackage => JSON::PP::false,
    checks => $checks, sweeps => \%sweeps, attempts => \@attempts, exception => $exception_observation,
    heldErrors => scalar(@held_errors), baseline => $empty, final => counters(), perlVersion => "$^V",
    threaded => $Config{useithreads} ? 1 : 0 });
