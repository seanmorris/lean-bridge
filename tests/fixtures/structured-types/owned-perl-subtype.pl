use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed reftype);
use LeanBridge::OwnedProbe;

my $checks = 0;
sub check {
  CORE::die "owned Subtype Perl check " . ($checks + 1) . ": $_[1]\n" unless $_[0];
  ++$checks;
}
sub invoke {
  my ($name, @arguments) = @_;
  no strict 'refs';
  return &{'LeanBridge::OwnedProbe::' . $name}(@arguments);
}
sub rejected {
  my ($operation) = @_;
  my $ok = eval { $operation->(); 1 };
  my $error = $@;
  check(!$ok && $error =~ /status=1.*invalid argument/i, "expected checked-constructor rejection; got $error");
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
sub release { $_->close for resources($_[0]); }
sub payload {
  my ($count) = @_;
  return LeanBridge::OwnedProbe::Payload->new(
    count => Math::BigInt->new($count), bytes => "\0\xff"
  );
}
sub bundle {
  my ($ticket, $count) = @_;
  return LeanBridge::OwnedProbe::Bundle->new(
    primary => $ticket, spare => undef, peers => [$ticket], history => [$ticket],
    payload => payload($count)
  );
}
sub callback_bundle {
  my ($ticket, $count) = @_;
  return LeanBridge::OwnedProbe::CallbackBundle->new(
    primary => $ticket,
    payload => LeanBridge::OwnedProbe::CallbackPayload->new(
      count => Math::BigInt->new($count), bytes => "\0\xff"
    )
  );
}
sub serial_is {
  my ($ticket, $expected, $message) = @_;
  check(invoke('serial', $ticket)->bcmp($expected) == 0, $message);
}

my $baseline = LeanBridge::Runtime::_snapshot()->{live_identities};
my $ticket = invoke('new_ticket', Math::BigInt->new(41), "perl\0checked");
my $retained = $ticket->retain;
serial_is($ticket, 41, 'fresh resource is usable');
serial_is($retained, 41, 'explicit retain is independent');

my $valid = bundle($ticket, 7);
my $callback_calls = 0;
my $callback_result = invoke('callback_record', callback_bundle($ticket, 7), sub {
  my ($incoming) = @_; ++$callback_calls; return $incoming;
});
check($callback_calls == 1, 'host callback executes beside checked constructors');
check($callback_result->payload->count->bcmp(7) == 0,
  'host callback preserves its separately erased aggregate');
serial_is($callback_result->primary, 41, 'host callback preserves the resource');
release($callback_result);
for (1 .. 12) {
  my $echoed = invoke('echo_record', $valid);
  check($echoed->payload->count->bcmp(7) == 0, 'selected constructor accepts a valid value');
  serial_is($echoed->primary, 41, 'selected constructor preserves the resource');
  my $alternate = invoke('echo_record_alternate', $valid);
  check($alternate->payload->bytes eq "\0\xff", 'alternate constructor preserves bytes');
  serial_is($alternate->primary, 41, 'alternate constructor preserves the resource');
  release($echoed); release($alternate);
}
check(!$ticket->closed, 'borrowed calls do not consume the input owner');

my $invalid = bundle($ticket, -1);
rejected(sub { invoke('echo_record', $invalid) });
rejected(sub { invoke('echo_record_alternate', $invalid) });
check(!$ticket->closed, 'borrowed rejection preserves the input owner');
serial_is($ticket, 41, 'borrowed rejection leaves the resource usable');

my $moving = invoke('new_ticket', Math::BigInt->new(51), 'moving');
my $kept = $moving->retain;
rejected(sub { invoke('transfer_record', bundle($moving, -1)) });
check(!$moving->closed, 'transfer rejection happens before ownership movement');
serial_is($moving, 51, 'rejected transfer leaves the original usable');
serial_is($kept, 51, 'rejected transfer leaves the retain usable');

my $moved = invoke('transfer_record', bundle($moving, 9));
check($moving->closed, 'successful transfer consumes the selected owner');
serial_is($kept, 51, 'successful transfer preserves an independent retain');
check($moved->payload->count->bcmp(9) == 0, 'successful transfer preserves the checked field');
serial_is($moved->primary, 51, 'successful transfer returns a usable resource');

my $before_abandon = LeanBridge::Runtime::_snapshot()->{live_identities};
my $abandoned = invoke('new_ticket', Math::BigInt->new(61), 'abandoned');
my $destruction_survivor = $abandoned->retain;
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $before_abandon + 1,
  'abandoned owner creates one native identity');
undef $abandoned;
serial_is($destruction_survivor, 61,
  'implicit destruction preserves an independent retain');
$destruction_survivor->close;
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $before_abandon,
  'implicit destruction and final close restore the identity baseline');
serial_is($ticket, 41, 'runtime remains usable after implicit destruction');

release($valid); release($invalid); release($moved);
$ticket->close; $retained->close; $moving->close; $kept->close;
check($ticket->closed && $retained->closed && $moving->closed && $kept->closed,
  'cleanup is explicit and idempotent');
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $baseline,
  'all native identities return to the baseline');

print JSON::PP->new->canonical->encode({
  checks => $checks,
  borrowed_rejection_preserved => JSON::PP::true,
  transfer_rejection_preserved => JSON::PP::true,
  successful_transfer_consumed => JSON::PP::true,
  implicit_destruction_released => JSON::PP::true,
  live_identities => $baseline,
}), "\n";
