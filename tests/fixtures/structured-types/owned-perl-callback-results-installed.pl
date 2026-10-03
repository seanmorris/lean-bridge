use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
my %phases;
sub check { die 'installed callback check ' . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks }
sub invoke { my ($name, @args) = @_; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args) }
sub rejected {
    my ($run, $pattern) = @_;
    my $ok = eval { $run->(); 1 }; my $error = $@;
    check(!$ok && $error =~ $pattern, "expected $pattern; got $error");
}
sub same_exception {
    my ($run, $expected) = @_;
    my $ok = eval { $run->(); 1 }; my $error = $@;
    check(!$ok && ref($error) && refaddr($error) == refaddr($expected), 'same exception object');
}
sub close_all { $_->close for grep { blessed($_) && $_->can('closed') } @_ }
sub count_of { $_[0]->payload->count->bstr }
sub record_is {
    my ($owner, $label, $count) = @_;
    check(invoke('serial', $owner->get->primary)->bstr eq '63'
        && (!defined($count) || count_of($owner->get) eq "$count"), $label);
}
sub with_count {
    my ($value, $count) = @_;
    LeanBridge::OwnedProbe::Bundle->new(primary => $value->primary, spare => $value->spare,
        peers => $value->peers, history => $value->history,
        payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new($count), bytes => $value->payload->bytes));
}

my $seed = invoke('new_ticket', Math::BigInt->new(63), 'installed callback');
my $raw = LeanBridge::OwnedProbe::Bundle->new(
    primary => $seed->get, spare => LeanBridge::OwnedProbe::Some->new($seed->get),
    peers => [$seed->get], history => [],
    payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-17), bytes => "\0\xff\3"));
my $native_owner = invoke('make_record_callback', $raw);
my $native = $native_owner->get;
my $start = $checks;
{
    my $original = $native->copy_arg0(with_count($raw, 5));
    my $copy = $native->copy_result($raw);
    record_is($original, 'public native callback parameter factory', 5);
    record_is($copy, 'public native callback result factory');
    my $borrowed = $native->call($original);
    record_is($borrowed, 'native closure returns its captured value, not the argument', -17);
    my $child = $native->call($borrowed);
    my $shared = $child->share;
    my $retained = $child->retain;
    my $independent = invoke('copy_value', $child->get);
    my ($primary, $peer, $spare) = ($child->get->primary, $child->get->peers->[0], $child->get->spare->value);
    check(!$primary->closed && !$peer->closed && !$spare->closed, 'nested descendants start live');
    $original->close;
    check($borrowed->closed && $child->closed && $shared->closed, 'transitive callback owners expire');
    check($primary->closed && $peer->closed && $spare->closed, 'nested identity descendants expire');
    rejected(sub { $borrowed->get }, qr/status=4/);
    rejected(sub { $shared->get }, qr/status=4/);
    rejected(sub { invoke('serial', $primary) }, qr/status=4|closed|expired/);
    record_is($retained, 'independent retain survives original owner');
    record_is($independent, 'independent copy survives original owner');
    record_is($copy, 'factory result copy remains independent');
    check(!$native->closed, 'argument expiry preserves closure');
    close_all($original, $copy, $borrowed, $child, $shared, $retained, $independent, $primary, $peer, $spare);
}
{
    my $receiver = invoke('echo_record', $raw);
    my $owner = $receiver->make_record;
    my $callback = $owner->get;
    check(!$callback->can('copy_arg0') && $callback->can('copy_arg1'), 'Bool position omitted from factories');
    my $argument = $callback->copy_arg1($raw);
    my $borrowed = $callback->call(LeanBridge::OwnedProbe::false(), $argument);
    my $retained = $borrowed->retain;
    $argument->close;
    check($borrowed->closed, 'second local argument anchors callback result');
    rejected(sub { $borrowed->get }, qr/status=4/);
    record_is($retained, 'second argument independent retain');
    close_all($receiver, $owner, $callback, $argument, $borrowed, $retained);
}
for my $tree (LeanBridge::OwnedProbe::Tree::Branch->new(children => []),
    LeanBridge::OwnedProbe::Tree::Branch->new(children => [LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $seed->get)])) {
    my $owner = invoke('make_tree_callback', $tree);
    my $callback = $owner->get;
    my $original = $callback->copy_arg0($tree);
    my $borrowed = $callback->call($original);
    my $retained = $borrowed->retain;
    my $length = @{$tree->children};
    check(@{$borrowed->get->children} == $length, 'empty or populated recursive result');
    my $leaf = $length ? $borrowed->get->children->[0]->ticket : undef;
    $original->close;
    check($borrowed->closed && (!$leaf || $leaf->closed), 'empty or recursive owner expires');
    rejected(sub { $borrowed->get }, qr/status=4/);
    check(@{$retained->get->children} == $length, 'empty or recursive retain survives');
    close_all($owner, $callback, $original, $borrowed, $retained, $leaf);
}
$phases{native} = $checks - $start;
$start = $checks;
{
    my ($escaped, $host_calls);
    my $host = sub { ++$host_calls; $escaped = $_[0]->primary; with_count($_[0], 41) };
    my $raw_reply = invoke('callback_record', $raw, $host);
    check($escaped->closed, 'host argument borrow expires after return');
    record_is($raw_reply, 'raw host reply copied before frame expiry', 41);
    check($host_calls == 1, 'raw host callback runs exactly once');
    my $reply = invoke('echo_record', with_count($raw, 43));
    my $whole_reply = invoke('callback_record', $raw, sub { $reply });
    $reply->close;
    record_is($whole_reply, 'whole host reply copied independently', 43);
    my $temporary = invoke('callback_record', $raw, sub { invoke('echo_record', with_count($_[0], 47)) });
    record_is($temporary, 'temporary whole host reply remains valid', 47);
    rejected(sub { invoke('callback_record', $raw, sub { $reply }) }, qr/status=4/);
    my $native_reply = invoke('callback_record', with_count($raw, 5), $native_owner);
    record_is($native_reply, 'whole native closure returns captured value', -17);
    check($native->same_identity($native_owner->get), 'existing public closure views have the same identity');
    my @mixed;
    my $left = invoke('apply_twice', with_count($raw, 5), $native,
        sub { push @mixed, 'left:' . count_of($_[0]); with_count($_[0], 53) });
    my $right = invoke('apply_twice', with_count($raw, 5),
        sub { push @mixed, 'right:' . count_of($_[0]); with_count($_[0], 59) }, $native_owner);
    check(join(',', @mixed) eq 'left:-17,right:5', 'mixed host callbacks run once at the declared position');
    my $both = invoke('apply_twice', with_count($raw, 5), $native, $native);
    my @order;
    my $two_hosts = invoke('apply_twice', with_count($raw, 5),
        sub { push @order, 'left:' . count_of($_[0]); with_count($_[0], count_of($_[0]) + 2) },
        sub { push @order, 'right:' . count_of($_[0]); with_count($_[0], count_of($_[0]) * 3) });
    check(join(',', @order) eq 'left:5,right:7', 'host callbacks run exactly once in left-to-right order');
    my $dispatcher = invoke('dispatch', with_count($raw, 5));
    my $higher_calls = 0;
    my $higher_host = $dispatcher->call(sub { ++$higher_calls; with_count($_[0], 61) });
    my $higher_native = $dispatcher->call($native);
    check($higher_calls == 1, 'higher-order host callback runs once');
    record_is($left, 'native then host callback result', 53);
    record_is($right, 'host then native callback result', -17);
    record_is($both, 'two native callback results', -17);
    record_is($two_hosts, 'noncommuting host callback result', 21);
    record_is($higher_host, 'higher-order host callback result', 61);
    record_is($higher_native, 'higher-order native callback result', -17);
    close_all($raw_reply, $reply, $whole_reply, $temporary, $native_reply, $left, $right, $both,
        $two_hosts, $dispatcher, $higher_host, $higher_native, $escaped);
}
for my $whole_recovery (0, 1) {
    my $recovery = invoke('echo_record', $raw);
    my $expected = bless {message => 'installed callback exception'}, 'InstalledCallbackError';
    my $callback = LeanBridge::OwnedProbe::Runtime::Callback->new(
        code => sub { die $expected }, recovery => $whole_recovery ? $recovery : $raw);
    same_exception(sub { invoke('callback_record', $raw, $callback) }, $expected);
    record_is($recovery, 'raw or whole recovery remains independently owned');
    $recovery->close;
}
{
    my $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => []);
    my $reply = invoke('echo_recursive', $tree);
    my $out = invoke('callback_recursive', $tree, sub { $reply });
    $reply->close;
    check(@{$out->get->children} == 0, 'empty whole host reply copied independently');
    rejected(sub { invoke('callback_recursive', $tree, sub { $reply }) }, qr/status=4/);
    close_all($reply, $out);
}
$phases{host} = $checks - $start;
$start = $checks;
{
    my @order;
    my $left_host = sub { push @order, 'left:' . count_of($_[0]); with_count($_[0], count_of($_[0]) + 2) };
    my $right_host = sub { push @order, 'right:' . count_of($_[0]); with_count($_[0], count_of($_[0]) * 3) };
    for my $case ([$left_host, $right_host, 21, 'left:5,right:7'], [$native, $right_host, -51, 'right:-17'],
        [$left_host, $native_owner, -17, 'left:5'], [$native, $native, -17, '']) {
        @order = ();
        my $receiver = invoke('echo_record', with_count($raw, 5));
        my $shared = $receiver->share;
        my $view = $receiver->borrow_record;
        my $callback_child = $native->call($view);
        my $retained = $receiver->retain;
        my $out = $receiver->move_twice(@$case[0, 1]);
        check($receiver->closed && $shared->closed && $view->closed && $callback_child->closed,
            'consuming receiver expires aliases and transitive callback descendant');
        check(join(',', @order) eq $case->[3], 'consuming host callback counts, inputs and order');
        record_is($out, 'consuming mixed callback output', $case->[2]);
        record_is($retained, 'retained receiver survives handoff', 5);
        close_all($receiver, $shared, $view, $callback_child, $retained, $out);
    }
    my $reply = invoke('echo_record', with_count($raw, 71));
    my $receiver = invoke('echo_record', $raw);
    my $out = $receiver->move_record(sub { $reply });
    $reply->close;
    check($receiver->closed, 'whole host reply consumes receiver');
    record_is($out, 'whole host reply survives original owner close', 71);
    close_all($reply, $receiver, $out);
    my $expected = bless {message => 'installed post-handoff exception'}, 'InstalledCallbackError';
    my $failing = invoke('echo_record', $raw);
    my $shared = $failing->share;
    my $retained = $failing->retain;
    my ($left_calls, $right_calls) = (0, 0);
    same_exception(sub { $failing->move_twice(sub { ++$left_calls; $_[0] }, sub { ++$right_calls; die $expected }) }, $expected);
    check($left_calls == 1 && $right_calls == 1, 'both post-handoff callbacks execute exactly once');
    check($failing->closed && $shared->closed, 'post-handoff exception consumes original aliases');
    record_is($retained, 'retained receiver survives exception');
    close_all($failing, $shared, $retained);
}
{
    my $argument = invoke('echo_record', $raw);
    my $expired = $native->call($argument);
    $argument->close;
    check($expired->closed, 'whole recovery owner is expired');
    my ($calls, $left_calls) = (0, 0);
    my $callback = LeanBridge::OwnedProbe::Runtime::Callback->new(
        code => sub { ++$calls; $_[0] }, recovery => $expired);
    for my $twice (0, 1) {
        my $receiver = invoke('echo_record', $raw);
        my $shared = $receiver->share;
        rejected(sub { $twice ? $receiver->move_twice(sub { ++$left_calls; $_[0] }, $callback) : $receiver->move_record($callback) }, qr/status=4/);
        check(!$receiver->closed && !$shared->closed && $calls == 0 && $left_calls == 0,
            'expired recovery rejects before receiver handoff or either callback');
        record_is($receiver, 'receiver remains usable after failed preflight');
        close_all($receiver, $shared);
    }
    close_all($argument, $expired);
}
$phases{combined} = $checks - $start;
$native_owner->close;
check($native->closed, 'closing closure owner expires public closure view');
rejected(sub { $native->copy_arg0($raw) }, qr/closed|expired/);
close_all($native, $native_owner, $seed);
print JSON::PP->new->canonical->encode({checks => $checks, phases => \%phases}), "\n";
