<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Payload, Bundle, ChainStop, ChainLink, Mixed_};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\new_ticket;

$ticket = new_ticket(Big::of(1), 'malformed');
$payload = new Payload(Big::of(-3), Bytes::fromString('payload'));
$bundle = new Bundle($ticket, new Some($ticket), [$ticket], [$ticket], $payload);
$chain = new ChainLink($ticket, new Some(new ChainStop()));
$mixed = new Mixed_($ticket, [new Some(new Some(true))], new Some(null), new Ok($bundle),
    Big::of(-5), Big::of(7), 'x', 1.5, 2.25, Bytes::fromString('bytes'), [Big::of(0), Big::of(17)],
    [$ticket, [null, $payload]], $chain);
$before = owned_generated_stats();
owned_generated_corrupt(OUTPUT_MODE);
reject(fn() => owned_call('echoMixed', [$mixed]), 9);
check(owned_generated_stats()['runtimeState'] !== 2, 'malformed output retires the runtime');
reject(fn() => owned_call('serial', [$ticket]), 7);
dispose($mixed); dispose($bundle); dispose($chain); $ticket->close();
unset($mixed, $bundle, $chain, $ticket); gc_collect_cycles(); Native::close();
$after = owned_generated_stats();
check($after['live'] === 0 && $after['identities'] === 0, 'corrupt-output cleanup: ' . json_encode($after));
check($after['scopes'] === 0 && $after['depth'] === 0, 'corrupt-output call cleanup');
echo json_encode(['mode' => OUTPUT_MODE, 'checks' => $checks, 'before' => $before, 'after' => $after], JSON_THROW_ON_ERROR);
