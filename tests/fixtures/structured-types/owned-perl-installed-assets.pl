use strict;
use warnings;
use Math::BigInt;
use JSON::PP;
use LeanBridge::Runtime;

my ($mode, $target, $replacement, @libraries) = @ARGV;
die "Invalid installed asset mode\n" unless $mode eq 'cold' || $mode eq 'warm';
my $checks = 0;
sub check { die "asset check " . ($checks + 1) . ": $_[1]\n" unless $_[0]; ++$checks; }
check(LeanBridge::Runtime::_snapshot()->{live_identities} == 0, 'empty shared broker');
if ($mode eq 'warm') {
    require LeanBridge::OwnedProbe;
    check(LeanBridge::Runtime::_snapshot()->{live_identities} == 1, 'live installed ownership session');
    delete $INC{'LeanBridge/OwnedProbe.pm'};
}
# Replace the inode rather than truncating a library already mapped by the warm process.
rename $replacement, $target or die "Cannot replace test-owned artifact: $!\n";
my ($loaded, $error);
{
    local $SIG{__WARN__} = sub { die $_[0] unless $_[0] =~ /\ASubroutine .* redefined at /; };
    $loaded = eval { require LeanBridge::OwnedProbe; 1 };
    $error = $@;
}
check(!$loaded, 'tampered installed package rejected');
check(index($error, 'Owned native artifact checksum mismatch: ' . $target) >= 0,
    'immutable generated digest rejects the changed native file: ' . $error);
if ($mode eq 'warm') {
    my $ticket = LeanBridge::OwnedProbe::new_ticket(Math::BigInt->new(7), 'still usable');
    check(!$ticket->closed(), 'the already authenticated native mapping remains usable');
    $ticket->close(); undef $ticket;
    check(LeanBridge::Runtime::_snapshot()->{live_identities} == 1, 'rejection leaves no new owners');
    LeanBridge::OwnedProbe::Runtime::shutdown();
} else {
    for my $library (@libraries) {
        check(!defined LeanBridge::Runtime::_mapped_library($library), 'all assets checked before any component dependency is mapped');
    }
}
check(LeanBridge::Runtime::_snapshot()->{live_identities} == 0, 'no leaked broker identities');
print encode_json({mode => $mode, checks => $checks, brokerIdentities => 0});
