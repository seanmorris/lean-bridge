use strict;
use warnings;
use JSON::PP;
use Config;
use Scalar::Util qw(refaddr);
use POSIX ();
use Storable ();
use LeanBridge::OwnedProbe;

my $checks = 0;
my ($perl_failures, $native_failures, $exceptions) = (0, 0, 0);
sub check {
    my ($condition, $message) = @_;
    die "check " . ($checks + 1) . ": $message\n" unless $condition;
    ++$checks;
}
sub rejected {
    my ($code, $message) = @_;
    my $success = eval { $code->(); 1 };
    check(!$success && $@ =~ $message, "expected $message, received $@");
}
sub snap { [LeanBridge::OwnedProbe::snapshot()] }
sub ledger {
    my ($baseline, $message) = @_;
    my $actual = snap();
    check(join(',', @$actual[0 .. 3, 6, 7]) eq join(',', @$baseline[0 .. 3, 6, 7]), $message . ': actual ' . encode_json($actual) . ', expected ' . encode_json($baseline));
}

my $mode = shift // 'main';
my $empty = snap();
check($empty->[0] == 0 && $empty->[2] == 1 && $empty->[3] == 0, 'only the native session is live: ' . encode_json($empty));
my $ticket = LeanBridge::OwnedProbe::new_ticket(731);
check(LeanBridge::OwnedProbe::serial($ticket) == 731, 'real Lean result');

if ($mode eq 'serialization') {
    {
        package SerializationControl;
        sub STORABLE_freeze { die "control cannot be serialized\n" }
    }
    my $control = bless {}, 'SerializationControl';
    my ($control_before, $ticket_before) = (Internals::SvREFCNT(%$control), Internals::SvREFCNT(%$ticket));
    rejected(sub { Storable::nfreeze($control) }, qr/cannot be serialized/);
    rejected(sub { Storable::nfreeze($ticket) }, qr/cannot be serialized/);
    # Storable retains a reference when either hook throws. Compare a plain
    # object, then require native cleanup despite that third-party reference.
    my $retained = Internals::SvREFCNT(%$ticket) - $ticket_before;
    check($retained == Internals::SvREFCNT(%$control) - $control_before, 'serialization hook matches plain Perl reference behavior');
    check(LeanBridge::OwnedProbe::serial($ticket) == 731, 'serialization rejection does not consume resource');
    LeanBridge::OwnedProbe::close($ticket);
    LeanBridge::OwnedProbe::shutdown();
    my $final = snap();
    check(!(grep { $_ != 0 } @$final[1 .. 3, 6, 7]), 'close and shutdown release native owners despite Storable reference');
    # Instrumented DSO destructors also require zero host allocations at exit.
    print encode_json({ checks => $checks, mode => $mode, storableRetainedReferences => $retained,
        nativeLive => $final->[1], identities => $final->[2] }), "\n";
    exit;
}

if ($mode eq 'exit') {
    our $left_at_exit = [$ticket, LeanBridge::OwnedProbe::retain($ticket)];
    # Deliberately leave live identities for the registered interpreter exit hook.
    print encode_json({ checks => $checks, leftForShutdown => scalar @$left_at_exit }), "\n";
    exit;
}
if ($mode eq 'shutdown' || $mode eq 'reentrant-shutdown') {
    my $copy = LeanBridge::OwnedProbe::retain($ticket);
    if ($mode eq 'reentrant-shutdown') {
        check(LeanBridge::OwnedProbe::serial($ticket, sub {
            LeanBridge::OwnedProbe::shutdown();
            rejected(sub { LeanBridge::OwnedProbe::new_ticket(2) }, qr/session is closed/);
        }) == 731, 'shutdown waits for active native input');
    } else {
        LeanBridge::OwnedProbe::shutdown();
    }
    check(LeanBridge::OwnedProbe::closed($ticket) && LeanBridge::OwnedProbe::closed($copy), 'shutdown revokes retained aliases');
    rejected(sub { LeanBridge::OwnedProbe::serial($ticket) }, qr/session is closed/);
    LeanBridge::OwnedProbe::shutdown();
    undef $copy; undef $ticket;
    my $final = snap();
    check(!(grep { $_ != 0 } @$final[0 .. 3, 6, 7]), 'shutdown leaves no native or Perl owners');
    print encode_json({ checks => $checks, mode => $mode, live => $final->[0], identities => $final->[2] }), "\n";
    exit;
}

my $copy = LeanBridge::OwnedProbe::retain($ticket);
check(refaddr($ticket) != refaddr($copy), 'retain creates an independent wrapper');
LeanBridge::OwnedProbe::close($ticket);
LeanBridge::OwnedProbe::close($ticket);
check(LeanBridge::OwnedProbe::closed($ticket), 'close is idempotent');
rejected(sub { LeanBridge::OwnedProbe::serial($ticket) }, qr/closed/);
check(LeanBridge::OwnedProbe::serial($copy) == 731, 'retained identity survives original close');
undef $ticket;
my $baseline = snap();
check($baseline->[0] == 2 && $baseline->[3] == 1, 'one retained wrapper and owner: ' . encode_json($baseline));

my $borrow = LeanBridge::OwnedProbe::with_borrow($copy, sub {
    check(LeanBridge::OwnedProbe::serial($_[0]) == 731, 'scoped borrow is usable');
    $_[0];
});
check(LeanBridge::OwnedProbe::closed($borrow), 'escaped callback-scope wrapper expires');
rejected(sub { LeanBridge::OwnedProbe::serial($borrow) }, qr/expired/);
rejected(sub { LeanBridge::OwnedProbe::retain($borrow) }, qr/expired/);
undef $borrow;
ledger($baseline, 'expired borrow cleanup');
my $retained = LeanBridge::OwnedProbe::with_borrow($copy, sub { LeanBridge::OwnedProbe::retain($_[0]) });
check(LeanBridge::OwnedProbe::serial($retained) == 731, 'explicit retain survives borrow scope');
undef $retained;
ledger($baseline, 'retained borrow cleanup');

rejected(sub { LeanBridge::OwnedProbe::new_ticket(18, 1) }, qr/partial output/);
check(LeanBridge::OwnedProbe::closed($LeanBridge::OwnedProbe::leaked), 'partially published output is revoked');
rejected(sub { LeanBridge::OwnedProbe::serial($LeanBridge::OwnedProbe::leaked) }, qr/closed/);
undef $LeanBridge::OwnedProbe::leaked;
ledger($baseline, 'partial output releases native result');

my $exception = bless {}, 'ProbeException';
my $caught;
eval { LeanBridge::OwnedProbe::serial($copy, sub { die $exception }); 1 } or $caught = $@;
check(refaddr($caught) == refaddr($exception), 'exact Perl exception object survives reentry');
ledger($baseline, 'exception unwinds input pin');
my $closing = LeanBridge::OwnedProbe::retain($copy);
check(LeanBridge::OwnedProbe::serial($closing, sub { LeanBridge::OwnedProbe::close($closing) }) == 731, 'in-flight pin survives explicit close');
check(LeanBridge::OwnedProbe::closed($closing), 'reentrant close remains visible');
undef $closing;
ledger($baseline, 'reentrant close releases pin');
my $recurse;
$recurse = sub { LeanBridge::OwnedProbe::serial($copy, $recurse) };
rejected(sub { $recurse->() }, qr/reentry limit/);
undef $recurse;
ledger($baseline, 'reentry overflow unwinds every call and pin');

rejected(sub { LeanBridge::OwnedProbe::serial(bless {}, 'LeanBridge::OwnedProbe::Ticket') }, qr/Invalid or foreign/);
bless $copy, 'WrongIdentity';
rejected(sub { LeanBridge::OwnedProbe::serial($copy) }, qr/Wrong Lean identity type/);
bless $copy, 'LeanBridge::OwnedProbe::Ticket';
check(LeanBridge::OwnedProbe::serial($copy) == 731, 'foreign-type attempt leaves original usable');
ledger($baseline, 'invalid identity paths do not leak');

for my $action (
    sub { LeanBridge::OwnedProbe::new_ticket(852) },
    sub { LeanBridge::OwnedProbe::retain($copy) },
    sub { LeanBridge::OwnedProbe::serial($copy) },
    sub { LeanBridge::OwnedProbe::with_borrow($copy, sub { LeanBridge::OwnedProbe::retain($_[0]) }) },
) {
    LeanBridge::OwnedProbe::reset();
    { my $value = $action->(); }
    my $steps = snap();
    for my $index (1 .. $steps->[4]) {
        LeanBridge::OwnedProbe::reset($index);
        rejected(sub { my $value = $action->() }, qr/allocation failed/);
        ++$perl_failures;
        LeanBridge::OwnedProbe::reset();
        ledger($baseline, 'injected XS allocator failure');
    }
    for my $index (1 .. $steps->[5]) {
        LeanBridge::OwnedProbe::reset(0, $index);
        rejected(sub { my $value = $action->() }, qr/injected Perl ownership exception/);
        ++$exceptions;
        LeanBridge::OwnedProbe::reset();
        ledger($baseline, 'injected Perl exception');
    }
    my $completed = 0;
    for my $index (0 .. 255) {
        LeanBridge::OwnedProbe::reset(0, 0, $index);
        my $ok = eval { my $value = $action->(); 1 };
        my $error = $@;
        LeanBridge::OwnedProbe::reset();
        ledger($baseline, 'injected public C allocator failure');
        if ($ok) { $completed = 1; last; }
        check($error =~ /allocation failed/, "native allocator reports its error: $error");
        ++$native_failures;
    }
    check($completed, 'fault walk reaches successful operation');
}

my $pid = fork();
die "fork failed: $!" unless defined $pid;
if (!$pid) {
    my $ok = eval { LeanBridge::OwnedProbe::serial($copy); 1 };
    my $correct = !$ok && $@ =~ /initiating process/;
    undef $copy;
    POSIX::_exit($correct ? 0 : 1);
}
waitpid($pid, 0);
check($? == 0, 'fork child rejects identity without native cleanup');
check(LeanBridge::OwnedProbe::serial($copy) == 731, 'fork leaves parent identity usable');
if ($Config{useithreads}) {
    require threads;
    my $thread = threads->create(sub {
        my $ok = eval { LeanBridge::OwnedProbe::new_ticket(93); 1 };
        return !$ok && $@ =~ /initiating process and Perl interpreter thread/ ? 1 : 0;
    });
    check($thread->join(), 'cloned interpreter cannot enter ownership runtime');
    check(LeanBridge::OwnedProbe::serial($copy) == 731, 'thread clone leaves owner usable');
}
ledger($baseline, 'foreign execution leaves ledgers unchanged');
LeanBridge::OwnedProbe::close($copy);
undef $copy;
ledger($empty, 'all wrappers released');
LeanBridge::OwnedProbe::shutdown();
my $final = snap();
check(!(grep { $_ != 0 } @$final[0 .. 3, 6, 7]), 'final shutdown releases native session');
print encode_json({
    checks => $checks, perlFailures => $perl_failures, nativeFailures => $native_failures,
    exceptions => $exceptions, live => $final->[0], identities => $final->[2],
    perl => $^V . '', threaded => $Config{useithreads} ? 1 : 0
}), "\n";
