use strict;
use warnings;
use Test::More;
use Scalar::Util qw(refaddr);
use LeanBridge::Other;
use LeanBridge::Workshop;
use LeanBridge::Runtime;

my ($borrow, $lease);
is(LeanBridge::Workshop::inspect_fresh(55, sub {
  $borrow = $_[0];
  is(LeanBridge::Workshop::inspect_with($borrow, sub {
    is(refaddr($_[0]), refaddr($borrow), 'nested callback shares the outer borrow');
    return LeanBridge::Other::value($_[0]);
  }), 55, 'nested scope can return without invalidating outer borrow');
  return LeanBridge::Other::value($borrow);
}), 55, 'fresh Lean value crosses as a call-scoped borrow');
ok($borrow->closed, 'saving the Perl reference does not extend a borrow');
eval { LeanBridge::Other::value($borrow) };
like($@, qr/closed/, 'another component rejects the escaped borrow');

is(LeanBridge::Workshop::inspect_fresh(56, sub {
  $borrow = $_[0];
  $lease = LeanBridge::Other::same($borrow);
  is(refaddr($lease), refaddr($borrow), 'a separately leased result promotes the same wrapper');
  return LeanBridge::Other::value($borrow);
}), 56, 'promotion during reentry succeeds');
is(LeanBridge::Other::value($lease), 56, 'real lease survives end of borrow');
$lease->close;
ok($borrow->closed, 'a promoted wrapper still closes once');

eval { LeanBridge::Workshop::inspect_fresh(57, sub { $borrow = $_[0]; die "visit failed\n" }) };
like($@, qr/^visit failed/, 'exception survives temporary cleanup');
ok($borrow->closed, 'exception expires a newly observed borrow');
my $snapshot = LeanBridge::Runtime::_snapshot();
is($snapshot->{$_}, 0, "$_ returned to baseline") for qw(live_identities live_wrappers live_scopes live_callbacks);
done_testing();
