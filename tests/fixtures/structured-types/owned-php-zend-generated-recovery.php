<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Payload, Bundle};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, callback_record};

$before = owned_generated_stats();
$ticket = new_ticket(Big::of(77), 'recovered');
$bundle = new Bundle($ticket, null, [], [], new Payload(Big::of(7), Bytes::fromString('recovered')));
$result = callback_record($bundle, static fn($value) => $value);
check((string) owned_call('serial', [$result->primary]) === '77');
check($result->payload->equals($bundle->payload));
dispose($result); dispose($bundle); unset($result, $bundle, $ticket); gc_collect_cycles(); Native::close();
echo json_encode(['before' => $before, 'after' => owned_generated_stats()], JSON_THROW_ON_ERROR);
