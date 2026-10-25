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
sub grant {
  LeanBridge::OwnedCheckedRecords::Grant->new(
    holder => $_[0], weight => n($_[1]), limit => n($_[2]));
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
check(invoke('booking_span', $valid_booking)->bcmp(5) == 0, 'copied payload consumed');
check(invoke('claim_quota', $valid)->bcmp(7) == 0, 'owned payload consumed');
my $grant = invoke('echo_grant', grant($ticket, 7, 8));
check($grant->weight->bcmp(7) == 0 && $grant->limit->bcmp(8) == 0,
  'nested Subtype and outer checked record accepted');
serial_is($grant->holder, 41, 'grant retains resource'); release($grant);
rejected(sub { invoke('echo_grant', grant($ticket, 0, 8)) }, 1);
rejected(sub { invoke('echo_grant', grant($ticket, 7, 3)) }, 1);
my $claims = invoke('echo_claims', [$valid, $valid]);
check(@$claims == 2 && $claims->[1]->quota->bcmp(7) == 0,
  'owned checked-record array round trips');
serial_is($claims->[0]->holder, 41, 'array retains resource'); release($claims);
for (1 .. 10) {
  rejected(sub { invoke('echo_claims', [$valid, claim($ticket, 99)]) }, 1);
  check(!$ticket->closed, 'later array rejection preserves owner');
}
my $empty = invoke('echo_claims', []);
check(@$empty == 0, 'empty owned array');
my $array_recovery = invoke('echo_claims', [$valid]);
check(@$array_recovery == 1, 'array rejection recovers'); release($array_recovery);

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

my $first = invoke('new_ticket', n(61), 'first');
my $second = invoke('new_ticket', n(71), 'second');
my $first_kept = $first->retain; my $second_kept = $second->retain;
my $moving_booking = booking($first, 3, 8);
my $moving_claim = claim($second, 99);
rejected(sub { invoke('transfer_pair_claim', $moving_booking, $moving_claim) }, 1);
check(!$first->closed && !$second->closed, 'late failure aborts both transfers');
serial_is($first, 61, 'first rejected transfer intact');
serial_is($second, 71, 'second rejected transfer intact');
my $pair = invoke('transfer_pair_claim', $moving_booking, claim($second, 7));
check($first->closed && $second->closed && $pair->quota->bcmp(7) == 0,
  'both transfers commit together');
serial_is($first_kept, 61, 'first independent retain survives');
serial_is($second_kept, 71, 'second independent retain survives');
release($pair); $first_kept->close; $second_kept->close;

for my $throws (0, 1) {
  my $input = invoke('new_ticket', n(81), 'post-transfer');
  my $independent = $input->retain;
  my $transferred = claim($input, 7);
  my $entered = 0;
  my $sentinel = bless({message => 'post-transfer'}, 'OwnedCheckedTransferError');
  my $callback = descriptor(sub {
    my ($incoming) = @_; ++$entered;
    die $sentinel if $throws;
    return claim($incoming->holder, 99);
  }, claim($independent, 7));
  if($throws) {
    eval { invoke('transfer_with_claim_callback', $transferred, $callback); 1 };
    my $error = $@;
    check(ref($error) && refaddr($error) == refaddr($sentinel),
      'post-transfer callback exception identity preserved');
  } else {
    rejected(sub { invoke('transfer_with_claim_callback', $transferred, $callback) }, 1);
  }
  check($entered == 1 && $input->closed, 'failure after transfer consumes input');
  serial_is($independent, 81, 'post-transfer failure preserves independent retain');
  my $recover = descriptor(sub {
    my ($incoming) = @_; return claim($incoming->holder, 9);
  }, claim($independent, 7));
  my $recovered = invoke('transfer_with_claim_callback', claim($independent, 7), $recover);
  check($independent->closed && $recovered->quota->bcmp(9) == 0,
    'post-transfer callback failure recovers on next call');
  serial_is($recovered->holder, 81, 'recovered transfer resource is usable');
  release($recovered);
}

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
