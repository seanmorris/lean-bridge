use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed reftype refaddr);
use LeanBridge::OwnedCheckedRecords;

my $checks = 0;
sub check {
  CORE::die "owned checked-record Perl check " . ($checks + 1) . ": $_[1]\n"
    unless $_[0];
  ++$checks;
}
sub n { Math::BigInt->new($_[0]) }
sub invoke {
  my ($name, @arguments) = @_;
  my $function = LeanBridge::OwnedCheckedRecords->can($name);
  check($function, "public export $name"); return $function->(@arguments);
}
sub rejected {
  my ($operation, $status) = @_;
  my $ok = eval { $operation->(); 1 }; my $error = $@;
  check(!$ok && "$error" =~ /status=$status\b/i,
    "expected native status $status; got $error");
  return $error;
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
sub release { $_->close for resources($_[0]) }
sub claim {
  LeanBridge::OwnedCheckedRecords::Claim->new(
    holder => $_[0], quota => n($_[1]));
}
sub booking {
  LeanBridge::OwnedCheckedRecords::Booking->new(
    holder => $_[0], window => LeanBridge::OwnedCheckedRecords::Window->new(
      lo => n($_[1]), hi => n($_[2])));
}
sub serial_is {
  check(invoke('serial', $_[0])->bcmp($_[1]) == 0, $_[2]);
}
sub descriptor {
  LeanBridge::OwnedCheckedRecords::Runtime::Callback->new(
    code => $_[0], recovery => $_[1]);
}

my $baseline = LeanBridge::Runtime::_snapshot()->{live_identities};
my $ticket = invoke('new_ticket', n(41), "perl\0checked");
my $retained = $ticket->retain;
serial_is($ticket, 41, 'fresh ticket');
serial_is($retained, 41, 'explicit retain');
my $valid = claim($ticket, 7);
my $valid_booking = booking($ticket, 3, 8);
my $echoed = invoke('echo_claim', $valid);
check($echoed->quota->bcmp(7) == 0, 'valid claim accepted');
serial_is($echoed->holder, 41, 'claim resource retained');
my $echoed_booking = invoke('echo_booking', $valid_booking);
check($echoed_booking->window->hi->bcmp(8) == 0, 'nested copied record accepted');
serial_is($echoed_booking->holder, 41, 'booking resource retained');
release($echoed); release($echoed_booking);

my $invalid = claim($ticket, 99);
rejected(sub { invoke('echo_claim', $invalid) }, 1);
rejected(sub { invoke('pair_claim', $valid_booking, $invalid) }, 1);
check(!$ticket->closed, 'early and late borrowed rejection preserve the owner');
serial_is($ticket, 41, 'borrowed rejection recovers');

my $moving = invoke('new_ticket', n(51), 'moving');
my $kept = $moving->retain;
rejected(sub { invoke('transfer_claim', claim($moving, 99)) }, 1);
check(!$moving->closed, 'transfer rejection precedes movement');
serial_is($moving, 51, 'rejected transfer preserves input');
serial_is($kept, 51, 'rejected transfer preserves retain');
my $moved = invoke('transfer_claim', claim($moving, 9));
check($moving->closed, 'successful transfer consumes input');
check($moved->quota->bcmp(9) == 0, 'successful transfer preserves payload');
serial_is($moved->holder, 51, 'transferred result is usable');
serial_is($kept, 51, 'independent retain survives transfer');

my $calls = 0;
my $host = descriptor(sub {
  my ($incoming) = @_; ++$calls;
  check($incoming->quota->bcmp(7) == 0, 'callback receives proof-free claim');
  return claim($incoming->holder, 10);
}, $valid);
my $callback_result = invoke('with_claim_callback', $valid, $host);
check($calls == 1 && $callback_result->quota->bcmp(10) == 0,
  'valid host reply accepted');
serial_is($callback_result->holder, 41, 'host reply resource retained');
release($callback_result);
my $invalid_host = descriptor(sub {
  my ($incoming) = @_; ++$calls; return claim($incoming->holder, 99);
}, $valid);
rejected(sub { invoke('with_claim_callback', $valid, $invalid_host) }, 1);
check($calls == 2, 'invalid host reply executes exactly once');
serial_is($ticket, 41, 'invalid host reply recovers');
my $sentinel = bless({message => 'callback failed'}, 'OwnedCheckedCallbackError');
eval {
  invoke('with_claim_callback', $valid
    , descriptor(sub { die $sentinel }, $valid)); undef
};
my $thrown = $@;
check(ref($thrown) && refaddr($thrown) == refaddr($sentinel),
  'callback exception identity preserved');
serial_is($ticket, 41, 'thrown callback recovers');

my $closure = invoke('claim_closure');
my $from_closure = $closure->call($valid);
check($from_closure->quota->bcmp(7) == 0, 'returned closure accepts claim');
serial_is($from_closure->holder, 41, 'closure result resource retained');
release($from_closure);
rejected(sub { $closure->call($invalid) }, 1);
my $reused = $closure->call(claim($ticket, 6));
check($reused->quota->bcmp(6) == 0, 'returned closure recovers and reuses');
release($reused); $closure->close; check($closure->closed, 'closure closes');

my $produced = invoke('claim_for', $retained);
check(blessed($produced) && $produced->isa('LeanBridge::OwnedCheckedRecords::Some'),
  'Lean-produced claim is present');
check($produced->value->quota->bcmp(0) == 0, 'Lean-produced claim erases proof');
serial_is($produced->value->holder, 41, 'Lean-produced claim retains resource');
release($produced);

release($valid); release($invalid); release($valid_booking); release($moved);
$ticket->close; $retained->close; $moving->close; $kept->close;
check($ticket->closed && $retained->closed && $moving->closed && $kept->closed,
  'explicit cleanup is idempotent');
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $baseline,
  'all native identities return to baseline');

print JSON::PP->new->canonical->encode({
  checks => $checks, callback_calls => $calls,
  borrowed_rejection_preserved => JSON::PP::true,
  transfer_rejection_preserved => JSON::PP::true,
  successful_transfer_consumed => JSON::PP::true,
  callback_recovered => JSON::PP::true,
  closure_reused => JSON::PP::true,
  live_identities => $baseline,
}), "\n";
