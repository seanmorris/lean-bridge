<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bundle, Payload, Bytes};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, callback_record};

$ticket = new_ticket(Big::of(42), 'retired');
$bundle = new Bundle($ticket, null, [], [], new Payload(Big::of(0), Bytes::fromString('')));
$borrow = null;
reject(static function() use ($bundle, &$borrow, $ffi) {
    return callback_record($bundle, static function($value) use (&$borrow, $ffi) {
        $borrow = $value->primary;
        $ffi->lean_bridge_native_runtime_retire();
        return $value;
    });
}, 7);
reject(fn() => owned_call('serial', [$ticket]), 7);
reject(fn() => owned_call('serial', [$borrow]), 4);
$ticket->close(); unset($bundle, $ticket, $borrow);
Native::close();
check($ffi->owned_test_live() === 0, 'retirement releases native allocations');
check($ffi->owned_test_identities() === 0, 'retirement releases identities');
echo json_encode(['checks' => $checks, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]), "\n";
