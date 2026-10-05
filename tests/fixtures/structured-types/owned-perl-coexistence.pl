use strict;
use warnings;
use Math::BigInt;
use JSON::PP;
use Scalar::Util qw(refaddr);

my $order = shift;
my %orders = (
    'owned-first' => [qw(OwnedOne OwnedTwo CopiedGraph Peer)],
    'second-owned-first' => [qw(OwnedTwo Peer CopiedGraph OwnedOne)],
    'graph-first' => [qw(CopiedGraph OwnedOne Peer OwnedTwo)],
    'peer-first' => [qw(Peer CopiedGraph OwnedTwo OwnedOne)],
);
die "Unknown coexistence order\n" unless exists $orders{$order};
my ($checks, $callbacks, $foreign_rejections) = (0, 0, 0);
sub check { die "coexistence check " . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks; }
for my $module (@{$orders{$order}}) {
    eval "require LeanBridge::$module; 1" or die $@;
}
sub identities { LeanBridge::Runtime::_snapshot()->{live_identities} }
check(identities() == 2, 'two independent native ownership sessions');
check(LeanBridge::Runtime::_snapshot()->{runtime_init_runs} == 1, 'one shared Lean initialization');
sub copied {
    my $leaf = LeanBridge::CopiedGraph::V::Done->new(value => 41);
    my $input = LeanBridge::CopiedGraph::Parcel->new(node =>
        LeanBridge::CopiedGraph::V::Next->new(value => $leaf));
    my $out = LeanBridge::CopiedGraph::echo($input);
    check($out->node->value->value == 41, 'recursive copied value during owned callback');
    check(refaddr($out) != refaddr($input), 'copied result is independent');
    check(LeanBridge::Peer::value() == 42, 'primitive peer remains usable');
}
for (1..16) {
    my $before = identities();
    {
        my $large = Math::BigInt->new(2)->bpow(201)->badd($_);
        my $first = LeanBridge::OwnedOne::ticket($large);
        my $input = LeanBridge::OwnedOne::Parcel->new(ticket => $first, bytes => "\0\xff");
        my $borrow;
        my $result = LeanBridge::OwnedOne::through($input, sub {
            ++$callbacks;
            my ($outer) = @_; $borrow = $outer->ticket;
            my $second = LeanBridge::OwnedTwo::ticket($large);
            my $peer = LeanBridge::OwnedTwo::Parcel->new(ticket => $second, bytes => "\x07\x08");
            my $output = LeanBridge::OwnedTwo::through($peer, sub {
                ++$callbacks;
                my ($inner) = @_;
                copied();
                check(LeanBridge::OwnedOne::read($outer->ticket)->bcmp($large) == 0, 'outer component during nested callback');
                check(LeanBridge::OwnedTwo::read($inner->ticket)->bcmp($large) == 0, 'inner component during nested callback');
                return $inner;
            });
            check(LeanBridge::OwnedTwo::read($output->ticket)->bcmp($large) == 0, 'inner result retains its owner');
            check($output->bytes eq $peer->bytes, 'inner copied bytes');
            for my $attempt (
                sub { LeanBridge::OwnedTwo::read($first) },
                sub { LeanBridge::OwnedOne::read($second) },
                sub { LeanBridge::OwnedTwo::through(
                    LeanBridge::OwnedTwo::Parcel->new(ticket => $first, bytes => ''), sub { die "foreign callback ran\n" }) },
                sub { LeanBridge::OwnedOne::through(
                    LeanBridge::OwnedOne::Parcel->new(ticket => $second, bytes => ''), sub { die "foreign callback ran\n" }) },
            ) {
                my $owners = identities();
                my $ok = eval { $attempt->(); 1 }; my $error = $@;
                check(!$ok && length($error) && $error !~ /foreign callback ran/, 'foreign direct or nested resource rejected before callback');
                check(identities() == $owners, 'foreign rejection preserves both ownership ledgers');
                ++$foreign_rejections;
            }
            return $outer;
        });
        check($borrow->closed(), 'outer callback borrow expires');
        check(!$first->closed() && refaddr($result->ticket) != refaddr($first), 'independent returned owner');
        $first->close();
        check(LeanBridge::OwnedOne::read($result->ticket)->bcmp($large) == 0, 'return survives closing original owner');
    }
    check(identities() == $before, 'each nested call returns to the session-only baseline');
}
copied();
my %mappings;
open my $maps, '<', '/proc/self/maps' or die "Cannot inspect native mappings: $!\n";
while (my $line = <$maps>) {
    next unless $line =~ m{\s(/[^\n]+/(libleanshared\.so|liblean_bridge_native\.so|libgmp-lean-bridge\.so\.10))\n\z};
    $mappings{$2}{$1} = 1;
}
close $maps;
for my $name (qw(libleanshared.so liblean_bridge_native.so libgmp-lean-bridge.so.10)) {
    check(exists($mappings{$name}) && keys(%{$mappings{$name}}) == 1, 'one shared mapping for ' . $name);
}
LeanBridge::OwnedOne::Runtime::shutdown();
check(identities() == 1, 'closing one component preserves the other native session');
{
    my $remaining = LeanBridge::OwnedTwo::ticket(Math::BigInt->new(99));
    check(LeanBridge::OwnedTwo::read($remaining)->bcmp(99) == 0, 'second component survives first shutdown');
}
copied();
LeanBridge::OwnedTwo::Runtime::shutdown();
check(identities() == 0, 'both owned components release their sessions');
copied();
my $final = LeanBridge::Runtime::_snapshot();
check($final->{live_wrappers} == 0 && $final->{live_scopes} == 0 && $final->{live_callbacks} == 0,
    'copied and owned cleanup leaves no shared host wrappers');
check($final->{runtime_init_runs} == 1, 'one initialization throughout all packages');
print encode_json({order => $order, checks => $checks, callbacks => $callbacks,
    foreignRejections => $foreign_rejections, snapshot => $final,
    mappings => {map { $_ => [keys %{$mappings{$_}}] } keys %mappings}});
