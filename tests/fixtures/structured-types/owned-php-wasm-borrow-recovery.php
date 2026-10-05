<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Payload, Bundle};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, callback_record, copy_value};

$before = owned_transfer_stats();
$ticket = new_ticket(Big::of(77), 'recovered');
$bundle = copy_value(new Bundle($ticket->get(), null, [], [], new Payload(Big::of(7), Bytes::fromString('recovered'))));
$result = callback_record($bundle, static fn($value) => $value);
check((string) owned_call('serial', [$result->get()->primary]) === '77');
check($result->equals($bundle));
$bundle->close(); check($result->closed());
dispose([$ticket, $bundle, $result]); unset($ticket, $bundle, $result); gc_collect_cycles(); Native::close();
echo json_encode(['before' => $before, 'after' => owned_transfer_stats()], JSON_THROW_ON_ERROR);
