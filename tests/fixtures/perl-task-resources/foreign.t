use v5.36;
use Test::More;
use LeanBridge::Runtime;
my ($ok,$err);
if ($ARGV[0] eq 'foreign-first') {
    require LeanBridge::ForeignPeer;
    $ok=eval { require LeanBridge::Depot; 1 }; $err=$@;
} else {
    require LeanBridge::Depot;
    my $t=LeanBridge::Depot::make(5,'original');
    $ok=eval { require LeanBridge::ForeignPeer; 1 }; $err=$@;
    is(LeanBridge::Depot::count($t),5,'first component still owns its original layout'); $t->close;
}
ok(!$ok && $err=~/Conflicting compiled Lean module: Shared/,'same-named Ticket with a different layout rejected before use');
is(LeanBridge::Runtime::_snapshot()->{live_identities},0,'failed load leaked no resource');
done_testing;
