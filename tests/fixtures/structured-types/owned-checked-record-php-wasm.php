<?php
// Independent installed PHP-Wasm consumer for owned checked records.
declare(strict_types=1);

// The host has already loaded the installed Composer or embedded autoloader.

use Brick\Math\BigInteger as Big;
use LeanOwnedCheckedRecords\{Booking, Claim, LeanBridgeError, Ticket, Window};
use function LeanOwnedCheckedRecords\{claim_closure, claim_for, echo_booking, echo_claim,
    new_ticket, pair_claim, serial, transfer_claim, with_claim_callback, with_recovery};

$checks = 0;
function check(bool $value, string $message): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException("owned checked-record PHP-Wasm check $checks: $message");
}
function rejected(callable $operation, ?int $status = null, ?string $kind = null): Throwable {
    try { $operation(); }
    catch (Throwable $error) {
        check($status === null || $error->getCode() === $status,
            "expected status $status, got {$error->getCode()}");
        check($kind === null || $error instanceof $kind,
            'unexpected rejection class ' . get_class($error));
        return $error;
    }
    throw new RuntimeException('expected Lean Bridge rejection');
}
function serial_is(Ticket $ticket, int $expected, string $message): void {
    check(serial($ticket)->isEqualTo(Big::of($expected)), $message);
}
function closed(Ticket $ticket): bool {
    try { serial($ticket); return false; }
    catch (LeanBridgeError $error) {
        if ($error->getCode() !== 4) throw $error;
        return true;
    }
}
function claim(Ticket $holder, int $quota): Claim {
    return new Claim($holder, Big::of($quota));
}
function booking(Ticket $holder, int $lo, int $hi): Booking {
    return new Booking($holder, new Window(Big::of($lo), Big::of($hi)));
}
function close_value(Claim|Booking $value): void { $value->holder->close(); }

$ticket = new_ticket(Big::of(41), "wasm\0checked");
$retained = $ticket->retain();
serial_is($ticket, 41, 'fresh resource is usable');
serial_is($retained, 41, 'explicit retain is independent');

$valid = claim($ticket, 7);
$validBooking = booking($ticket, 3, 8);
for ($index = 0; $index < 25; $index++) {
    $echoed = echo_claim($valid);
    check($echoed->quota->isEqualTo(Big::of(7)), 'owned record constructor preserves payload');
    serial_is($echoed->holder, 41, 'owned record constructor preserves resource');
    $nested = echo_booking($validBooking);
    check($nested->window->lo->isEqualTo(Big::of(3))
        && $nested->window->hi->isEqualTo(Big::of(8)), 'nested copied checked record survives');
    serial_is($nested->holder, 41, 'nested checked record preserves resource');
    close_value($echoed); close_value($nested);
}

$invalid = claim($ticket, 99);
rejected(fn() => echo_claim($invalid), 1, LeanBridgeError::class);
rejected(fn() => echo_booking(booking($ticket, 9, 2)), 1, LeanBridgeError::class);
rejected(fn() => pair_claim($validBooking, $invalid), 1, LeanBridgeError::class);
serial_is($ticket, 41, 'late failure after the first owned conversion rolls back');

$moving = new_ticket(Big::of(51), 'moving');
$kept = $moving->retain();
$refused = claim($moving, 99);
rejected(fn() => transfer_claim($refused), 1, LeanBridgeError::class);
check(!closed($moving) && !closed($refused->holder),
    'checked-record rejection happens before transfer');
serial_is($kept, 51, 'pre-handoff rejection preserves an independent retain');
$accepted = claim($moving, 9);
$moved = transfer_claim($accepted);
check(closed($moving) && closed($accepted->holder),
    'successful transfer consumes all aliases in the source owner');
serial_is($moved->holder, 51, 'transferred checked record returns a usable owner');
serial_is($kept, 51, 'successful transfer preserves an independent retain');

$calls = 0;
$reply = function(Claim $incoming) use (&$calls): Claim {
    $calls++;
    return claim($incoming->holder, 10);
};
$output = with_claim_callback($valid, with_recovery($reply, $valid));
check($calls === 1 && $output->quota->isEqualTo(Big::of(10)),
    'host callback reply runs the selected checked-record constructor');
serial_is($output->holder, 41, 'host callback reply owns its resource result');
close_value($output);
rejected(fn() => with_claim_callback($valid, with_recovery($reply, $invalid)),
    1, LeanBridgeError::class);
check($calls === 1, 'invalid recovery prevents callback entry');
rejected(fn() => with_claim_callback($valid,
    with_recovery(fn(Claim $incoming) => claim($incoming->holder, 99), $valid)),
    1, LeanBridgeError::class);
serial_is($ticket, 41, 'late callback-result rejection releases partial output');
$sentinel = new RuntimeException('php-wasm checked-record callback');
$held = rejected(fn() => with_claim_callback($valid,
    with_recovery(function(Claim $_incoming) use ($sentinel) { throw $sentinel; }, $valid)),
    null, RuntimeException::class);
check($held === $sentinel, 'callback exception identity survives cleanup');

$closure = claim_closure();
$value = $closure($valid);
check($value->quota->isEqualTo(Big::of(7)), 'returned Lean closure validates a host claim');
serial_is($value->holder, 41, 'returned closure result owns its resource');
close_value($value);
rejected(fn() => $closure($invalid), 1, LeanBridgeError::class);
$value = $closure(claim($ticket, 6));
check($value->quota->isEqualTo(Big::of(6)), 'returned closure recovers after rejection');
close_value($value); $closure->close(); $closure->close();

$produced = claim_for($retained);
check($produced !== null && $produced->value->quota->isEqualTo(Big::zero()),
    'Lean-produced checked record is proof-free');
serial_is($produced->value->holder, 41, 'Lean-produced checked record owns its resource');
close_value($produced->value);

$abandoned = new_ticket(Big::of(62), 'finalized');
$survivor = $abandoned->retain();
$weak = WeakReference::create($abandoned);
unset($abandoned); gc_collect_cycles();
check($weak->get() === null, 'garbage collection reaches an abandoned owner');
serial_is($survivor, 62, 'queued finalizer preserves an independent retain');

close_value($moved); $survivor->close();
$ticket->close(); $retained->close(); $moving->close(); $kept->close();
check(closed($ticket) && closed($retained) && closed($kept),
    'explicit cleanup closes every retained identity');

echo json_encode([
    'checks' => $checks,
    'ownedCheckedRecord' => true,
    'mode' => 'full',
    'heldOriginalError' => $held === $sentinel,
    'ordinaryAutoload' => true,
    'phpBits' => PHP_INT_SIZE * 8,
], JSON_THROW_ON_ERROR), "\n";
