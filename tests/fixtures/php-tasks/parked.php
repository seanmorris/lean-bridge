<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use Amp\CancelledException;
use Amp\DeferredCancellation;
use Amp\TimeoutCancellation;
use LeanPulse as P;
use LeanSignals as S;

function check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException($label);
}
function until(Closure $predicate): void {
    $timeout = new TimeoutCancellation(8);
    while (!$predicate()) Amp\delay(.002, cancellation: $timeout);
}
function failure(Closure $call, string $class): Throwable {
    try { $call(); }
    catch (Throwable $caught) {
        check($caught instanceof $class, 'Expected '.$class.', got '.$caught);
        return $caught;
    }
    throw new RuntimeException('Missing '.$class);
}
function fds(): int { return count(scandir('/proc/self/fd')); }

$order = $argv[1] ?? '';
check(in_array($order, ['pulse-first','peer-first'], true), 'unknown load order');
if ($order === 'pulse-first') P\reset();
check(S\reading(8)->await(new TimeoutCancellation(8)) === 9, 'peer initialization');
if ($order === 'peer-first') P\reset();
$ffi = FFI::cdef('typedef struct { uint32_t abi,state,init,component_init,attached,live; uint64_t runtime,domain; } snap; void lean_bridge_native_snapshot_read(snap *);');
$owners = static function () use ($ffi): int {
    $s = $ffi->new('snap');
    $ffi->lean_bridge_native_snapshot_read(FFI::addr($s));
    return $s->live;
};
// Start the Revolt loop before counting its persistent descriptors.
Amp\delay(.002);
$baseline = fds();
check($owners() === 0, 'unexpected initial owners');
$out = [];
foreach (['token','close'] as $mode) {
    P\reset();
    $startPulls = P\pulls(); $startCloses = P\closes(); $items = [];
    $source = new DeferredCancellation();
    $token = $source->getCancellation();
    $cursor = P\series(false, true, 'late item', $token);
    check(P\pulls() === $startPulls, 'factory prefetched');
    $consumer = Amp\async(static function () use ($cursor, &$items): void {
        foreach ($cursor as $item) $items[] = $item;
    });
    until(fn() => P\state() === 1);
    try {
        check(!$consumer->isComplete(), 'reader was not blocked');
        $overlap = failure(fn() => iterator_to_array($cursor), LogicException::class);
        check(str_contains($overlap->getMessage(), 'already has an iterator') && P\pulls() === $startPulls + 1, 'overlapping read advanced the cursor');
        if ($mode === 'token') {
            $reason = new DomainException('application cancelled the pull');
            $source->cancel($reason);
            $original = failure(fn() => $token->throwIfRequested(), CancelledException::class);
            check($original->getPrevious() === $reason, 'lost application cancellation cause');
            $expected = CancelledException::class;
        } else {
            $cursor->close(); $expected = P\LeanBridgeError::class;
        }
        $caught = failure(fn() => $consumer->await(new TimeoutCancellation(8)), $expected);
        if ($mode === 'token') check($caught === $original, 'replaced operation cancellation');
        else check(str_contains($caught->getMessage(), 'closed during pull'), 'wrong explicit-close reason');
        check(P\closes() === $startCloses + 1 && P\state() === 1 && $items === [], 'cursor did not finalize once while worker was blocked');
        check(S\reading(41)->await(new TimeoutCancellation(8)) === 42 && P\state() === 1, 'unrelated package failed while worker remained blocked');
    } finally {
        P\release();
    }
    until(fn() => P\state() === 3 && $owners() === 0 && fds() === $baseline);
    check(failure(fn() => $consumer->await(), $expected) === $caught, 'late completion replaced the error');
    if ($mode === 'token') check(failure(fn() => iterator_to_array($cursor), $expected) === $caught, 'closed stream forgot its cancellation');
    else check(iterator_to_array($cursor) === [], 'closed cursor delivered another item');
    $cursor->close();
    check($items === [] && P\pulls() === $startPulls + 1 && P\closes() === $startCloses + 1, 'late item, extra pull or duplicate finalizer');
    $out[$mode] = ['pulls'=>P\pulls()-$startPulls,'closes'=>P\closes()-$startCloses,'items'=>count($items),'peer'=>42];
}
echo json_encode(['order'=>$order,'php'=>PHP_VERSION,'paths'=>$out,'owners'=>$owners(),'fdDelta'=>fds()-$baseline], JSON_THROW_ON_ERROR), "\n";
