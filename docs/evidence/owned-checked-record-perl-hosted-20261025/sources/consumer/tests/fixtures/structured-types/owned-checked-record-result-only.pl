use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use LeanBridge::OwnedCheckedRecords;

my $checks = 0;
sub check { die "owned checked-record result-only Perl check\n" unless $_[0]; ++$checks }
sub invoke {
  my ($name, @arguments) = @_;
  my $function = LeanBridge::OwnedCheckedRecords->can($name);
  check($function, "public export $name"); return $function->(@arguments);
}
my $baseline = LeanBridge::Runtime::_snapshot()->{live_identities};
my $ticket = invoke('new_ticket', Math::BigInt->new(20), 'result-only');
my $produced = invoke('claim_for', $ticket);
check(ref($produced) eq 'LeanBridge::OwnedCheckedRecords::Some');
check($produced->value->quota->bcmp(0) == 0);
check(invoke('serial', $produced->value->holder)->bcmp(20) == 0);
check(!LeanBridge::OwnedCheckedRecords->can('echo_claim'));
$produced->value->holder->close; $ticket->close;
check($ticket->closed);
check(LeanBridge::Runtime::_snapshot()->{live_identities} == $baseline);
print JSON::PP->new->canonical->encode({checks => $checks, result_only => JSON::PP::true}), "\n";
