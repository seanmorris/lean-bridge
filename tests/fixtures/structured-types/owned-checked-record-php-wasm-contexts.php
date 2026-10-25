<?php
// Installed components share the broker, but never each other's resource owners.
declare(strict_types=1);

use Brick\Math\BigInteger as Big;
use LeanOwnedCheckedRecords as A;
use LeanOwnedCheckedRecordsPeer as B;

$contract = json_decode(file_get_contents('/contexts.json'), true, 512, JSON_THROW_ON_ERROR);
$checks = 0; $rejections = 0; $lateRejections = 0;
function context_check(bool $value, string $message): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Checked-record contexts: ' . $message);
}
function context_reject(callable $operation, string $class, ?int $status = null): void {
    global $rejections;
    try { $operation(); }
    catch (Throwable $error) {
        context_check($error instanceof $class, 'unexpected rejection ' . get_class($error));
        context_check($status === null || $error->getCode() === $status, 'unexpected status');
        $rejections++; return;
    }
    throw new RuntimeException('Foreign or expired owner was accepted');
}
function primary_serial(A\Ticket $ticket, int $expected): void {
    context_check(A\serial($ticket)->isEqualTo(Big::of($expected)), 'primary owner changed');
}
function peer_serial(B\Ticket $ticket, int $expected): void {
    context_check(B\serial($ticket)->isEqualTo(Big::of($expected)), 'peer owner changed');
}

$one = A\new_ticket(Big::of(41), 'primary');
$two = B\new_ticket(Big::of(73), 'peer');
$oneRetained = $one->retain(); $twoRetained = $two->retain();
context_reject(fn() => serialize($one), LogicException::class);
context_reject(fn() => serialize($two), LogicException::class);
$primaryClaim = A\claim_for($one)->value;
$peerClaim = B\claim_for($two)->value;
primary_serial($primaryClaim->holder, 41); peer_serial($peerClaim->holder, 73);
foreach ([fn() => A\serial($two), fn() => B\serial($one),
          fn() => A\claim_for($peerClaim->holder), fn() => B\claim_for($primaryClaim->holder)] as $call)
    context_reject($call, TypeError::class);

// Exercise the installed Zend boundary too, beyond nominal PHP validation.
// These are real resource handles, not fabricated tokens or altered packages.
$peerWire = B\Internal\ResourceAccess::binding($two)->wire($contract['peerTicket']);
$primaryWire = A\Internal\ResourceAccess::binding($one)->wire($contract['primaryTicket']);
context_reject(fn() => ($contract['primary']['claim_for'])($peerWire), TypeError::class);
context_reject(fn() => ($contract['peer']['claim_for'])($primaryWire), TypeError::class);
primary_serial($one, 41); peer_serial($two, 73);

if ($contract['mode'] === 'full') {
    $claim = new A\Claim($one, Big::of(7));
    $booking = new A\Booking($one, new A\Window(Big::of(3), Big::of(8)));
    $wireBooking = A\Internal\GraphWire::transfer($contract['booking'], $booking, false, new A\Internal\GraphBudget());
    $wireClaim = A\Internal\GraphWire::transfer($contract['claim'], $claim, false, new A\Internal\GraphBudget());
    $foreignClaim = $wireClaim; $foreignClaim[0] = $peerWire;
    for ($index = 0; $index < 10; $index++) {
        foreach ([
            fn() => ($contract['primary']['pair_claim'])($wireBooking, $foreignClaim),
            fn() => ($contract['primary']['transfer_pair_claim'])($wireBooking, $foreignClaim),
            fn() => ($contract['primary']['echo_claims'])([$wireClaim, $foreignClaim]),
        ] as $call) {
            $output = null;
            context_reject(function() use ($call, &$output): void { $output = $call(); }, TypeError::class);
            context_check($output === null, 'late rejection published a partial output');
            primary_serial($one, 41); peer_serial($two, 73); $lateRejections++;
        }
    }
    $calls = 0;
    $foreignReply = function(A\Claim $incoming) use (&$calls, $peerClaim): B\Claim {
        $calls++; primary_serial($incoming->holder, 41); return $peerClaim;
    };
    context_reject(fn() => A\with_claim_callback($claim, A\with_recovery($foreignReply, $claim)), TypeError::class);
    primary_serial($one, 41);
    $output = null;
    $recovery = new A\Claim($oneRetained, Big::of(7));
    context_reject(function() use ($claim, $foreignReply, $recovery, &$output): void {
        $output = A\transfer_with_claim_callback($claim, A\with_recovery($foreignReply, $recovery));
    }, TypeError::class);
    context_check($calls === 2 && $output === null, 'foreign callback reply or output escaped');
    context_reject(fn() => A\serial($one), A\LeanBridgeError::class, 4);
    primary_serial($oneRetained, 41); peer_serial($two, 73);
    $recovered = A\echo_claim(new A\Claim($oneRetained, Big::of(7)));
    primary_serial($recovered->holder, 41); $recovered->holder->close();
    unset($call, $foreignReply, $recovery, $claim, $booking, $wireBooking, $wireClaim, $foreignClaim);
}

// Retiring one component context cannot invalidate the other's retained owner.
B\Internal\Native::close();
context_reject(fn() => B\serial($two), B\LeanBridgeError::class, 4);
context_reject(fn() => B\serial($twoRetained), B\LeanBridgeError::class, 4);
primary_serial($oneRetained, 41);
$fresh = B\new_ticket(Big::of(89), 'replacement-context');
peer_serial($fresh, 89);
context_reject(fn() => B\claim_for($peerClaim->holder), B\LeanBridgeError::class, 4);
context_reject(fn() => ($contract['peer']['claim_for'])($peerWire), Exception::class, 4);
peer_serial($fresh, 89);
foreach ([$one, $two, $oneRetained, $twoRetained, $primaryClaim->holder, $peerClaim->holder, $fresh] as $value)
    $value->close();
unset($value, $primaryWire, $peerWire, $one, $two, $oneRetained, $twoRetained, $primaryClaim, $peerClaim, $fresh, $call);
gc_collect_cycles();
echo json_encode(['mode' => $contract['mode'], 'checks' => $checks, 'rejections' => $rejections,
    'lateRejections' => $lateRejections, 'contextIsolation' => true, 'staleContextRejected' => true,
    'independentRetains' => true, 'phpBits' => PHP_INT_SIZE * 8], JSON_THROW_ON_ERROR);
