<?php
// Independent installed PHP-Wasm consumer for owned checked records.
declare(strict_types=1);

// The host has already loaded the installed Composer or embedded autoloader.

use Brick\Math\BigInteger as Big;
use LeanOwnedCheckedRecords\{Booking, Claim, Grant, LeanBridgeError, Ticket, Window};
use function LeanOwnedCheckedRecords\{booking_span, claim_closure, claim_for, claim_quota,
    echo_booking, echo_claim, echo_claims, echo_grant, new_ticket, pair_claim, serial,
    transfer_claim, transfer_pair_claim, transfer_with_claim_callback, with_claim_callback, with_recovery};

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
function close_value(Claim|Booking|Grant $value): void { $value->holder->close(); }

function post_transfer(bool $throws): void {
    $input = new_ticket(Big::of(91), 'post-transfer');
    $independent = $input->retain();
    $transferred = claim($input, 7); $entered = 0; $output = null;
    $sentinel = new RuntimeException('php-wasm post-transfer callback');
    $reply = function(Claim $incoming) use (&$entered, $throws, $sentinel): Claim {
        $entered++;
        check($incoming->quota->isEqualTo(Big::of(7)), 'post-transfer callback input');
        if ($throws) throw $sentinel;
        return claim($incoming->holder, 99);
    };
    $callback = with_recovery($reply, claim($independent, 7));
    $operation = function() use (&$output, $transferred, $callback): void {
        $output = transfer_with_claim_callback($transferred, $callback);
    };
    if ($throws) {
        check(rejected($operation, null, RuntimeException::class) === $sentinel,
            'post-transfer callback exception identity');
    } else {
        rejected($operation, 1, LeanBridgeError::class);
    }
    check($output === null && $entered === 1 && closed($input) && closed($transferred->holder),
        'post-transfer failure consumes input without publishing output');
    serial_is($independent, 91, 'post-transfer failure preserves an independent retain');
    $recovered = transfer_with_claim_callback(claim($independent, 7), with_recovery(
        fn(Claim $incoming) => claim($incoming->holder, 9), claim($independent, 7)));
    check(closed($independent) && $recovered->quota->isEqualTo(Big::of(9)),
        'post-transfer failure recovers');
    serial_is($recovered->holder, 91, 'recovered transfer resource');
    close_value($recovered); $input->close(); $independent->close();
}

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

$invalidBooking = booking($ticket, 8, 3);
for ($index = 0; $index < 10; $index++) {
    rejected(fn() => echo_booking($invalidBooking), 1, LeanBridgeError::class);
    check($invalidBooking->window->lo->isEqualTo(Big::of(8))
        && $invalidBooking->window->hi->isEqualTo(Big::of(3)),
        'nested copied rejection preserves input fields');
    serial_is($invalidBooking->holder, 41, 'nested copied rejection preserves owner');
}
$equalBooking = echo_booking(booking($ticket, 3, 3));
check($equalBooking->window->lo->isEqualTo(Big::of(3))
    && $equalBooking->window->hi->isEqualTo(Big::of(3)), 'nested copied equality and recovery');
serial_is($equalBooking->holder, 41, 'nested copied recovery resource');
close_value($equalBooking);
check(booking_span($validBooking)->isEqualTo(Big::of(5)), 'copied payload consumed');
check(claim_quota($valid)->isEqualTo(Big::of(7)), 'owned payload consumed');

$grant = echo_grant(new Grant($ticket, Big::of(7), Big::of(8)));
check($grant->weight->isEqualTo(Big::of(7)) && $grant->limit->isEqualTo(Big::of(8)),
    'nested Subtype and outer record accepted');
serial_is($grant->holder, 41, 'grant resource'); close_value($grant);
rejected(fn() => echo_grant(new Grant($ticket, Big::of(0), Big::of(8))), 1, LeanBridgeError::class);
rejected(fn() => echo_grant(new Grant($ticket, Big::of(7), Big::of(3))), 1, LeanBridgeError::class);
serial_is($ticket, 41, 'both grant rejections preserve owner');

$claims = echo_claims([$valid, $valid]);
check(count($claims) === 2 && $claims[0]->quota->isEqualTo(Big::of(7))
    && $claims[1]->quota->isEqualTo(Big::of(7)), 'owned array');
close_value($claims[0]);
serial_is($claims[1]->holder, 41, 'array element owners are independent');
close_value($claims[1]);
for ($index = 0; $index < 10; $index++) {
    $partial = null;
    rejected(function() use (&$partial, $valid, $ticket): void {
        $partial = echo_claims([$valid, claim($ticket, 99)]);
    }, 1, LeanBridgeError::class);
    check($partial === null && !closed($ticket), 'late array rejection publishes no partial result');
}
check(echo_claims([]) === [], 'empty owned array');
$arrayRecovery = echo_claims([$valid]);
check(count($arrayRecovery) === 1 && $arrayRecovery[0]->quota->isEqualTo(Big::of(7)), 'array recovery');
close_value($arrayRecovery[0]);

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

$first = new_ticket(Big::of(71), 'first'); $second = new_ticket(Big::of(81), 'second');
$firstKept = $first->retain(); $secondKept = $second->retain();
$firstInput = booking($first, 3, 8); $secondInput = claim($second, 99);
rejected(fn() => transfer_pair_claim($firstInput, $secondInput), 1, LeanBridgeError::class);
check(!closed($first) && !closed($second), 'late failure aborts both transfers');
serial_is($first, 71, 'first rejected transfer intact');
serial_is($second, 81, 'second rejected transfer intact');
$pair = transfer_pair_claim($firstInput, claim($second, 7));
check(closed($first) && closed($second) && $pair->quota->isEqualTo(Big::of(7)), 'both transfers commit');
serial_is($pair->holder, 81, 'pair transfer result');
serial_is($firstKept, 71, 'first independent retain survives');
serial_is($secondKept, 81, 'second independent retain survives');
close_value($pair); $first->close(); $second->close(); $firstKept->close(); $secondKept->close();
post_transfer(false); post_transfer(true);

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
