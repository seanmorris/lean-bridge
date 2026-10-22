<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanOwnedSubtypes\{Bundle, Bytes, LeanBridgeError, Payload, Ticket};
use function LeanOwnedSubtypes\{echo_record, echo_record_alternate, new_ticket, transfer_record};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$refused = function (callable $call) use ($check): void {
    try { $call(); }
    catch (LeanBridgeError $error) {
        $check($error->getCode() === 1, 'owned Subtype refusal status');
        return;
    }
    throw new RuntimeException('expected owned Subtype refusal');
};
$bundle = fn(Ticket $ticket, int $count) => new Bundle(
    $ticket, null, [], [], new Payload(BigInteger::of($count), Bytes::fromString("\x00\xff"))
);
$release = function (Bundle $value): void { $value->primary->close(); };

$ticket = new_ticket(BigInteger::of(41), 'entry-primary');
$check($ticket instanceof Ticket, 'setup owner');
$echoed = echo_record($bundle($ticket, 7));
$check($echoed->payload->count->isEqualTo(BigInteger::of(7)), 'borrow valid');
$release($echoed);
$refused(fn() => echo_record($bundle($ticket, -1)));
$echoed = echo_record($bundle($ticket, 8));
$check($echoed->payload->count->isEqualTo(BigInteger::of(8)), 'borrow recovery');
$release($echoed);
$alternate = echo_record_alternate($bundle($ticket, 9));
$check($alternate->payload->count->isEqualTo(BigInteger::of(9)), 'alternate valid');
$release($alternate);
$refused(fn() => echo_record_alternate($bundle($ticket, -2)));

$moving = new_ticket(BigInteger::of(51), 'entry-transfer');
$check($moving instanceof Ticket, 'setup transfer owner');
$refused(fn() => transfer_record($bundle($moving, -3)));
$moved = transfer_record($bundle($moving, 10));
$check($moved->payload->count->isEqualTo(BigInteger::of(10)), 'transfer accepted');
$release($moved);
$ticket->close(); $moving->close();

echo json_encode([
    'checks' => $checks, 'family' => 'owned-subtype',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
