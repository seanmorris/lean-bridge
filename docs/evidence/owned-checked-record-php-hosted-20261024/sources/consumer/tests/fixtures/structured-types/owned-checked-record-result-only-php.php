<?php
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use function LeanOwnedCheckedRecords\{claim_for, new_ticket, serial};

$checks = 0; $ticket = new_ticket(Big::of(17), 'result-only');
if (!serial($ticket)->isEqualTo(17)) throw new RuntimeException('serial'); $checks++;
$claim = claim_for($ticket);
if ($claim === null || !$claim->value->quota->isEqualTo(0)) throw new RuntimeException('claim'); $checks++;
if (!serial($claim->value->holder)->isEqualTo(17)) throw new RuntimeException('holder'); $checks++;
$claim->value->holder->close(); $ticket->close(); $checks++;
echo "owned-checked-record-result-only-php-native:$checks\n";
