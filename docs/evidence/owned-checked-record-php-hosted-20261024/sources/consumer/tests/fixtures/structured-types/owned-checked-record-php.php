<?php
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedCheckedRecords\{Booking, Claim, LeanBridgeError, Ticket, Window};
use LeanOwnedCheckedRecords\Internal\ResourceAccess;
use function LeanOwnedCheckedRecords\{claim_closure, claim_for, echo_booking, echo_claim,
    new_ticket, pair_claim, serial, transfer_claim, with_claim_callback, with_recovery};

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
function close_value(Claim|Booking $value): void { $value->holder->close(); }

$ticket = new_ticket(Big::of(41), "php\x00checked"); $retained = $ticket->retain();
serial_is($ticket, 41, 'fresh resource'); serial_is($retained, 41, 'retained resource');
$valid = claim($ticket, 7); $validBooking = booking($ticket, 3, 8);
for ($index = 0; $index < 25; $index++) {
    $echoed = echo_claim($valid); check($echoed->quota->isEqualTo(7), 'claim field'); serial_is($echoed->holder, 41, 'claim resource'); close_value($echoed);
    $nested = echo_booking($validBooking); check($nested->window->hi->isEqualTo(8), 'nested field'); serial_is($nested->holder, 41, 'nested resource'); close_value($nested);
}
$invalid = claim($ticket, 99);
rejected(fn() => echo_claim($invalid)); rejected(fn() => pair_claim($validBooking, $invalid));
check(!resource_closed($ticket), 'borrowed rejection preserves input'); serial_is($ticket, 41, 'rejection recovery');

$moving = new_ticket(Big::of(51), 'moving'); $kept = $moving->retain(); $refused = claim($moving, 99);
rejected(fn() => transfer_claim($refused)); check(!resource_closed($moving) && !resource_closed($refused->holder), 'prevalidate transfer');
$accepted = claim($moving, 9); $moved = transfer_claim($accepted);
check(resource_closed($moving) && resource_closed($accepted->holder), 'consume transfer');
serial_is($moved->holder, 51, 'moved result'); serial_is($kept, 51, 'retain survives'); close_value($moved);

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
