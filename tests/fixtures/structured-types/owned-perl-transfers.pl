use strict;
use warnings;
# These fixture walkers visit valid graphs deeper than Perl's warning threshold.
no warnings 'recursion';
use utf8;
use Config;
use JSON::PP;
use Math::BigInt;
use POSIX ();
use Scalar::Util qw(blessed refaddr reftype);
use LeanBridge::OwnedProbe;

my $checks = 0;
my $installed = (@ARGV && $ARGV[0] eq '--installed') ? 1 : 0;
my %called;
my $json = JSON::PP->new->canonical;
sub check { die "transfer check " . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks; }
sub invoke { my ($name, @args) = @_; ++$called{$name}; no strict 'refs'; return &{'LeanBridge::OwnedProbe::' . $name}(@args); }
sub snapshot { $installed ? [LeanBridge::Runtime::_snapshot()->{live_identities}] : [LeanBridge::OwnedProbe::snapshot()] }
sub balanced {
    my ($before) = @_;
    my $after = snapshot();
    my @fields = $installed ? (0) : (0 .. 3, 6, 7);
    check(join(',', @$before[@fields]) eq join(',', @$after[@fields]), 'balanced owners: ' . encode_json($after));
}
sub rejected {
    my ($run, $pattern) = @_;
    my $ok = eval { $run->(); 1 };
    my $error = $@;
    check(!$ok && $error =~ $pattern, "expected $pattern; got $error");
}
sub resources {
    my ($value) = @_;
    return () unless ref $value;
    return ($value) if blessed($value) && $value->can('closed');
    return () if blessed($value) && $value->isa('Math::BigInt');
    return map { resources($_) } @$value if reftype($value) eq 'ARRAY';
    return map { resources($_) } values %$value if reftype($value) eq 'HASH';
    return ();
}
sub drop { $_->close() for resources($_[0]); }
sub closed { return !(grep { !$_->closed() } resources($_[0])); }
sub open_values { return !(grep { $_->closed() } resources($_[0])); }
sub meaning {
    my ($value) = @_;
    return $value unless ref $value;
    return ['Ticket', invoke('serial', $value)->bstr, invoke('label', $value)] if blessed($value) && $value->isa('LeanBridge::OwnedProbe::Ticket');
    return ['Integer', $value->bstr] if blessed($value) && $value->isa('Math::BigInt');
    return [map { meaning($_) } @$value] if reftype($value) eq 'ARRAY';
    return [blessed($value), map { ($_, meaning($value->{$_})) } sort keys %$value] if reftype($value) eq 'HASH';
    return ['Boolean', $$value ? 1 : 0] if reftype($value) eq 'SCALAR';
    die 'Unexpected copied value';
}
sub ticket { invoke('new_ticket', Math::BigInt->new($_[0] // 17), "native\0🙂") }
sub payload { LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(-9), bytes => "\0\x7f\x80\xff") }
sub record {
    my ($first, $second) = (ticket(), ticket(23));
    return LeanBridge::OwnedProbe::Bundle->new(primary => $first, spare => LeanBridge::OwnedProbe::Some->new($second),
        peers => [$first, $second], history => [$second], payload => payload());
}
sub tree {
    my ($depth) = @_; $depth //= 30;
    my $value = LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => ticket());
    $value = LeanBridge::OwnedProbe::Tree::Branch->new(children => [$value]) for 1 .. $depth;
    return $value;
}
sub chain {
    my ($depth) = @_; $depth //= 30;
    my $value = LeanBridge::OwnedProbe::Chain::Stop->new;
    $value = LeanBridge::OwnedProbe::Chain::Link->new(ticket => ticket($_), next => LeanBridge::OwnedProbe::Some->new($value)) for 1 .. $depth;
    return $value;
}
sub mixed {
    my ($error) = @_;
    return LeanBridge::OwnedProbe::Mixed->new(ticket => ticket(),
        markers => [undef, LeanBridge::OwnedProbe::Some->new(undef),
            LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::false())),
            LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::true()))],
        unit => LeanBridge::OwnedProbe::Some->new(undef),
        result => $error ? LeanBridge::OwnedProbe::Err->new(ticket(31)) : LeanBridge::OwnedProbe::Ok->new(record()),
        signed => Math::BigInt->new(2)->bpow(180)->bneg, unsigned => Math::BigInt->new(2)->bpow(200),
        scalar => '🙂', precise => -0.0, approximate => 1.5, bytes => "\0\x7f\x80\xff", words => [0, 18446744073709551615],
        product => [ticket(), [LeanBridge::OwnedProbe::Some->new(ticket(32)), payload()]], chain => chain(3));
}
sub roundtrip {
    my ($name, $make) = @_;
    my $value = $make->();
    my $expected = $json->encode(meaning($value));
    my $result = invoke($name, $value);
    check(closed($value), "$name consumes every original lease");
    check($json->encode(meaning($result)) eq $expected, "$name preserves the value");
    drop($value); drop($result);
}
my $empty = snapshot();
{
    my $first = ticket(); my $alias = $first; my $kept = $first->retain;
    my $out = invoke('retain_ticket', $first);
    check($alias->closed && !$kept->closed, 'alias closes, independent retain survives');
    check(invoke('serial', $out)->bcmp(17) == 0 && invoke('serial', $kept)->bcmp(17) == 0, 'retained identities remain usable');
    rejected(sub { invoke('serial', $alias) }, qr/closed|expired/);
    drop([$first, $alias, $kept, $out]);
}
balanced($empty);
{
    package TransferMagic;
    sub TIESCALAR { bless {fetch => $_[1]}, $_[0] }
    sub FETCH { $_[0]->{fetch}->() }
    package main;
    my $first = ticket(); my $fetches = 0;
    tie my $argument, 'TransferMagic', sub { ++$fetches; return $first };
    my $out = LeanBridge::OwnedProbe::retain_ticket($argument);
    check($fetches == 1 && $first->closed, 'consuming identity is fetched exactly once');
    drop([$first, $out]);
}
balanced($empty);
{
    my ($first, $second) = (ticket(), ticket(23)); my $fetches = 0;
    tie my $argument, 'TransferMagic', sub {
        ++$fetches;
        check(!$first->closed && invoke('serial', $first)->bcmp(17) == 0, 'reserved input remains borrowable during preparation');
        rejected(sub { invoke('retain_ticket', $first) }, qr/status=1/);
        check(!$first->closed, 'reentrant move cannot consume an outer reservation');
        return [$second];
    };
    my $out = LeanBridge::OwnedProbe::bundle($first, undef, $argument, [], payload());
    check($fetches == 1 && $first->closed && $second->closed, 'outer transfer commits after reentrant validation');
    drop([$first, $second, $out]);
}
balanced($empty);
{
    my $source = record(); my $value = invoke('echo_record', $source);
    my $primary = invoke('primary', $value); my $copied = invoke('payload', $value);
    check(invoke('serial', $primary)->bcmp(17) == 0 && $copied->count->bcmp(-9) == 0, 'borrowing projections preserve resource and copied payload');
    my $kept = $value->spare->value->retain;
    my $out = invoke('retain_ticket', $value->primary);
    check(closed($value) && invoke('serial', $kept)->bcmp(23) == 0, 'moving one leaf closes its result-owner siblings');
    check(!$primary->closed, 'independently returned projection survives transfer');
    drop([$source, $value, $primary, $kept, $out]);
}
balanced($empty);
for my $case (
    ['echo_array', sub { [ticket(), ticket(2)] }], ['echo_array', sub { [] }],
    ['echo_list', sub { [ticket(), ticket(2)] }], ['echo_list', sub { [] }],
    ['echo_option', sub { LeanBridge::OwnedProbe::Some->new(ticket()) }], ['echo_option', sub { undef }],
    ['echo_result', sub { LeanBridge::OwnedProbe::Ok->new(record()) }], ['echo_result', sub { LeanBridge::OwnedProbe::Err->new(ticket()) }],
    ['echo_tuple', sub { [ticket(), [LeanBridge::OwnedProbe::Some->new(ticket(2)), payload()]] }],
    ['echo_record', \&record], ['echo_alias', \&record],
    ['echo_variant', sub { LeanBridge::OwnedProbe::Choice::Empty->new }],
    ['echo_variant', sub { LeanBridge::OwnedProbe::Choice::One->new(ticket => ticket()) }],
    ['echo_variant', sub { LeanBridge::OwnedProbe::Choice::Pair->new(first => ticket(), second => ticket(2)) }],
    ['echo_variant', sub { LeanBridge::OwnedProbe::Choice::Many->new(tickets => [ticket(), ticket(2)]) }],
    ['echo_variant', sub { LeanBridge::OwnedProbe::Choice::Many->new(tickets => []) }],
    ['echo_row', sub { [undef, LeanBridge::OwnedProbe::Some->new(ticket()), undef] }],
    ['echo_recursive', \&tree], ['echo_recursive', sub { tree(63) }],
    ['echo_recursive', sub { LeanBridge::OwnedProbe::Tree::Branch->new(children => []) }],
    ['echo_nested', sub { [[], [undef, LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Ok->new(record())), LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Err->new(ticket()))]] }],
    ['echo_chain', \&chain], ['echo_chain', sub { LeanBridge::OwnedProbe::Chain::Stop->new }],
    ['echo_chain', sub { LeanBridge::OwnedProbe::Chain::Link->new(ticket => ticket(), next => undef) }],
    ['echo_mixed', sub { mixed(0) }], ['echo_mixed', sub { mixed(1) }]
) { roundtrip(@$case); balanced($empty); }
{
    my $first = ticket(); my $out = invoke('echo_array', [$first, $first]);
    check($first->closed && invoke('serial', $out->[1])->bcmp(17) == 0, 'repeated identity within one consuming argument');
    drop([$first, $out]);
}
balanced($empty);
{
    my ($first, $second, $borrowed) = (ticket(), ticket(23), ticket(31));
    my $out = invoke('bundle', $first, LeanBridge::OwnedProbe::Some->new($borrowed), [$second], [$borrowed], payload());
    check($first->closed && $second->closed && !$borrowed->closed, 'mixed consuming and borrowed inputs');
    check(invoke('serial', $out->peers->[0])->bcmp(23) == 0, 'multiple input handoff values');
    drop([$first, $second, $borrowed, $out]);
}
balanced($empty);
{
    my $first = ticket(); my $before = $installed ? undef : LeanBridge::OwnedProbe::handoffs();
    rejected(sub { invoke('bundle', $first, undef, [$first], [], payload()) }, qr/status=1/);
    check(!$first->closed && ($installed || LeanBridge::OwnedProbe::handoffs() == $before), 'duplicate consuming lease fails before handoff');
    rejected(sub { invoke('echo_array', [$first, undef]) }, qr/resource|identity|Expected/);
    check(!$first->closed && ($installed || LeanBridge::OwnedProbe::handoffs() == $before), 'partial validation preserves original resource');
    $first->close;
}
balanced($empty);
{
    # Each branch adds a variant and array level; the leaf adds its ticket.
    # 63 branches fit the 128-level limit above, but 64 branches do not.
    my $value = tree(64); my $before = $installed ? undef : LeanBridge::OwnedProbe::handoffs();
    rejected(sub { invoke('echo_recursive', $value) }, qr/limit|nest|depth/i);
    check(open_values($value) && ($installed || LeanBridge::OwnedProbe::handoffs() == $before), 'deep input is not consumed');
    drop($value);
}
balanced($empty);
{
    my $value = LeanBridge::OwnedProbe::Tree::Branch->new(children => []);
    push @{$value->children}, $value;
    rejected(sub { invoke('echo_recursive', $value) }, qr/Cyclic/);
    @{$value->children} = ();
}
balanced($empty);
{
    my $value = record(); my ($escaped, $kept);
    my $out = invoke('callback_record', $value, sub {
        my ($borrow) = @_;
        check(closed($value), 'consumed aliases are closed during callback reentry');
        rejected(sub { invoke('echo_record', $borrow) }, qr/status=1/);
        $escaped = $borrow->primary;
        my $independent = $borrow->primary->retain;
        $kept = invoke('retain_ticket', $independent);
        check($independent->closed && !$kept->closed, 'a retained callback borrow can be consumed');
        my $nested = record(); my $reply = invoke('echo_record', $nested);
        check(closed($nested), 'nested transfer has a separate save-stack scope'); drop([$nested, $reply]);
        return $borrow;
    });
    check($escaped->closed && invoke('serial', $kept)->bcmp(17) == 0, 'borrow expires, retained handoff result survives');
    drop([$value, $out, $escaped, $kept]);
}
balanced($empty);
{
    my $value = tree(4); my $out = invoke('callback_recursive', $value, sub {
        check(closed($value), 'recursive callback sees consumed originals'); return $_[0];
    }); drop([$value, $out]);
}
balanced($empty);
{
    my $value = record(); my $out = invoke('callback_record', $value, sub {
        my ($borrow) = @_;
        my $pid = fork(); die "fork failed: $!" unless defined $pid;
        if (!$pid) {
            my $ok = eval { invoke('echo_record', $borrow); 1 };
            POSIX::_exit(!$ok && $@ =~ /initiating process/ ? 0 : 1);
        }
        waitpid($pid, 0);
        check($? == 0, 'forked consuming call rejects before touching inherited owners');
        check(invoke('serial', $borrow->primary)->bcmp(17) == 0, 'parent callback borrow survives fork rejection');
        return $borrow;
    });
    check(closed($value) && open_values($out), 'parent transfer finishes after fork rejection');
    drop([$value, $out]);
}
balanced($empty);
if ($Config{useithreads}) {
    require threads;
    my $first = ticket();
    my $worker = threads->create(sub {
        my $ok = eval { invoke('retain_ticket', $first); 1 };
        return !$ok && $@ =~ /initiating process and Perl interpreter thread/ ? 1 : 0;
    });
    check($worker->join(), 'cloned interpreter cannot enter a consuming call');
    my $out = invoke('retain_ticket', $first);
    check($first->closed && invoke('serial', $out)->bcmp(17) == 0, 'creator can still consume after thread rejection');
    drop([$first, $out]);
}
balanced($empty);
my @held_errors;
{
    package FalseTransferError;
    use overload 'bool' => sub { 0 }, '""' => sub { die 'exception was stringified' }, fallback => 1;
    package main;
    my $error = bless {}, 'FalseTransferError'; my $value = record();
    my $ok = eval { invoke('callback_record', $value, sub { die $error }); 1 };
    check(!$ok && refaddr($@) == refaddr($error), 'same false-valued exception survives native cleanup');
    push @held_errors, $error;
    check(closed($value), 'callback exception does not restore ownership'); drop($value);
}
balanced($empty);
for my $case (['make_record', \&record], ['make_recursive', sub { tree(4) }]) {
    my ($name, $make) = @$case;
    my $captured = $make->(); my $expected = $json->encode(meaning($captured));
    my $closure = invoke($name, $captured); check(closed($captured), "$name consumes its capture");
    my $supplied = $make->(); my $out = $closure->call(LeanBridge::OwnedProbe::true(), $supplied);
    check($json->encode(meaning($out)) eq $expected && open_values($supplied), 'captured closure result and borrowed call input');
    drop([$captured, $closure, $supplied, $out]);
}
balanced($empty);
{
    my $first = invoke('new_record_callback'); my $kept = $first->retain;
    my $out = invoke('transfer_callback', $first);
    check($first->closed && !$kept->closed && !$out->closed, 'returned closure ownership transfer');
    my $value = record(); my $reply = $out->call($value);
    check(invoke('serial', $reply->primary)->bcmp(17) == 0, 'transferred closure callable');
    drop([$first, $kept, $out, $value, $reply]);
}
balanced($empty);
sub faults {
    my ($multiple) = @_;
    my %counts;
    for my $domain ('allocator', 'exception', 'native') {
        $counts{$domain} = {before => 0, after => 0};
        my $done = 0;
        for my $index (($domain eq 'native' ? 0 : 1) .. 4000) {
            {
                my $input = $multiple ? [ticket(), ticket(23), ticket(31)] : record();
                my $before = LeanBridge::OwnedProbe::handoffs(); my ($out, $error);
                LeanBridge::OwnedProbe::reset($domain eq 'allocator' ? $index : 0, $domain eq 'exception' ? $index : 0, $domain eq 'native' ? $index : -1);
                my $ok = eval {
                    $out = $multiple ? invoke('bundle', $input->[0], LeanBridge::OwnedProbe::Some->new($input->[2]), [$input->[1]], [$input->[2]], payload())
                        : invoke('echo_record', $input); 1;
                };
                $error = $@;
                LeanBridge::OwnedProbe::reset();
                my $consumed = LeanBridge::OwnedProbe::handoffs() != $before;
                my $moved = $multiple ? [@$input[0, 1]] : $input;
                check($consumed ? closed($moved) : open_values($moved), "$domain handoff decision $index");
                check(!$input->[2]->closed, 'borrowed argument survives handoff failures') if $multiple;
                if ($ok) { check($consumed && open_values($out), 'successful handoff result'); $done = 1; }
                else { ++$counts{$domain}{$consumed ? 'after' : 'before'}; push @held_errors, $error; }
                drop([$input, $out]);
            }
            balanced($empty);
            last if $done;
        }
        check($done, "$domain sweep terminates");
        check($counts{$domain}{before} > 0 && $counts{$domain}{after} > 0, "$domain failures on both sides of handoff");
    }
    return \%counts;
}
my $single = $installed ? undef : faults(0); my $multiple = $installed ? undef : faults(1);
balanced($empty);
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
if ($installed) {
    check($final->[0] == 0, 'installed broker identities released while exceptions remain live');
} else {
    check($final->[0] == 0 && $final->[1] == 0 && $final->[2] == 0 && $final->[7] == 0, 'all native and Perl owners released while exceptions remain live');
}
print encode_json({checks => $checks, exports => [sort keys %called],
    $installed ? (brokerIdentities => $final->[0]) : (managedLive => $final->[0], live => $final->[1], identities => $final->[2], single => $single, multiple => $multiple),
    heldErrors => scalar(@held_errors), perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0});
