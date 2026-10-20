<?php
// Independent installed-Composer consumer for checked owned aggregates.
declare(strict_types=0);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedSubtypes\{Bundle, Bytes, LeanBridgeError, Payload, Ticket};
use function LeanOwnedSubtypes\{echo_record, echo_record_alternate, new_ticket, serial, transfer_record};

$checks = 0;

function check(bool $value, string $message): void {
    global $checks;
    $checks++;
    if (!$value) throw new RuntimeException("owned Subtype PHP check $checks: $message");
}

function rejected(callable $operation, int $status = 1): void {
    try { $operation(); }
    catch (LeanBridgeError $error) {
        check($error->getCode() === $status, "expected status $status, got {$error->getCode()}");
        return;
    }
    throw new RuntimeException('expected Lean Bridge rejection');
}

function bundle(Ticket $ticket, int $count): Bundle {
    return new Bundle($ticket, null, [$ticket], [$ticket],
        new Payload(Big::of($count), Bytes::fromString("\x00\xff")));
}

function release_bundle(Bundle $value): void {
    $value->primary->close();
    if ($value->spare !== null) $value->spare->value->close();
    foreach ($value->peers as $ticket) $ticket->close();
    foreach ($value->history as $ticket) $ticket->close();
}

function serial_is(Ticket $ticket, int $expected, string $message): void {
    check(serial($ticket)->isEqualTo(Big::of($expected)), $message);
}

$ticket = new_ticket(Big::of(41), "php\x00checked");
$retained = $ticket->retain();
serial_is($ticket, 41, 'fresh resource is usable');
serial_is($retained, 41, 'explicit retain is independent');

$valid = bundle($ticket, 7);
for ($index = 0; $index < 25; $index++) {
    $echoed = echo_record($valid);
    check($echoed->payload->count->isEqualTo(Big::of(7)), 'selected constructor accepts a valid value');
    serial_is($echoed->primary, 41, 'selected constructor preserves the resource');
    $alternate = echo_record_alternate($valid);
    check($alternate->payload->bytes->toString() === "\x00\xff", 'alternate constructor preserves bytes');
    serial_is($alternate->primary, 41, 'alternate constructor preserves the resource');
    release_bundle($echoed);
    release_bundle($alternate);
}
serial_is($ticket, 41, 'borrowed calls do not consume the input owner');

$invalid = bundle($ticket, -1);
rejected(fn() => echo_record($invalid));
rejected(fn() => echo_record_alternate($invalid));
serial_is($ticket, 41, 'borrowed rejection preserves the input owner');

$moving = new_ticket(Big::of(51), 'moving');
$kept = $moving->retain();
rejected(fn() => transfer_record(bundle($moving, -1)));
serial_is($moving, 51, 'transfer rejection happens before ownership movement');
serial_is($kept, 51, 'rejected transfer leaves the retain usable');

$moved = transfer_record(bundle($moving, 9));
rejected(fn() => serial($moving), 4);
serial_is($kept, 51, 'successful transfer preserves an independent retain');
check($moved->payload->count->isEqualTo(Big::of(9)), 'successful transfer preserves the checked field');
serial_is($moved->primary, 51, 'successful transfer returns a usable resource');

release_bundle($moved);
$ticket->close(); $retained->close(); $moving->close(); $kept->close();
rejected(fn() => serial($ticket), 4);
rejected(fn() => serial($retained), 4);
rejected(fn() => serial($kept), 4);

echo "owned-subtype-php:$checks\n";
