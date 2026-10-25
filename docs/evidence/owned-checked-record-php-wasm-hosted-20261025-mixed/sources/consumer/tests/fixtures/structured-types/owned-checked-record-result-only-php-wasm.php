<?php
// Independent installed PHP-Wasm consumer for Lean-produced owned checked records.
declare(strict_types=1);

// The host has already loaded the installed Composer or embedded autoloader.

use Brick\Math\BigInteger as Big;
use function LeanOwnedCheckedRecords\{claim_for, new_ticket, serial};

$checks = 0;
function check_result_only(bool $value, string $message): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException("owned checked-record result-only PHP-Wasm check $checks: $message");
}

$ticket = new_ticket(Big::of(17), 'result-only');
check_result_only(serial($ticket)->isEqualTo(Big::of(17)), 'ticket');
$claim = claim_for($ticket);
check_result_only($claim !== null, 'some claim');
check_result_only($claim->value->quota->isEqualTo(Big::zero()), 'proof-free quota');
check_result_only(serial($claim->value->holder)->isEqualTo(Big::of(17)), 'owned holder');
$claim->value->holder->close(); $ticket->close();

echo json_encode([
    'checks' => $checks,
    'ownedCheckedRecord' => true,
    'mode' => 'result-only',
    'ordinaryAutoload' => true,
    'phpBits' => PHP_INT_SIZE * 8,
], JSON_THROW_ON_ERROR), "\n";
