use strict;
use warnings;
use Test::More;
use Scalar::Util qw(refaddr);
use LeanBridge::Other;
use LeanBridge::Workshop;
use LeanBridge::Runtime;

{
  my $counter = LeanBridge::Workshop::new_counter(41);
  my $other = LeanBridge::Workshop::new_counter(77);
  my $wrong = LeanBridge::Workshop::new_badge(3);
  my $reader = LeanBridge::Workshop::counter_reader(1);
  is($reader->call($counter), 42, 'returned closure borrows resource argument');
  my $named = LeanBridge::Workshop::named_counter($counter);
  is(refaddr($named->call("first")), refaddr($counter), 'closure returns original resource wrapper');
  is(LeanBridge::Workshop::inspect_with($counter, sub {
    is(refaddr($_[0]), refaddr($counter), 'Lean hands the same Perl wrapper to the callback');
    return LeanBridge::Other::value($_[0]) + 1;
  }), 42, 'callback reenters independently compiled component');
  is(LeanBridge::Workshop::exchange_with(1, $counter, sub {
    is($_[0], 1, 'resource can follow an ordinary scalar');
    return LeanBridge::Other::same($other);
  }), 77, 'Lean reads the object returned by the host');
  my $exception = bless {}, 'Probe::Failure';
  eval { LeanBridge::Workshop::exchange_with(1, $counter, sub { die $exception }) };
  is(refaddr($@), refaddr($exception), 'deferred failure preserves exact Perl exception object');
  eval { LeanBridge::Workshop::exchange_with(1, $counter, sub { $wrong }) };
  like($@, qr/wrong Lean resource/, 'wrong-kind callback reply fails after Lean cleanup');
  my $self = LeanBridge::Workshop::new_counter(12);
  eval { LeanBridge::Workshop::exchange_with(1, $self, sub { $_[1]->close; die $exception }) };
  is(refaddr($@), refaddr($exception), 'closing callback argument cannot invalidate its active Lean frame');
  ok($self->closed, 'explicit self-disposal sticks');

  my $fallback = LeanBridge::Workshop::new_counter(15);
  my $descriptor = LeanBridge::Workshop::Runtime::Callback->new(code => sub { $other }, recovery => $fallback);
  is(LeanBridge::Workshop::choose_with(1, $descriptor), 77, 'successful resource reply wins over captured recovery');
  eval { LeanBridge::Workshop::choose_with(1, sub { $counter }) };
  like($@, qr/resource-returning callback requires/, 'no same-type input: reject a callback missing recovery');
  my $calls = 0;
  eval { LeanBridge::Workshop::choose_with(1, LeanBridge::Workshop::Runtime::Callback->new(
    code => sub { ++$calls; $counter }, recovery => $wrong)) };
  like($@, qr/wrong Lean resource/, 'invalid capture rejected before registration');
  is($calls, 0, 'invalid capture never executes user code');
  my $retained = LeanBridge::Workshop::keep_factory($descriptor);
  $fallback->close;
  eval { $retained->call(1) };
  like($@, qr/expired/, 'expired host callback still has a safe recovery after wrapper disposal');
  eval { LeanBridge::Workshop::choose_with(2, $descriptor) };
  like($@, qr/closed/, 'stale recovery cannot register');
  my $throws = LeanBridge::Workshop::Runtime::Callback->new(code => sub { die $exception }, recovery => $counter);
  eval { LeanBridge::Workshop::choose_with(1, $throws) };
  is(refaddr($@), refaddr($exception), 'captured recovery does not mask the original exception');
  is(LeanBridge::Other::value($named->call("again")), 41, 'runtime and unrelated closure still usable');
  $_->close for ($retained, $named, $reader, $counter, $other, $wrong);
}
my $snapshot = LeanBridge::Runtime::_snapshot();
is($snapshot->{runtime_init_runs}, 1, 'one shared runtime');
is($snapshot->{$_}, 0, "$_ returned to baseline") for qw(live_identities live_wrappers live_scopes live_callbacks);
done_testing();
