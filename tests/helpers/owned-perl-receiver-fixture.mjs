/**
 * Receiver probes separate whole owners from optional anchor/callback features.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Preserve the full predecessor lifetime suite alongside nominal members. */
export const ownedPerlReceiverProbe = async () => {
	const original = await readFile("tests/fixtures/structured-types/owned-perl-borrows.pl", "utf8");
	const members = await readFile("tests/fixtures/structured-types/owned-perl-receivers.pl", "utf8");
	const marker = "my $empty = snapshot();";
	assert.equal(original.split(marker).length, 2);
	return original.replace(marker, members + "\n" + marker + "\nreceiver_members(); balanced($empty);");
};

const common = `use strict; use warnings;
use JSON::PP; use Math::BigInt; use Config;
use LeanBridge::OwnedProbe;
my $checks = 0;
my $installed = @ARGV && $ARGV[0] eq '--installed';
sub check { die 'receiver check ' . ($checks + 1) . ": $_[1]\\n" unless $_[0]; ++$checks }
sub rejected {
    my ($call, $pattern) = @_;
    my $ok = eval { $call->(); 1 }; my $error = $@;
    check(!$ok && $error =~ $pattern, "expected $pattern; got $error");
}
sub ticket { LeanBridge::OwnedProbe::new_ticket(Math::BigInt->new(42), 'receiver') }
sub finish {
    LeanBridge::OwnedProbe::Runtime::shutdown();
    my @state = $installed ? (0, 0, LeanBridge::Runtime::_snapshot()->{live_identities}, 0, 0, 0, 0, 0)
        : LeanBridge::OwnedProbe::snapshot();
    check(!(grep { $_ } @state[0..3,6,7]), 'zero owners and identities');
    print JSON::PP->new->canonical->encode({checks => $checks,
        $installed ? (brokerIdentities => $state[2]) : (live => $state[1], identities => $state[2], managedLive => $state[0]),
        perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0});
}
`;

/**
 * Resource-only calls include raw and whole receivers and optional consumption.
 *
 * @param consuming - Enable original-owner transfer without result anchors.
 */
export const ownedPerlPlainReceiverProbe = consuming => `${common}
{
    my $root = ticket();
    check(ref($root) eq 'LeanBridge::OwnedProbe::TicketValue', 'nominal owner');
    check($root->serial->bcmp(42) == 0 && $root->get->serial->bcmp(42) == 0, 'whole and raw properties');
    rejected(sub { $root->serial(1) }, qr/serial expects 1 arguments/);
    my $alias = $root->share;
    my $independent = $root->retain_ticket;
    my $raw_copy = $root->get->retain_ticket;
    my $copied = LeanBridge::OwnedProbe::copy_value($root);
    check(!(grep { ref($_) ne 'LeanBridge::OwnedProbe::TicketValue' } ($alias, $independent, $raw_copy, $copied)), 'nominal copies');
    $root->close;
    check($root->closed && $alias->serial->bcmp(42) == 0, 'share retains original owner');
    $alias->close;
    check($independent->serial->bcmp(42) == 0 && $raw_copy->serial->bcmp(42) == 0 && $copied->serial->bcmp(42) == 0, 'lease results do not borrow receiver');
    rejected(sub { $root->serial }, qr/status=4/);
    ${consuming ? `my $old = $independent->share;
    my $moved = $independent->transfer_ticket;
    check($independent->closed && $old->closed, 'consumption closes original aliases');
    check($moved->serial->bcmp(42) == 0, 'transferred receiver result');
    check(!$moved->get->can('transfer_ticket'), 'raw receiver cannot transfer owner');
    $old->close; $moved->close;` : ""}
    $_->close for ($root, $alias, $independent, $raw_copy, $copied);
}
finish();
`;

/** Callbacks and returned closures preserve nominal results without anchors. */
export const ownedPerlUnanchoredReceiverProbe = `${common}
sub bundle {
    LeanBridge::OwnedProbe::Bundle->new(primary => $_[0], spare => undef, peers => [], history => [],
        payload => LeanBridge::OwnedProbe::Payload->new(count => Math::BigInt->new(1), bytes => ''));
}
{
    my $seed = ticket();
    my $record = LeanBridge::OwnedProbe::copy_value(bundle($seed->get));
    my $escaped;
    my $response = $record->callback_record(sub {
        $escaped = $_[0]->primary;
        check($escaped->serial->bcmp(42) == 0, 'raw callback member');
        return $_[0];
    });
    check($escaped->closed, 'callback frame expires');
    rejected(sub { $escaped->serial }, qr/closed|expired|status=4/);
    my $closure = $record->make_record;
    my $reply = $closure->call(LeanBridge::OwnedProbe::false, bundle($seed->get));
    check(ref($response) eq 'LeanBridge::OwnedProbe::BundleValue' && ref($reply) eq 'LeanBridge::OwnedProbe::BundleValue', 'nominal callback and closure results');
    my $primary = $reply->primary;
    check($primary->serial->bcmp(42) == 0, 'returned member is callable');
    $seed->close; $record->close;
    check(!$response->closed && $response->get->primary->serial->bcmp(42) == 0, 'callback reply owns its result');
    check(!$closure->closed && !$reply->closed && $primary->serial->bcmp(42) == 0, 'closure and member survive original receiver');
    my $repeated = $closure->call(LeanBridge::OwnedProbe::false, $response->get);
    check($repeated->get->primary->serial->bcmp(42) == 0, 'retained closure environment');
    $_->close for ($seed, $record, $response, $escaped, $closure, $reply, $primary, $repeated);
}
finish();
`;
