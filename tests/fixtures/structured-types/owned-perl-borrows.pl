use strict;
use warnings;
no warnings 'recursion';
use utf8;
use JSON::PP;
use Math::BigInt;
use Config;
use POSIX ();
use Scalar::Util qw(blessed reftype refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
my $installed = @ARGV && $ARGV[0] eq '--installed';
my %called;
my $json = JSON::PP->new->canonical;
sub check { die 'borrow check ' . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks }
sub invoke { my ($name, @args) = @_; ++$called{$name}; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args) }
sub ticket { invoke('new_ticket', Math::BigInt->new($_[0] // 17), "native\0🙂") }
sub rejected {
    my ($run, $pattern) = @_;
    my $ok = eval { $run->(); 1 }; my $error = $@;
    check(!$ok && $error =~ $pattern, "expected $pattern; got $error");
}
sub dispose {
    my ($value) = @_;
    return unless ref $value;
    return $value->close if blessed($value) && $value->can('closed');
    return if blessed($value) && $value->isa('Math::BigInt');
    dispose($_) for reftype($value) eq 'ARRAY' ? @$value : reftype($value) eq 'HASH' ? values %$value : ();
}
sub meaning {
    my ($value) = @_;
    return $value unless ref $value;
    return ['Ticket', invoke('serial', $value)->bstr, invoke('label', $value)] if blessed($value) && $value->isa('LeanBridge::OwnedProbe::Ticket');
    return ['Integer', $value->bstr] if blessed($value) && $value->isa('Math::BigInt');
    return [map { meaning($_) } @$value] if reftype($value) eq 'ARRAY';
    return [blessed($value), map { ($_, meaning($value->{$_})) } sort keys %$value] if reftype($value) eq 'HASH';
    die 'Unexpected copied value';
}
sub payload { LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-9), bytes => "\0\x7f\x80\xff") }
sub bundle {
    my ($raw) = @_;
    LeanBridge::OwnedProbe::Bundle->new(primary => $raw, spare => LeanBridge::OwnedProbe::Some->new($raw),
        peers => [$raw, $raw], history => [$raw], payload => payload());
}
sub snapshot { $installed ? [LeanBridge::Runtime::_snapshot()->{live_identities}] : [LeanBridge::OwnedProbe::snapshot()] }
sub balanced {
    my ($expected) = @_; my $now = snapshot();
    my @fields = $installed ? (0) : (0..3,6,7);
    check(join(',', @$expected[@fields]) eq join(',', @$now[@fields]), 'balanced owners: ' . encode_json($now));
}

my $empty = snapshot();
{
    my $root = ticket(); my $raw = $root->get; my $shared = $root->share;
    my $view = invoke('retain_ticket', $root); my $child = invoke('retain_ticket', $view);
    my $retained = $child->retain; my $leaf = $raw->retain;
    check($raw->same_identity($view->get) && $raw->same_identity($retained->get), 'native identity survives separate views');
    rejected(sub { invoke('retain_ticket', $raw) }, qr/Value owner/);
    $root->close;
    check(invoke('serial', $child->get)->bcmp(17) == 0, 'shared whole owner stays live');
    $shared->close;
    check($view->closed && $child->closed && $raw->closed, 'closing last whole owner expires all views');
    rejected(sub { $view->get }, qr/status=4/);
    rejected(sub { $raw->same_identity($raw) }, qr/closed|expired|status=4/);
    check(invoke('serial', $retained->get)->bcmp(17) == 0 && invoke('serial', $leaf)->bcmp(17) == 0, 'independent retains survive');
    dispose([$root, $shared, $view, $child, $retained, $leaf, $raw]);
}
balanced($empty);
{
    my @chain = (ticket(43)); my $bounded = 0;
    for (1..160) {
        my $next = eval { invoke('retain_ticket', $chain[-1]) };
        if (!$next) { check($@ =~ /status=2/, 'borrow ancestry limit'); $bounded = 1; last }
        push @chain, $next;
    }
    check($bounded && @chain > 2, 'borrow ancestry is bounded');
    $chain[0]->close;
    check(!(grep { !$_->closed } @chain), 'all transitive owners expire');
    dispose(\@chain);
}
balanced($empty);
{
    my ($view, $raw);
    { my $root = ticket(37); $view = invoke('retain_ticket', $root); $raw = $root->get }
    check($view->closed && $raw->closed, 'finalization releases original whole owner');
    dispose([$view, $raw]);
}
balanced($empty);
{
    my $seed = ticket(29); my $raw = $seed->get;
    my $tree = LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $raw);
    $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => [$tree]) for 1..30;
    my @cases = (
        ['echo_array', [$raw, $raw]], ['echo_array', []], ['echo_list', [$raw]], ['echo_list', []],
        ['echo_option', LeanBridge::OwnedProbe::Some->new($raw)], ['echo_option', undef],
        ['echo_result', LeanBridge::OwnedProbe::Ok->new(bundle($raw))], ['echo_result', LeanBridge::OwnedProbe::Err->new($raw)],
        ['echo_tuple', [$raw, [LeanBridge::OwnedProbe::Some->new($raw), payload()]]],
        ['echo_record', bundle($raw)], ['echo_alias', bundle($raw)],
        ['echo_variant', LeanBridge::OwnedProbe::Choice::Empty->new],
        ['echo_variant', LeanBridge::OwnedProbe::Choice::One->new(ticket => $raw)],
        ['echo_variant', LeanBridge::OwnedProbe::Choice::Pair->new(first => $raw, second => $raw)],
        ['echo_variant', LeanBridge::OwnedProbe::Choice::Many->new(tickets => [$raw])],
        ['echo_variant', LeanBridge::OwnedProbe::Choice::Many->new(tickets => [])],
        ['echo_row', [undef, LeanBridge::OwnedProbe::Some->new($raw), undef]], ['echo_recursive', $tree],
        ['echo_recursive', LeanBridge::OwnedProbe::Tree::Branch->new(children => [])],
        ['echo_nested', [[], [undef, LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Ok->new(bundle($raw))),
            LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Err->new($raw))]]]
    );
    for my $case (@cases) {
        my ($name, $input) = @$case;
        my $root = invoke('copy_value', $input, result_of => $name);
        my $expected = $json->encode(meaning($root->get));
        my $view = invoke($name, $root); my $child = invoke($name, $view); my $retained = $child->retain;
        check($json->encode(meaning($view->get)) eq $expected, "$name preserves meaning");
        check($json->encode(meaning($child->get)) eq $expected, "$name preserves transitive meaning");
        $root->close;
        check($view->closed && $child->closed, "$name views expire, including empty cases");
        rejected(sub { $view->get }, qr/status=4/); rejected(sub { $child->get }, qr/status=4/);
        check($json->encode(meaning($retained->get)) eq $expected, "$name retained independently");
        dispose([$root, $view, $child, $retained]);
    }
    my $root = invoke('copy_value', bundle($raw));
    my $primary = invoke('primary', $root); my $closure = invoke('make_record', $root);
    my $independent = $closure->retain;
    my $received = $closure->call(LeanBridge::OwnedProbe::true(), $root->get);
    check(invoke('serial', $received->get->primary)->bcmp(29) == 0, 'borrowed closure executes');
    $root->close;
    check($primary->closed && $closure->closed, 'resource and closure expire');
    rejected(sub { $closure->call(LeanBridge::OwnedProbe::true(), bundle($raw)) }, qr/status=4/);
    my $fresh = $independent->call(LeanBridge::OwnedProbe::true(), bundle($raw));
    check(invoke('serial', $fresh->get->primary)->bcmp(29) == 0, 'retained closure executes');
    dispose([$root, $primary, $closure, $independent, $received, $fresh]);
    my $peers = invoke('copy_value', [$raw], parameter_of => ['bundle', 2]);
    my $built = invoke('bundle', $raw, undef, $peers, [], payload());
    check(invoke('serial', $built->get->primary)->bcmp(29) == 0, 'non-first parameter anchors result');
    $peers->close; check($built->closed, 'non-first parameter expires result');
    dispose([$peers, $built, $seed]);
}
balanced($empty);
{
    my $seed = ticket(47);
    my $tree = LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $seed->get);
    $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => [$tree]) for 1..15;
    my $root = invoke('copy_value', $tree);
    my $callback = invoke('callback_recursive', $root, sub { $_[0] });
    my $closure = invoke('make_recursive', $root); my $independent = $closure->retain;
    check($json->encode(meaning($callback->get)) eq $json->encode(meaning($tree)), 'recursive callback preserves meaning');
    $root->close; check($callback->closed && $closure->closed, 'recursive callback and closure expire');
    my $out = $independent->call(LeanBridge::OwnedProbe::true(), $tree);
    check($json->encode(meaning($out->get)) eq $json->encode(meaning($tree)), 'retained recursive closure executes');
    dispose([$seed, $root, $callback, $closure, $independent, $out]);
}
balanced($empty);
for my $shape ([], undef, [[], []]) {
    my $name = !defined($shape) ? 'echo_option' : @$shape ? 'echo_nested' : 'echo_array';
    my $root = invoke('copy_value', $shape, result_of => $name);
    my $view = invoke($name, $root);
    $root->close;
    rejected(sub { $view->retain }, qr/status=4/);
    dispose([$root, $view]);
}
balanced($empty);
{
    package BorrowMagic;
    sub TIESCALAR { bless {fetch => $_[1]}, $_[0] }
    sub FETCH { $_[0]->{fetch}->() }
    package main;
    my $root = ticket(); my $fetches = 0;
    tie my $argument, 'BorrowMagic', sub { ++$fetches; $root };
    my $view = invoke('retain_ticket', $argument);
    check($fetches == 1, 'anchor scalar fetched exactly once');
    dispose([$root, $view]);
}
balanced($empty);
{
    my $seed = ticket(); my $root = invoke('copy_value', bundle($seed->get));
    my $view = invoke('echo_record', $root); my $moved;
    rejected(sub {
        invoke('callback_record', $root, sub {
            $moved = invoke('move_record', $root, sub { $_[0] });
            check($root->closed && $view->closed, 'nested transfer expires original anchor during reentry');
            return $_[0];
        });
    }, qr/status=4/);
    check(invoke('serial', $moved->get->primary)->bcmp(17) == 0, 'nested consuming result survives failed outer borrow');
    dispose([$seed, $root, $view, $moved]);
}
balanced($empty);
{
    my $seed = ticket(); my $root = invoke('copy_value', bundle($seed->get));
    my $out = invoke('move_record', $root, sub {
        check($root->closed, 'consumed original is closed inside callback');
        my $pid = fork(); die "fork failed: $!" unless defined $pid;
        if (!$pid) {
            my $ok = eval { invoke('serial', $_[0]->primary); 1 };
            POSIX::_exit(!$ok && $@ =~ /initiating process/ ? 0 : 1);
        }
        waitpid($pid, 0); check($? == 0, 'fork cannot use inherited ownership');
        return $_[0];
    });
    check(invoke('serial', $out->get->primary)->bcmp(17) == 0, 'parent remains usable after fork');
    dispose([$seed, $root, $out]);
}
balanced($empty);
if ($Config{useithreads}) {
    require threads;
    my $root = ticket();
    my $worker = threads->create(sub {
        my $ok = eval { invoke('retain_ticket', $root); 1 };
        return !$ok && $@ =~ /initiating process and Perl interpreter thread/ ? 1 : 0;
    });
    check($worker->join, 'cloned interpreter cannot use whole owners');
    my $view = invoke('retain_ticket', $root);
    check(invoke('serial', $view->get)->bcmp(17) == 0, 'creator survives foreign thread rejection');
    dispose([$root, $view]);
}
balanced($empty);
my @held_errors;
{
    package FalseBorrowError;
    use overload 'bool' => sub { 0 }, '""' => sub { die 'exception was stringified' }, fallback => 1;
    package main;
    my $error = bless {}, 'FalseBorrowError'; my $seed = ticket();
    my $root = invoke('copy_value', bundle($seed->get));
    my $ok = eval { invoke('move_record', $root, sub { die $error }); 1 };
    check(!$ok && refaddr($@) == refaddr($error), 'false-valued callback error retains identity');
    push @held_errors, $error;
    check($root->closed, 'callback exception cannot restore consumed original');
    dispose([$seed, $root]);
}
balanced($empty);
{
    my $root = ticket(); my $alias = $root->share; my $view = invoke('retain_ticket', $root);
    rejected(sub { invoke('transfer_ticket', $view) }, qr/status=1/);
    rejected(sub { invoke('mixed_ticket', $root, $root) }, qr/status=1/);
    rejected(sub { invoke('mixed_ticket', $view, $root) }, qr/status=1/);
    check(!$root->closed && !$view->closed, 'rejected transfers preserve original owner');
    my $out = invoke('transfer_ticket', $root);
    check($root->closed && $alias->closed && $view->closed, 'original slot transfer expires aliases');
    check(invoke('serial', $out->get)->bcmp(17) == 0, 'transferred output owns independent lease');
    dispose([$root, $alias, $view, $out]);
    my $empty_owner = invoke('copy_value', [], result_of => 'echo_array');
    my $empty_view = invoke('echo_array', $empty_owner); my $moved = invoke('move_array', $empty_owner);
    check($empty_owner->closed && $empty_view->closed && @{$moved->get} == 0, 'empty original slot is consumed');
    dispose([$empty_owner, $empty_view, $moved]);
}
balanced($empty);
{
    my $seed = ticket(); my $root = invoke('copy_value', bundle($seed->get));
    my ($escaped, $kept);
    my $out = invoke('callback_record', $root, sub {
        $escaped = $_[0]; $kept = invoke('copy_value', $_[0]); return $_[0];
    });
    check($escaped->primary->closed, 'callback leaf expires on return');
    check(invoke('serial', $kept->get->primary)->bcmp(17) == 0, 'callback retain is independent');
    $root->close; check($out->closed, 'callback result follows declared owner');
    dispose([$seed, $root, $out, $escaped, $kept]);
}
balanced($empty);
rejected(sub { invoke('copy_value', []) }, qr/select result_of/);
rejected(sub { invoke('copy_value', undef) }, qr/select result_of/);
rejected(sub { invoke('copy_value', [], result_of => 'serial') }, qr/owned type/);
rejected(sub { invoke('copy_value', [], result_of => 'echo_array', parameter_of => ['bundle', 2]) }, qr/choose/);
rejected(sub { invoke('copy_value', [], result_of => 'echo_array', result_of => 'echo_array') }, qr/duplicate/);
balanced($empty);
sub faults {
    my %counts;
    for my $domain ('allocator', 'exception', 'native') {
        $counts{$domain} = {before => 0, after => 0};
        my $done = 0;
        for my $index (($domain eq 'native' ? 0 : 1)..4000) {
            {
                my $seed = ticket(); my $root = invoke('copy_value', bundle($seed->get));
                my $view = invoke('echo_record', $root);
                my $before = LeanBridge::OwnedProbe::handoffs(); my ($out, $error);
                LeanBridge::OwnedProbe::reset($domain eq 'allocator' ? $index : 0, $domain eq 'exception' ? $index : 0, $domain eq 'native' ? $index : -1);
                my $ok = eval { $out = invoke('move_record', $root, sub { $_[0] }); 1 }; $error = $@;
                LeanBridge::OwnedProbe::reset();
                my $consumed = LeanBridge::OwnedProbe::handoffs() != $before;
                check($consumed ? $root->closed && $view->closed : !$root->closed && !$view->closed, "$domain original-owner handoff $index");
                if ($ok) { check($consumed && !$out->closed, 'successful handoff'); $done = 1 }
                else { ++$counts{$domain}{$consumed ? 'after' : 'before'}; push @held_errors, $error }
                dispose([$seed, $root, $view, $out]);
            }
            balanced($empty); last if $done;
        }
        check($done, "$domain sweep terminates");
        check($counts{$domain}{before} > 0 && $counts{$domain}{after} > 0, "$domain failures straddle handoff");
    }
    return \%counts;
}
my $faults = $installed ? undef : faults();
balanced($empty);
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
check($installed ? $final->[0] == 0 : $final->[0] == 0 && $final->[1] == 0 && $final->[2] == 0 && $final->[7] == 0, 'all owners released with errors retained');
print $json->encode({checks => $checks, exports => [sort keys %called], heldErrors => scalar(@held_errors),
    $installed ? (brokerIdentities => $final->[0]) : (managedLive => $final->[0], live => $final->[1], identities => $final->[2], faults => $faults),
    perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0});
