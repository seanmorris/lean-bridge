use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr);
use LeanBridge::OwnedProbe;

my $variant = shift @ARGV // die "expected no-host, host or combined\n";
die "unknown callback variant\n" unless $variant =~ /^(?:no-host|host|combined)$/;
my $host = $variant ne 'no-host';
my $combined = $variant eq 'combined';
my $checks = 0;
my %phases;
sub check { die 'callback-result check ' . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks }
sub invoke { my ($name, @args) = @_; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args) }
sub rejected {
    my ($run, $pattern) = @_;
    my $ok = eval { $run->(); 1 }; my $error = $@;
    check(!$ok && $error =~ $pattern, "expected $pattern; got $error");
    return $error;
}
sub same_exception {
    my ($run, $expected) = @_;
    my $ok = eval { $run->(); 1 }; my $error = $@;
    check(!$ok && ref($error) && refaddr($error) == refaddr($expected), 'same callback exception object');
}
sub close_all { $_->close for grep { blessed($_) && $_->can('closed') } @_ }
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub balanced {
    my ($expected, $label) = @_; my $now = snapshot();
    check(join(',', @$expected[0..3,6,7]) eq join(',', @$now[0..3,6,7]), "$label balanced: " . encode_json($now));
}
sub serial { invoke('serial', $_[0])->bstr }
sub bundle {
    my ($ticket) = @_;
    LeanBridge::OwnedProbe::Bundle->new(primary => $ticket,
        spare => LeanBridge::OwnedProbe::Some->new($ticket), peers => [$ticket], history => [],
        payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-17), bytes => "\0\xff\3"));
}
sub record_is { check(serial($_[0]->get->primary) eq '63', $_[1]) }
{
    package FactoryArgumentMagic;
    sub TIESCALAR { bless {fetch => $_[1]}, $_[0] }
    sub FETCH { $_[0]->{fetch}->() }
    package main;
}

my $empty = snapshot();
{
    my $seed = invoke('new_ticket', Math::BigInt->new(63), 'callback-result');
    my $raw = bundle($seed->get);
    my $baseline = snapshot();
    my $start = $checks;
    {
        my $closure_owner = invoke('make_record_callback', $raw);
        my $closure = $closure_owner->get;
        my $original = $closure->copy_arg0($raw);
        my $result_copy = $closure->copy_result($raw);
        record_is($original, 'public callback parameter factory');
        record_is($result_copy, 'public callback result factory');
        my $direct = invoke('callback_record', $raw, $closure);
        my $twice = invoke('apply_twice', $raw, $closure, $closure);
        my $dispatcher = invoke('dispatch', $raw);
        my $higher = $dispatcher->call($closure);
        record_is($direct, 'native closure export');
        record_is($twice, 'two native closure arguments');
        record_is($higher, 'higher-order native closure argument');
        check($closure->same_identity($closure_owner->get), 'native closure identity survives raw view');
        my $borrowed = $closure->call($original);
        my $child = $closure->call($borrowed);
        my $alias = $child->share;
        my $retained = $child->retain;
        my $copied = invoke('copy_value', $child->get);
        my ($primary, $peer, $spare) = ($child->get->primary, $child->get->peers->[0], $child->get->spare->value);
        check(!$primary->closed && !$peer->closed && !$spare->closed, 'nested callback descendants live');
        $original->close;
        check($borrowed->closed && $child->closed && $alias->closed, 'transitive callback result owners expire');
        check($primary->closed && $peer->closed && $spare->closed, 'all nested callback identity descendants expire');
        rejected(sub { $borrowed->get }, qr/status=4/);
        rejected(sub { $alias->get }, qr/status=4/);
        rejected(sub { serial($primary) }, qr/status=4|closed|expired/);
        record_is($retained, 'independent whole retain survives original argument');
        record_is($copied, 'independent raw value copy survives original argument');
        check(!$closure->closed, 'argument expiry does not expire the closure');

        my $factory = $closure->can('copy_arg0');
        my $fetches = 0;
        tie my $unread, 'FactoryArgumentMagic', sub { ++$fetches; $raw };
        my $fake = bless {}, ref($closure);
        rejected(sub { $factory->($fake, $unread) }, qr/Invalid or foreign Lean identity/);
        check($fetches == 0, 'spoofed factory self rejected before raw value FETCH');
        my $wrong_owner = invoke('make_leased_record', $raw);
        rejected(sub { $factory->($wrong_owner->get, $unread) }, qr/Wrong Lean identity type/);
        check($fetches == 0, 'wrong callback factory self rejected before raw value FETCH');
        $closure_owner->close;
        rejected(sub { $factory->($closure, $unread) }, qr/closed|expired/);
        check($fetches == 0, 'closed factory self rejected before raw value FETCH');
        untie $unread;
        record_is($result_copy, 'factory copy does not borrow closure lifetime');
        close_all($original, $result_copy, $direct, $twice, $higher, $dispatcher,
            $borrowed, $child, $alias, $retained, $copied, $wrong_owner, $closure_owner,
            $closure, $primary, $peer, $spare);
    }
    balanced($baseline, 'native callback copies');
    {
        my $owner = invoke('make_record', $raw);
        my $closure = $owner->get;
        check(!$closure->can('copy_arg0') && $closure->can('copy_arg1'), 'copied Bool omitted and public argument index preserved');
        my $argument = $closure->copy_arg1($raw);
        my $borrowed = $closure->call(LeanBridge::OwnedProbe::false(), $argument);
        my $retained = $borrowed->retain;
        $argument->close;
        check($borrowed->closed, 'second callback parameter anchors result');
        rejected(sub { $borrowed->get }, qr/status=4/);
        record_is($retained, 'second-parameter retain survives');
        close_all($owner, $argument, $borrowed, $retained, $closure);
    }
    balanced($baseline, 'second callback parameter');
    for my $tree (LeanBridge::OwnedProbe::Tree::Branch->new(children => []),
        LeanBridge::OwnedProbe::Tree::Branch->new(children => [LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $seed->get)])) {
        my $owner = invoke('make_tree_callback', $tree);
        my $closure = $owner->get;
        my $original = $closure->copy_arg0($tree);
        my $borrowed = $closure->call($original);
        my $retained = $borrowed->retain;
        my $length = @{$tree->children};
        check(@{$borrowed->get->children} == $length, 'recursive callback preserves empty or populated value');
        my $leaf = $length ? $borrowed->get->children->[0]->ticket : undef;
        $original->close;
        check($borrowed->closed && (!$leaf || $leaf->closed), 'recursive result including empty value expires');
        rejected(sub { $borrowed->get }, qr/status=4/);
        check(@{$retained->get->children} == $length, 'recursive retained value survives');
        close_all($owner, $original, $borrowed, $retained, $closure, $leaf);
    }
    balanced($baseline, 'recursive callback values');
    $phases{native} = $checks - $start;

    if ($host) {
        $start = $checks;
        {
            my $escaped;
            my $raw_callback = sub { $escaped = $_[0]->primary; $_[0] };
            my $out = invoke('callback_record', $raw, $raw_callback);
            check($escaped->closed, 'host callback argument borrow expires');
            record_is($out, 'raw host reply is copied before argument expiry');
            my $reply = invoke('echo_record', $raw);
            my $whole = invoke('callback_record', $raw, sub { $reply });
            $reply->close;
            record_is($whole, 'whole host reply is copied independently');
            my $temporary = invoke('callback_record', $raw, sub { invoke('echo_record', $_[0]) });
            record_is($temporary, 'temporary whole host reply survives callback temporary cleanup');
            rejected(sub { invoke('callback_record', $raw, sub { $reply }) }, qr/status=4/);
            my $native_owner = invoke('make_record_callback', $raw);
            my $closure = $native_owner->get;
            my $native_whole = invoke('callback_record', $raw, $native_owner);
            record_is($native_whole, 'whole native closure is accepted as host-capable argument');
            check($closure->same_identity($native_owner->get), 'host-capable path preserves native closure identity');
            my $left = invoke('apply_twice', $raw, $closure, $raw_callback);
            my $right = invoke('apply_twice', $raw, $raw_callback, $native_owner);
            my $both = invoke('apply_twice', $raw, $raw_callback, $raw_callback);
            my $dispatcher = invoke('dispatch', $raw);
            my $higher = $dispatcher->call($raw_callback);
            record_is($_, 'mixed or higher-order host callback') for ($left, $right, $both, $higher);
            my $expected = bless {message => 'same callback exception'}, 'CallbackResultError';
            same_exception(sub { invoke('callback_record', $raw, sub { die $expected }) }, $expected);
            close_all($out, $whole, $temporary, $reply, $native_whole, $native_owner, $closure,
                $left, $right, $both, $dispatcher, $higher, $escaped);
        }
        balanced($baseline, 'raw and whole host callbacks');
        for my $whole_recovery (0, 1) {
            my $recovery = invoke('echo_record', $raw);
            my $fetches = 0;
            my $callback = LeanBridge::OwnedProbe::Runtime::Callback->new(
                code => sub { $_[0] }, recovery => $raw);
            tie $callback->{recovery}, 'FactoryArgumentMagic', sub { ++$fetches; $whole_recovery ? $recovery : $raw };
            my $out = invoke('callback_record', $raw, $callback);
            check($fetches == 1, 'raw or whole tied recovery field fetched exactly once');
            record_is($out, 'tied recovery snapshot preserves callback result');
            untie $callback->{recovery};
            close_all($recovery, $out);
        }
        balanced($baseline, 'tied raw and whole recovery fields');
        {
            my $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => []);
            my $reply = invoke('echo_recursive', $tree);
            my $out = invoke('callback_recursive', $tree, sub { $reply });
            $reply->close;
            check(@{$out->get->children} == 0, 'whole empty host reply copied independently');
            rejected(sub { invoke('callback_recursive', $tree, sub { $reply }) }, qr/status=4/);
            close_all($reply, $out);
        }
        balanced($baseline, 'empty host callbacks');
        $phases{host} = $checks - $start;
    }

    if ($combined) {
        $start = $checks;
        {
            my $native_owner = invoke('make_record_callback', $raw);
            my $closure = $native_owner->get;
            my $host_callback = sub { $_[0] };
            for my $callbacks ([$host_callback, $host_callback], [$closure, $host_callback],
                [$host_callback, $native_owner], [$closure, $closure]) {
                my $receiver = invoke('echo_record', $raw);
                my $alias = $receiver->share;
                my $view = $receiver->borrow_record;
                my $retained = $receiver->retain;
                my $before = LeanBridge::OwnedProbe::handoffs();
                my $out = $receiver->move_twice(@$callbacks);
                check($receiver->closed && $alias->closed && $view->closed, 'consuming receiver expires aliases and borrowed result');
                check(LeanBridge::OwnedProbe::handoffs() == $before + 1, 'mixed callback receiver handed off exactly once');
                record_is($out, 'consuming mixed callback output');
                record_is($retained, 'retained receiver survives consumption');
                close_all($receiver, $alias, $view, $retained, $out);
            }
            my $reply = invoke('echo_record', $raw);
            my $receiver = invoke('echo_record', $raw);
            my $whole = $receiver->move_record(sub { $reply });
            $reply->close;
            check($receiver->closed, 'whole host reply consumes receiver');
            record_is($whole, 'consuming whole host reply copied independently');
            close_all($reply, $receiver, $whole);

            my $expected = bless {message => 'post-handoff exception'}, 'CallbackResultError';
            my $failing = invoke('echo_record', $raw);
            my $alias = $failing->share;
            my $retained = $failing->retain;
            same_exception(sub { $failing->move_twice($host_callback, sub { die $expected }) }, $expected);
            check($failing->closed && $alias->closed, 'post-handoff failure consumes receiver aliases');
            record_is($retained, 'receiver retain survives post-handoff failure');
            close_all($failing, $alias, $retained, $native_owner, $closure);
        }
        balanced($baseline, 'consuming receivers');
        {
            my $native_owner = invoke('make_record_callback', $raw);
            my $argument = invoke('echo_record', $raw);
            my $expired = $native_owner->call($argument);
            $argument->close;
            check($expired->closed, 'whole recovery owner has expired');
            my $calls = 0;
            my $callback = LeanBridge::OwnedProbe::Runtime::Callback->new(
                code => sub { ++$calls; $_[0] }, recovery => $expired);
            for my $twice (0, 1) {
                my $receiver = invoke('echo_record', $raw);
                my $alias = $receiver->share;
                my $before = LeanBridge::OwnedProbe::handoffs();
                rejected(sub { $twice ? $receiver->move_twice(sub { $_[0] }, $callback) : $receiver->move_record($callback) }, qr/status=4/);
                check(!$receiver->closed && !$alias->closed, 'expired whole recovery fails before receiver consumption');
                check($calls == 0 && LeanBridge::OwnedProbe::handoffs() == $before, 'expired recovery does not invoke callback or hand off receiver');
                record_is($receiver, 'receiver remains usable after failed recovery validation');
                close_all($receiver, $alias);
            }
            close_all($native_owner, $argument, $expired);
        }
        balanced($baseline, 'expired callback recovery');
        $phases{combined} = $checks - $start;
    }
    close_all($seed);
}
balanced($empty, 'all callback scopes');
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
check(!(grep { $_ } @$final[0..3,6,7]), 'final managed/native owner and identity counters are zero');
print JSON::PP->new->canonical->encode({checks => $checks, phases => \%phases,
    variant => $variant, actualLean => JSON::PP::true, installedPackage => JSON::PP::false,
    managedLive => $final->[0], nativeLive => $final->[1], identities => $final->[2],
    owners => $final->[3], active => $final->[6], cleanupStatus => $final->[7]}), "\n";
