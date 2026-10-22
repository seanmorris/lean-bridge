<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanOwnedCheckedRecords\{Booking, Claim, Grant, LeanBridgeError, Ticket, Window};
use function LeanOwnedCheckedRecords\{echo_booking, echo_claim, echo_grant, new_ticket,
    pair_claim, transfer_claim};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$refused = function (callable $call) use ($check): void {
    try { $call(); }
    catch (LeanBridgeError $error) {
        $check($error->getCode() === 1, 'owned checked-record refusal status');
        return;
    }
    throw new RuntimeException('expected owned checked-record refusal');
};
$booking = fn(Ticket $ticket, int $lo, int $hi) => new Booking(
    $ticket, new Window(BigInteger::of($lo), BigInteger::of($hi))
);
$claim = fn(Ticket $ticket, int $quota) => new Claim($ticket, BigInteger::of($quota));
$grant = fn(Ticket $ticket, int $weight, int $limit) => new Grant(
    $ticket, BigInteger::of($weight), BigInteger::of($limit)
);
$release = function (Booking|Claim|Grant $value): void { $value->holder->close(); };

$ticket = new_ticket(BigInteger::of(41), 'entry-holder');
$check($ticket instanceof Ticket, 'setup owner');
$value = echo_booking($booking($ticket, 3, 8));
$check($value->window->hi->isEqualTo(BigInteger::of(8)), 'booking valid');
$release($value);
$refused(fn() => echo_booking($booking($ticket, 9, 2)));
$value = echo_claim($claim($ticket, 7));
$check($value->quota->isEqualTo(BigInteger::of(7)), 'claim valid');
$release($value);
$refused(fn() => echo_claim($claim($ticket, 99)));
$value = echo_claim($claim($ticket, 8));
$check($value->quota->isEqualTo(BigInteger::of(8)), 'claim recovery');
$release($value);
$validBooking = $booking($ticket, 2, 6);
$value = pair_claim($validBooking, $claim($ticket, 9));
$check($value->quota->isEqualTo(BigInteger::of(9)), 'pair valid');
$release($value);
$refused(fn() => pair_claim($validBooking, $claim($ticket, 99)));
$value = echo_grant($grant($ticket, 3, 6));
$check($value->weight->isEqualTo(BigInteger::of(3)), 'grant valid');
$release($value);
$refused(fn() => echo_grant($grant($ticket, 0, 6)));
$refused(fn() => echo_grant($grant($ticket, 7, 6)));

$moving = new_ticket(BigInteger::of(51), 'entry-transfer');
$check($moving instanceof Ticket, 'setup transfer owner');
$refused(fn() => transfer_claim($claim($moving, 99)));
$moved = transfer_claim($claim($moving, 10));
$check($moved->quota->isEqualTo(BigInteger::of(10)), 'transfer accepted');
$release($moved);
$ticket->close(); $moving->close();

echo json_encode([
    'checks' => $checks, 'family' => 'owned-checked-record',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
