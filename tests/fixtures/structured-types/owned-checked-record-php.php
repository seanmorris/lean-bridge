<?php
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedCheckedRecords\{Booking, Claim, Grant, LeanBridgeError, Ticket, Window};
use LeanOwnedCheckedRecords\Internal\ResourceAccess;
use function LeanOwnedCheckedRecords\{booking_span, claim_closure, claim_for, claim_quota,
    echo_booking, echo_claim, echo_claims, echo_grant, new_ticket, pair_claim, serial,
    transfer_claim, transfer_pair_claim, transfer_with_claim_callback, with_claim_callback, with_recovery};

$checks = 0;
function check(bool $value, string $message): void {
    global $checks; $checks++; if (!$value) throw new RuntimeException("owned checked-record PHP check $checks: $message");
}
function rejected(callable $operation, string $kind = LeanBridgeError::class): Throwable {
    try { $operation(); } catch (Throwable $error) {
        if ($error instanceof $kind) return $error;
        throw new RuntimeException('wrong rejection: ' . get_class($error), 0, $error);
    }
    throw new RuntimeException("expected $kind");
}
function resource_closed(Ticket $value): bool {
    try { ResourceAccess::binding($value); return false; }
    catch (LeanBridgeError $error) { if ($error->getCode() !== 4) throw $error; return true; }
}
function serial_is(Ticket $value, int $expected, string $message): void {
    check(serial($value)->isEqualTo(Big::of($expected)), $message);
}
function claim(Ticket $holder, int $quota): Claim { return new Claim($holder, Big::of($quota)); }
function booking(Ticket $holder, int $lo, int $hi): Booking { return new Booking($holder, new Window(Big::of($lo), Big::of($hi))); }
function close_value(Claim|Booking|Grant $value): void { $value->holder->close(); }

function post_transfer(bool $throws): void {
    $input = new_ticket(Big::of(91), 'post-transfer'); $independent = $input->retain();
    $transferred = claim($input, 7); $entered = 0; $output = null;
    $sentinel = new RuntimeException('post-transfer callback');
    $reply = function(Claim $incoming) use (&$entered, $throws, $sentinel): Claim {
        $entered++; check($incoming->quota->isEqualTo(7), 'post-transfer callback input');
        if ($throws) throw $sentinel;
        return claim($incoming->holder, 99);
    };
    $callback = with_recovery($reply, claim($independent, 7));
    $operation = function() use (&$output, $transferred, $callback): void {
        $output = transfer_with_claim_callback($transferred, $callback);
    };
    if ($throws) check(rejected($operation, RuntimeException::class) === $sentinel, 'post-transfer callback exception identity');
    else check(rejected($operation)->getCode() === 1, 'post-transfer invalid callback reply rejects');
    check($output === null && $entered === 1 && resource_closed($input) && resource_closed($transferred->holder),
        'post-transfer failure consumes input without publishing output');
    serial_is($independent, 91, 'post-transfer failure preserves independent retain');
    $recovered = transfer_with_claim_callback(claim($independent, 7), with_recovery(
        fn(Claim $incoming) => claim($incoming->holder, 9), claim($independent, 7)));
    check(resource_closed($independent) && $recovered->quota->isEqualTo(9), 'post-transfer failure recovers');
    serial_is($recovered->holder, 91, 'recovered transfer resource'); close_value($recovered);
    $input->close(); $independent->close();
}

$ticket = new_ticket(Big::of(41), "php\x00checked"); $retained = $ticket->retain();
serial_is($ticket, 41, 'fresh resource'); serial_is($retained, 41, 'retained resource');
$valid = claim($ticket, 7); $validBooking = booking($ticket, 3, 8);
for ($index = 0; $index < 25; $index++) {
    $echoed = echo_claim($valid); check($echoed->quota->isEqualTo(7), 'claim field'); serial_is($echoed->holder, 41, 'claim resource'); close_value($echoed);
    $nested = echo_booking($validBooking); check($nested->window->hi->isEqualTo(8), 'nested field'); serial_is($nested->holder, 41, 'nested resource'); close_value($nested);
}
$invalidBooking = booking($ticket, 8, 3);
for ($index = 0; $index < 10; $index++) {
    rejected(fn() => echo_booking($invalidBooking));
    check($invalidBooking->window->lo->isEqualTo(8) && $invalidBooking->window->hi->isEqualTo(3), 'nested copied rejection preserves input fields');
    serial_is($invalidBooking->holder, 41, 'nested copied rejection preserves owner');
}
$equalBooking = echo_booking(booking($ticket, 3, 3));
check($equalBooking->window->lo->isEqualTo(3) && $equalBooking->window->hi->isEqualTo(3), 'nested copied equality and recovery');
serial_is($equalBooking->holder, 41, 'nested copied recovery resource'); close_value($equalBooking);
check(booking_span($validBooking)->isEqualTo(5), 'copied payload consumed');
check(claim_quota($valid)->isEqualTo(7), 'owned payload consumed');
$grant = echo_grant(new Grant($ticket, Big::of(7), Big::of(8)));
check($grant->weight->isEqualTo(7) && $grant->limit->isEqualTo(8), 'nested Subtype and outer record accepted');
serial_is($grant->holder, 41, 'grant resource'); close_value($grant);
rejected(fn() => echo_grant(new Grant($ticket, Big::of(0), Big::of(8))));
rejected(fn() => echo_grant(new Grant($ticket, Big::of(7), Big::of(3))));
serial_is($ticket, 41, 'both grant rejections preserve owner');
$claims = echo_claims([$valid, $valid]);
check(count($claims) === 2 && $claims[0]->quota->isEqualTo(7) && $claims[1]->quota->isEqualTo(7), 'owned array');
close_value($claims[0]); serial_is($claims[1]->holder, 41, 'array element owners are independent'); close_value($claims[1]);
for ($index = 0; $index < 10; $index++) {
    $partial = null;
    rejected(function() use (&$partial, $valid, $ticket): void { $partial = echo_claims([$valid, claim($ticket, 99)]); });
    check($partial === null && !resource_closed($ticket), 'late array rejection publishes no partial result');
}
check(echo_claims([]) === [], 'empty owned array');
$arrayRecovery = echo_claims([$valid]);
check(count($arrayRecovery) === 1 && $arrayRecovery[0]->quota->isEqualTo(7), 'array recovery'); close_value($arrayRecovery[0]);
$invalid = claim($ticket, 99);
rejected(fn() => echo_claim($invalid)); rejected(fn() => pair_claim($validBooking, $invalid));
check(!resource_closed($ticket), 'borrowed rejection preserves input'); serial_is($ticket, 41, 'rejection recovery');

$moving = new_ticket(Big::of(51), 'moving'); $kept = $moving->retain(); $refused = claim($moving, 99);
rejected(fn() => transfer_claim($refused)); check(!resource_closed($moving) && !resource_closed($refused->holder), 'prevalidate transfer');
$accepted = claim($moving, 9); $moved = transfer_claim($accepted);
check(resource_closed($moving) && resource_closed($accepted->holder), 'consume transfer');
serial_is($moved->holder, 51, 'moved result'); serial_is($kept, 51, 'retain survives'); close_value($moved);

$first = new_ticket(Big::of(71), 'first'); $second = new_ticket(Big::of(81), 'second');
$firstKept = $first->retain(); $secondKept = $second->retain();
$firstInput = booking($first, 3, 8); $secondInput = claim($second, 99);
rejected(fn() => transfer_pair_claim($firstInput, $secondInput));
check(!resource_closed($first) && !resource_closed($second), 'late failure aborts both transfers');
serial_is($first, 71, 'first rejected transfer intact'); serial_is($second, 81, 'second rejected transfer intact');
$pair = transfer_pair_claim($firstInput, claim($second, 7));
check(resource_closed($first) && resource_closed($second) && $pair->quota->isEqualTo(7), 'both transfers commit');
serial_is($pair->holder, 81, 'pair transfer result'); serial_is($firstKept, 71, 'first independent retain survives');
serial_is($secondKept, 81, 'second independent retain survives'); close_value($pair);
$first->close(); $second->close(); $firstKept->close(); $secondKept->close();
post_transfer(false); post_transfer(true);

$calls = 0;
$reply = function(Claim $incoming) use (&$calls): Claim { $calls++; return claim($incoming->holder, 10); };
$output = with_claim_callback($valid, with_recovery($reply, $valid));
check($calls === 1 && $output->quota->isEqualTo(10), 'callback result'); close_value($output);
$output = with_claim_callback($valid, $reply); check($calls === 2, 'bare callback'); close_value($output);
rejected(fn() => with_claim_callback($valid, with_recovery($reply, $invalid)));
check($calls === 2, 'invalid recovery prevents callback');
rejected(fn() => with_claim_callback($valid, with_recovery(fn(Claim $incoming) => claim($ticket, 99), $valid)));
$sentinel = new RuntimeException('php callback');
check(rejected(fn() => with_claim_callback($valid, with_recovery(function(Claim $_incoming) use ($sentinel) { throw $sentinel; }, $valid)), RuntimeException::class) === $sentinel, 'callback exception identity');

$closure = claim_closure();
$value = $closure($valid); check($value->quota->isEqualTo(7), 'closure result'); close_value($value);
rejected(fn() => $closure($invalid));
$value = $closure(claim($ticket, 6)); check($value->quota->isEqualTo(6), 'closure recovery'); close_value($value);
$closure->close(); $closure->close();
$produced = claim_for($retained); check($produced !== null && $produced->value->quota->isEqualTo(0), 'Lean-produced checked record');
serial_is($produced->value->holder, 41, 'produced resource'); close_value($produced->value);

$pid = pcntl_fork();
if ($pid === -1) throw new RuntimeException('fork failed');
if ($pid === 0) {
    try { serial($ticket); exit(91); }
    catch (LeanBridgeError $error) { exit($error->getCode() === 6 ? 0 : 92); }
}
pcntl_waitpid($pid, $status);
check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0, 'foreign process rejects inherited owner');
serial_is($ticket, 41, 'parent owner survives child-process rejection');

$abandoned = new_ticket(Big::of(62), 'finalized'); $survivor = $abandoned->retain(); $weak = WeakReference::create($abandoned);
unset($abandoned); gc_collect_cycles(); check($weak->get() === null, 'destructor reaches abandoned owner'); serial_is($survivor, 62, 'retained survivor');
$survivor->close(); $ticket->close(); $retained->close(); $moving->close(); $kept->close();
echo "owned-checked-record-php-native:$checks\n";
