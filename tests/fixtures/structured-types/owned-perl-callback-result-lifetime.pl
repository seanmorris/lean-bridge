use strict;
use warnings;
use Config;
use JSON::PP;
use Math::BigInt;
use POSIX ();
use Scalar::Util qw(blessed);
use LeanBridge::OwnedProbe;

my $variant = shift // die "expected lifetime variant\n";
die "unknown lifetime variant\n" unless $variant =~ /^(?:process-reentry|reentrant-shutdown)$/;
my $checks = 0;
my @errors;
my %events;
my $json = JSON::PP->new->canonical;
sub check { die 'callback lifetime check ' . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks }
sub invoke { my ($name, @args) = @_; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args) }
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub counters { my $value = snapshot(); return [@$value[0..3,6,7]] }
sub balanced {
    my ($expected, $label) = @_;
    check(join(',', @{counters()}) eq join(',', @$expected), "$label balanced: " . encode_json(snapshot()));
}
sub rejected {
    my ($label, $code, $pattern) = @_;
    my $ok = eval { $code->(); 1 }; my $error = $@;
    check(!$ok && $error =~ $pattern, "$label expected $pattern, got $error");
    push @errors, {label => $label, error => "$error"};
    return "$error";
}
sub close_all { $_->close for grep { blessed($_) && $_->can('closed') } @_ }
sub serial { invoke('serial', $_[0])->bstr }
sub record_is { check(serial($_[0]->get->primary) eq '63', $_[1]) }
sub seed { invoke('new_ticket', Math::BigInt->new(63), 'callback-lifetime') }
sub bundle {
    my ($ticket) = @_;
    return LeanBridge::OwnedProbe::Bundle->new(primary => $ticket,
        spare => LeanBridge::OwnedProbe::Some->new($ticket), peers => [$ticket], history => [],
        payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-17), bytes => "\0\xff\3"));
}
sub foreign_attempts {
    my ($actions) = @_;
    my @observed;
    for my $action (@$actions) {
        my $ok = eval { $action->[1]->(); 1 }; my $error = $@;
        push @observed, {name => $action->[0], ok => $ok ? 1 : 0, error => "$error"};
    }
    return \@observed;
}
sub foreign_is_rejected {
    my ($observed, $label) = @_;
    check(@$observed == 6, "$label tried all public callback entries");
    check(!$_->{ok} && $_->{error} =~ /initiating process and Perl interpreter thread/,
        "$label $_->{name} rejects at context guard: $_->{error}") for @$observed;
}
{
    package CallbackLifetimeMagic;
    sub TIESCALAR { bless {fetch => $_[1]}, $_[0] }
    sub FETCH { $_[0]->{fetch}->() }
    package main;
}

my $empty = counters();
check(join(',', @$empty) eq '0,1,1,0,0,0', 'only native runtime session is initially live');
if ($variant eq 'process-reentry') {
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $native_owner = invoke('make_record_callback', $raw); my $closure = $native_owner->get;
        my $argument = $closure->copy_arg0($raw); my $borrowed = $closure->call($argument);
        my $receiver = invoke('echo_record', $raw);
        # Saved public XS methods still reach the context guard after CLONE_SKIP
        # strips native wrappers in an ithread; method dispatch alone would not.
        my ($copy_arg, $copy_result, $call, $get, $move) =
            ($closure->can('copy_arg0'), $closure->can('copy_result'), $closure->can('call'),
             $borrowed->can('get'), $receiver->can('move_record'));
        my ($escaped, $host);
        $host = invoke('callback_record', $raw, sub {
            my ($incoming) = @_; $escaped = $incoming->primary;
            my $actions = [
                ['copy_arg0', sub { $copy_arg->($closure, $incoming) }],
                ['copy_result', sub { $copy_result->($closure, $incoming) }],
                ['native_call', sub { $call->($closure, $argument) }],
                ['borrowed_get', sub { $get->($borrowed) }],
                ['consuming_receiver', sub { $move->($receiver, sub { $_[0] }) }],
                ['host_callback', sub { invoke('callback_record', $incoming, sub { $_[0] }) }]
            ];
            my $before = counters();
            pipe(my $reader, my $writer) or die "pipe failed: $!";
            my $pid = fork(); die "fork failed: $!" unless defined $pid;
            if (!$pid) {
                close $reader;
                print {$writer} $json->encode(foreign_attempts($actions));
                close $writer;
                POSIX::_exit(0); # Never drain the parent's inherited native state.
            }
            close $writer;
            my $stdout = do { local $/; <$reader> }; close $reader;
            waitpid($pid, 0); my $status = $?;
            check($status == 0, 'fork child exited normally');
            my $observed = decode_json($stdout); foreign_is_rejected($observed, 'fork');
            balanced($before, 'parent after fork');
            check(serial($incoming->primary) eq '63', 'creator callback input survives fork');
            record_is($borrowed, 'creator native callback result survives fork');
            $events{fork} = {pid => $pid, waitStatus => $status, stdout => $stdout, observed => $observed,
                before => $before, after => counters(), creatorSerial => 0 + serial($incoming->primary)};
            if ($Config{useithreads}) {
                require threads;
                my $worker = threads->create(sub { $json->encode(foreign_attempts($actions)) });
                my $returned = $worker->join;
                my $thread_observed = decode_json($returned); foreign_is_rejected($thread_observed, 'ithread');
                balanced($before, 'creator after ithread');
                check(serial($incoming->primary) eq '63', 'creator callback input survives cloned interpreter');
                record_is($borrowed, 'creator native callback result survives cloned interpreter');
                $events{thread} = {returned => $returned, observed => $thread_observed,
                    before => $before, after => counters(), creatorSerial => 0 + serial($incoming->primary)};
            } else { $events{thread} = {skipped => 'Perl was built without ithreads'} }
            return $incoming;
        });
        check($escaped->closed, 'creator callback borrow expires after returning');
        record_is($host, 'creator host call completes after foreign-context rejection');
        my $copy = $closure->copy_result($raw); record_is($copy, 'creator callback factory still works');
        my $before = LeanBridge::OwnedProbe::handoffs();
        my $moved = $receiver->move_record(sub { $_[0] });
        check(LeanBridge::OwnedProbe::handoffs() == $before + 1 && $receiver->closed,
            'only creator later consumes receiver');
        record_is($moved, 'creator consuming callback still works');
        $events{creator} = {handoffBefore => $before, handoffAfter => LeanBridge::OwnedProbe::handoffs(),
            resultSerial => 0 + serial($moved->get->primary)};
        close_all($seed, $native_owner, $closure, $argument, $borrowed, $receiver, $escaped, $host, $copy, $moved);
    }
    balanced($empty, 'foreign-context scopes');
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $native_owner = invoke('make_record_callback', $raw); my $closure = $native_owner->get;
        my $receiver = invoke('echo_record', $raw); my $alias = $receiver->share;
        my @escaped; my @kept; my @calls = (0, 0, 0, 0);
        my $before = LeanBridge::OwnedProbe::handoffs();
        my $out = $receiver->move_twice(sub {
            ++$calls[0]; my ($incoming) = @_; push @escaped, $incoming->primary;
            check($receiver->closed && $alias->closed, 'outer receiver consumed before nested callback');
            my $inner = invoke('callback_record', $incoming, sub {
                ++$calls[1]; push @escaped, $_[0]->primary; return $_[0];
            });
            check($escaped[-1]->closed, 'inner raw callback borrow expires before outer returns');
            my $native = $closure->call($inner); my $retained = $native->retain;
            $inner->close;
            check($native->closed, 'nested native result tracks its own original argument');
            record_is($retained, 'nested native retain survives its anchor');
            close_all($inner, $native); push @kept, $retained; return $retained;
        }, sub {
            ++$calls[2]; my ($incoming) = @_; push @escaped, $incoming->primary;
            return invoke('callback_record', $incoming, sub {
                ++$calls[3]; push @escaped, $_[0]->primary;
                return $closure->copy_result($_[0]);
            });
        });
        check(join(',', @calls) eq '1,1,1,1', 'nested raw and whole callbacks each execute once');
        check(!(grep { !$_->closed } @escaped), 'all escaped nested callback borrows expire');
        check(LeanBridge::OwnedProbe::handoffs() == $before + 1, 'nested calls do not duplicate outer handoff');
        record_is($out, 'nested raw and whole callback results survive');
        record_is($kept[0], 'explicit nested retain survives outer scope');
        $events{reentry} = {calls => [@calls], escapedClosed => [map { $_->closed ? 1 : 0 } @escaped],
            handoffBefore => $before, handoffAfter => LeanBridge::OwnedProbe::handoffs(),
            outputSerial => 0 + serial($out->get->primary), retainedSerial => 0 + serial($kept[0]->get->primary)};
        close_all($seed, $native_owner, $closure, $receiver, $alias, $out, @escaped, @kept);
    }
    balanced($empty, 'nested callback scopes');
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $original = invoke('echo_record', $raw); my $alias = $original->share;
        my $view = $original->borrow_record; my $retained = $original->retain;
        my $input = $original->get;
        my $out = invoke('callback_record', $input, sub {
            my $before = counters(); $original->close; $alias->close; my $after = counters();
            check($original->closed && $alias->closed && $view->closed, 'close invalidates original aliases during reentry');
            check($before->[1] == $after->[1] && $before->[2] == $after->[2], 'active input pins defer native release');
            check(serial($_[0]->primary) eq '63', 'active callback borrow remains usable after explicit close');
            $events{inputPin} = {before => $before, after => $after, callbackSerial => 0 + serial($_[0]->primary)};
            return $_[0];
        });
        record_is($out, 'active input pin permits safe independent result copy');
        record_is($retained, 'independent retain survives reentrant close');
        rejected('closed original after reentry', sub { serial($input->primary) }, qr/status=4|closed|expired/);
        close_all($seed, $original, $alias, $view, $retained, $out);
    }
    balanced($empty, 'active original input pin');
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $reply = invoke('echo_record', $raw); my $payload = $reply->get->payload;
        my $bytes = $payload->bytes; my $fetches = 0;
        tie $payload->{bytes}, 'CallbackLifetimeMagic', sub {
            ++$fetches; my $before = counters(); $reply->close; my $after = counters();
            check($reply->closed, 'whole callback reply is explicitly closed during conversion');
            check($before->[1] == $after->[1] && $before->[2] == $after->[2], 'active whole reply pins defer native release');
            $events{replyPin} = {before => $before, after => $after}; return $bytes;
        };
        my $out = invoke('callback_record', $raw, sub { $reply });
        untie $payload->{bytes};
        check($fetches == 1, "whole reply tied byte scalar fetched exactly once: $fetches");
        record_is($out, 'whole callback reply copy survives reentrant owner close');
        $events{replyPin}{fetches} = $fetches; $events{replyPin}{outputSerial} = 0 + serial($out->get->primary);
        close_all($seed, $reply, $out);
    }
    balanced($empty, 'active whole callback reply pin');
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $native_owner = invoke('make_record_callback', $raw); my $closure = $native_owner->get;
        my $argument = $closure->copy_arg0($raw); my $borrowed = $closure->call($argument);
        my $receiver = invoke('echo_record', $raw);
        LeanBridge::OwnedProbe::Runtime::shutdown();
        check($closure->closed && $argument->closed && $borrowed->closed && $receiver->closed, 'retirement revokes callback and original owners');
        rejected('retired copy_arg0', sub { $closure->copy_arg0($raw) }, qr/session is closed/);
        rejected('retired copy_result', sub { $closure->copy_result($raw) }, qr/session is closed/);
        rejected('retired native call', sub { $closure->call($argument) }, qr/session is closed/);
        rejected('retired consuming receiver', sub { $receiver->move_record(sub { $_[0] }) }, qr/session is closed/);
        rejected('retired borrowed result get', sub { $borrowed->get }, qr/status=4/);
        $events{retirement} = {after => counters()};
        check($events{retirement}{after}[1] == 0 && $events{retirement}{after}[2] == 0,
            'retirement drained native allocations and identities before Perl wrappers are dropped');
        close_all($seed, $native_owner, $closure, $argument, $borrowed, $receiver);
        LeanBridge::OwnedProbe::Runtime::shutdown();
    }
} else {
    {
        my $seed = seed(); my $raw = bundle($seed->get);
        my $native_owner = invoke('make_record_callback', $raw); my $closure = $native_owner->get;
        my $receiver = invoke('echo_record', $raw); my $alias = $receiver->share;
        my $retained = $receiver->retain; my $recovery = invoke('echo_record', $raw);
        my @calls = (0, 0); my $out; my $before = LeanBridge::OwnedProbe::handoffs();
        my $descriptor = LeanBridge::OwnedProbe::Runtime::Callback->new(code => sub {
            ++$calls[0]; my $active = counters(); LeanBridge::OwnedProbe::Runtime::shutdown();
            my $closed = counters();
            check($active->[4] >= 2 && $closed->[4] == $active->[4], 'shutdown is deferred inside active host callback');
            check($active->[1] == $closed->[1] && $active->[2] == $closed->[2], 'active shutdown does not prematurely release native state');
            rejected('callback retired factory', sub { $closure->copy_result($_[0]) }, qr/session is closed/);
            rejected('callback retired entry', sub { invoke('callback_record', $raw, sub { $_[0] }) }, qr/session is closed/);
            $events{shutdownDuringCallback} = {before => $active, after => $closed};
            return $recovery;
        }, recovery => $recovery);
        rejected('outer callback after shutdown', sub {
            $out = $receiver->move_twice($descriptor, sub { ++$calls[1]; $_[0] });
        }, qr/session is closed/);
        check(!defined($out), 'closed runtime never publishes outer callback result');
        check(join(',', @calls) eq '1,0', 'shutdown suppresses the next host callback');
        check(LeanBridge::OwnedProbe::handoffs() == $before + 1, 'shutdown cannot undo committed handoff');
        check($receiver->closed && $alias->closed && $retained->closed && $recovery->closed,
            'retirement revokes transferred aliases, independent retain and recovery');
        my $drained = counters();
        check($drained->[1] == 0 && $drained->[2] == 0 && $drained->[4] == 0 && $drained->[5] == 0,
            'native runtime drains exactly when active callback stack unwinds');
        $events{shutdownResult} = {calls => [@calls], handoffBefore => $before,
            handoffAfter => LeanBridge::OwnedProbe::handoffs(), drained => $drained};
        close_all($seed, $native_owner, $closure, $receiver, $alias, $retained, $recovery, $out);
        LeanBridge::OwnedProbe::Runtime::shutdown();
    }
}
balanced([(0) x 6], 'final explicit cleanup and shutdown');
print $json->encode({variant => $variant, actualLean => JSON::PP::true, installedPackage => JSON::PP::false,
    checks => $checks, events => \%events, errors => \@errors, baseline => $empty, final => counters(),
    perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0});
