use strict;
use warnings;
use Test::More;
use Scalar::Util qw(refaddr);
use LeanBridge::Workshop;
use LeanBridge::Other;
use LeanBridge::Runtime;

{
  my $value = LeanBridge::Workshop::new_counter(42);
  my $same = LeanBridge::Other::same($value);
  is(LeanBridge::Other::value($value), 42, 'peer reads the borrowed value');
  is(refaddr($same), refaddr($value), 'peer returns the same wrapper');
  is(refaddr(LeanBridge::Workshop::same_counter($same)), refaddr($value), 'round trip through original component');
  my $wrong = LeanBridge::Workshop::new_badge(42);
  eval { LeanBridge::Other::value($wrong) };
  like($@, qr/wrong Lean resource/, 'nominal kind checked across packages');
  is(LeanBridge::Other::value($same), 42, 'failed call did not consume the valid lease');
  $same->close;
  ok($value->closed, 'closing through peer invalidates both references');
  eval { LeanBridge::Other::value($value) };
  like($@, qr/closed/, 'peer rejects stale wrapper');
  $value->close; $wrong->close;
}
my $snapshot = LeanBridge::Runtime::_snapshot();
is($snapshot->{runtime_init_runs}, 1, 'one shared runtime');
is($snapshot->{$_}, 0, "$_ returned to baseline") for qw(live_identities live_wrappers live_scopes live_callbacks);
done_testing();
