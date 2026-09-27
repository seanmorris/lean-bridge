use strict;
use warnings;
use utf8;
use Math::BigInt;
use Scalar::Util qw(blessed);
use JSON::PP;
use LeanBridge::OwnedProbe;

my $installed = @ARGV && $ARGV[0] eq '--installed';
my ($checks, $primitives) = (0, 0);
my %called;
sub check { my ($ok, $why) = @_; die "signature check " . ($checks + 1) . ": $why\n" unless $ok; ++$checks; }
sub invoke {
    my ($name, @arguments) = @_;
    no strict 'refs';
    ++$called{$name};
    return &{'LeanBridge::OwnedProbe::' . $name}(@arguments);
}
sub same {
    my ($actual, $expected, $why) = @_;
    check(!defined($expected) ? !defined($actual)
        : ref($expected) eq 'Math::BigInt' ? $actual->bcmp($expected) == 0
        : $actual eq $expected, $why);
}
sub snapshot {
    return [LeanBridge::Runtime::_snapshot()->{live_identities}] if $installed;
    return [LeanBridge::OwnedProbe::snapshot()];
}
sub restored {
    my ($before) = @_;
    my $after = snapshot();
    my @fields = $installed ? (0) : (0 .. 3, 6, 7);
    check(join(',', @$before[@fields]) eq join(',', @$after[@fields]),
        'balanced owner ledger: ' . encode_json($after));
}
my $empty = snapshot();
check($empty->[0] == 1, 'one installed native ownership session') if $installed;
my $large = Math::BigInt->new(2)->bpow(521)->badd(9);
my $ticket = invoke('new_ticket', $large, "forest 🌿\0tail");
same(invoke('serial', $ticket), $large, 'unbounded owned resource serial');
same(invoke('label', $ticket), "forest 🌿\0tail", 'resource Unicode and NUL');
my $payload = LeanBridge::OwnedProbe::Payload->new(count => $large->copy->bneg, bytes => "\xff\0");
my $bundle = invoke('bundle', $ticket, undef, [$ticket], [$ticket], $payload);
my $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => [
    LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $ticket)]);
my $chain = LeanBridge::OwnedProbe::Chain::Link->new(ticket => $ticket,
    next => LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Chain::Stop->new));
my $tuple = [$ticket, [LeanBridge::OwnedProbe::Some->new($ticket), $payload]];
my $mixed = LeanBridge::OwnedProbe::Mixed->new(ticket => $ticket,
    markers => [undef, LeanBridge::OwnedProbe::Some->new(undef),
        LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::false()))],
    unit => LeanBridge::OwnedProbe::Some->new(undef), result => LeanBridge::OwnedProbe::Ok->new($bundle),
    signed => $large->copy->bneg, unsigned => $large, scalar => "🌿",
    precise => 1.25, approximate => 0.5, bytes => "\xff\0", words => [18446744073709551615],
    product => $tuple, chain => $chain);
my $baseline = snapshot();
{
    my $retained = invoke('retain_ticket', $ticket);
    $retained->close();
    check(!$ticket->closed(), 'public resource retain creates an independent owner');
    my $primary = invoke('primary', $bundle);
    same(invoke('serial', $primary), $large, 'projected resource');
    same(invoke('payload', $bundle)->count, $payload->count, 'projected copied payload');
}
restored($baseline);
for my $name ('echo_array', 'echo_list') {
    my $out = invoke($name, [$ticket, $ticket]);
    check(@$out == 2, 'resource collection length');
    $out->[0]->close();
    same(invoke('serial', $out->[1]), $large, 'resource collection siblings are independent');
    my $none = invoke($name, []);
    check(@$none == 0, 'empty resource collection');
}
restored($baseline);
{
    check(!defined(invoke('echo_option', undef)), 'None is distinct from a present resource');
    my $some = invoke('echo_option', LeanBridge::OwnedProbe::Some->new($ticket));
    same(invoke('serial', $some->value), $large, 'Some resource');
    my $ok = invoke('echo_result', LeanBridge::OwnedProbe::Ok->new($bundle));
    my $error = invoke('echo_result', LeanBridge::OwnedProbe::Err->new($ticket));
    check(blessed($ok) =~ /::Ok$/ && blessed($error) =~ /::Err$/, 'Except constructors are distinct');
    same(invoke('serial', $error->value), $large, 'owned error payload');
    my $out = invoke('echo_tuple', $tuple);
    same(invoke('serial', $out->[1][0]->value), $large, 'nested product');
}
restored($baseline);
for my $name ('echo_record', 'echo_alias') {
    my $out = invoke($name, $bundle);
    same(invoke('serial', $out->primary), $large, 'record or transparent alias');
}
for my $choice (
    LeanBridge::OwnedProbe::Choice::Empty->new,
    LeanBridge::OwnedProbe::Choice::One->new(ticket => $ticket),
    LeanBridge::OwnedProbe::Choice::Pair->new(first => $ticket, second => $ticket),
    LeanBridge::OwnedProbe::Choice::Many->new(tickets => [$ticket])
) {
    my $out = invoke('echo_variant', $choice);
    check(blessed($out) eq blessed($choice), 'every owned variant constructor');
}
restored($baseline);
{
    my $row = invoke('echo_row', [undef, LeanBridge::OwnedProbe::Some->new($ticket)]);
    check(!defined($row->[0]) && defined($row->[1]), 'alias of an optional-resource array');
    my $out = invoke('echo_recursive', $tree);
    same(invoke('serial', $out->children->[0]->ticket), $large, 'boxed recursive branch');
    my $next = invoke('echo_chain', $chain);
    same(invoke('serial', $next->ticket), $large, 'recursive optional link');
    check(blessed($next->next->value) eq 'LeanBridge::OwnedProbe::Chain::Stop', 'recursive stop constructor');
    my $nested = invoke('echo_nested', [[undef, LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Ok->new($bundle)),
        LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Err->new($ticket))], []]);
    check(@$nested == 2 && @{$nested->[1]} == 0 && !defined($nested->[0][0]), 'nested Array/List/Option/Except');
    my $copy = invoke('echo_mixed', $mixed);
    check(!defined($copy->markers->[0]) && !defined($copy->markers->[1]->value)
        && !$copy->markers->[2]->value->value, 'None, Some(None), and Some(Some(false)) remain distinct');
    check(defined($copy->unit) && !defined($copy->unit->value), 'Some Unit remains distinct from None');
    same($copy->signed, $large->copy->bneg, 'mixed negative Int');
    same($copy->unsigned, $large, 'mixed unbounded Nat');
    same($copy->scalar, "🌿", 'mixed Unicode scalar');
    same($copy->precise, 1.25, 'mixed Float');
    same($copy->approximate, 0.5, 'mixed Float32');
    same($copy->words->[0], 18446744073709551615, 'mixed UInt64 maximum');
}
restored($baseline);
{
    my $out = invoke('callback_record', $bundle, sub { $_[0] });
    my $recursive = invoke('callback_recursive', $tree, sub { $_[0] });
    same(invoke('serial', $recursive->children->[0]->ticket), $large, 'recursive callback argument and reply');
    my $count = 0;
    my $twice = invoke('twice', $bundle, sub { ++$count; $_[0] });
    check($count == 2, 'two callback invocations');
    $count = 0;
    my $repeated = invoke('repeatedly', $bundle, sub { ++$count; $_[0] }, Math::BigInt->new(12));
    check($count == 12, 'sequential callback replies remain live');
    my $record = invoke('make_record', $bundle);
    my $selected = $record->call(LeanBridge::OwnedProbe::true(), $bundle);
    same(invoke('serial', $selected->primary), $large, 'returned multi-argument record closure');
    my $recursive_function = invoke('make_recursive', $tree);
    my $selected_tree = $recursive_function->call(LeanBridge::OwnedProbe::false(), $tree);
    same(invoke('serial', $selected_tree->children->[0]->ticket), $large, 'returned multi-argument recursive closure');
    my $identity = invoke('identity_closure', undef);
    my $value = $identity->call($bundle);
    same(invoke('serial', $value->primary), $large, 'returned identity closure');
    my $expired = invoke('retain_callback', sub { die "expired callback executed\n" });
    check(!eval { $expired->call($bundle); 1 }, 'retained host callback cannot outlive its call');
    my $factory = invoke('factory', LeanBridge::OwnedProbe::Runtime::Callback->new(
        code => sub { $ticket }, recovery => $ticket));
    same(invoke('serial', $factory), $large, 'factory callback');
    my $constructed = invoke('construct', $ticket, LeanBridge::OwnedProbe::Runtime::Callback->new(
        code => sub { $bundle }, recovery => $bundle));
    same(invoke('serial', $constructed->primary), $large, 'constructing callback');
}
restored($baseline);
{
    my ($borrow, $retained);
    my $out = invoke('with_function', $bundle, sub {
        my ($function, $value) = @_;
        $borrow = $function; $retained = $function->retain();
        return $function->call($value);
    });
    check($borrow->closed(), 'higher-order borrowed function expires');
    my $later = $retained->call($bundle);
    same(invoke('serial', $later->primary), $large, 'explicitly retained higher-order function');
    my $dispatch = invoke('dispatch', $bundle);
    my $dispatched = $dispatch->call(sub { $_[0] });
    same(invoke('serial', $dispatched->primary), $large, 'returned closure accepts a Perl callback');
}
restored($baseline);
for my $row (
    ['unit', undef], ['bool', LeanBridge::OwnedProbe::false()], ['char', "🌿"],
    ['nat', $large], ['int', $large->copy->bneg],
    ['u8', 255], ['u16', 65535], ['u32', 4294967295], ['u64', 18446744073709551615],
    ['i8', -128], ['i16', -32768], ['i32', -2147483648], ['i64', -9223372036854775808],
    ['usize', 18446744073709551615], ['isize', -9223372036854775808],
    ['f32', 1.5], ['f64', 1.25], ['string', "forest 🌿\0tail"], ['bytes', "\xff\0"]
) {
    my ($kind, $value) = @$row;
    my $count = 0;
    my $out = invoke('via_' . $kind, sub { ++$count; same($_[0], $value, $kind . ' callback input'); $_[0] }, $value);
    same($out, $value, $kind . ' callback result');
    check($count == 1, $kind . ' callback ran exactly once');
    ++$primitives;
}
restored($baseline);
undef $mixed; undef $tuple; undef $chain; undef $tree; undef $bundle; undef $payload;
$ticket->close(); undef $ticket;
restored($empty);
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
if ($installed) {
    check($final->[0] == 0, 'installed broker identities released after shutdown');
} else {
    check($final->[0] == 0 && $final->[1] == 0 && $final->[2] == 0, 'all ownership released');
}
print encode_json({checks => $checks, primitives => $primitives, exports => [sort keys %called],
    $installed ? (brokerIdentities => $final->[0]) : (live => $final->[1], identities => $final->[2])});
