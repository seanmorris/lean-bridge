<?php
// Installed native PHP acceptance for directional callback checked records.
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanCallbackcheckedrecords\Err;
use LeanCallbackcheckedrecords\Interval;
use LeanCallbackcheckedrecords\LeanBridgeError;
use LeanCallbackcheckedrecords\Ok;
use LeanCallbackcheckedrecords\Some;
use LeanCallbackcheckedrecords\Weighted;
use function LeanCallbackcheckedrecords\call_host;
use function LeanCallbackcheckedrecords\call_host_container;
use function LeanCallbackcheckedrecords\call_host_mixed;
use function LeanCallbackcheckedrecords\call_host_nested;
use function LeanCallbackcheckedrecords\make_closure;
use function LeanCallbackcheckedrecords\make_container_closure;
use function LeanCallbackcheckedrecords\make_mixed_closure;
use function LeanCallbackcheckedrecords\make_nested_closure;
use function LeanCallbackcheckedrecords\with_recovery;

$checks = 0;
$calls = 0;
$check = function(bool $value, string $label) use (&$checks): void {
    if (!$value) throw new RuntimeException($label);
    ++$checks;
};
$reject = function(callable $operation, string $kind = Throwable::class): Throwable {
    try { $operation(); }
    catch (Throwable $error) {
        if ($error instanceof $kind) return $error;
        throw $error;
    }
    throw new RuntimeException("expected {$kind}");
};
$n = fn(int $value): BigInteger => BigInteger::of($value);
$interval = fn(int $lo, int $hi): Interval => new Interval($n($lo), $n($hi));
$weighted = fn(int $weight, int $limit): Weighted => new Weighted($n($weight), $n($limit));

$widen = function(Interval $value) use (&$calls, $interval): Interval {
    ++$calls;
    if (!$value->equals($interval(1, 3))) throw new RuntimeException('proof-free host argument');
    return $interval(1, 4);
};
$check(call_host(with_recovery($widen, $interval(1, 3)))->isEqualTo($n(3)), 'valid host reply');
$before = $calls;
$check($reject(fn() => call_host(with_recovery($widen, $interval(3, 1))), LeanBridgeError::class)->getCode() === 1,
    'invalid recovery status');
$check($calls === $before, 'invalid recovery stops callback');
$check($reject(fn() => call_host(with_recovery(fn(Interval $_value) => $interval(5, 2), $interval(1, 3))),
    LeanBridgeError::class)->getCode() === 1, 'invalid host reply status');
$check($calls === $before, 'invalid reply does not use counted callback');
$check(call_host(with_recovery($widen, $interval(1, 3)))->isEqualTo($n(3)), 'host recovery reuse');
$sentinel = new RuntimeException('callback failed');
$check($reject(fn() => call_host(with_recovery(fn(Interval $_value) => throw $sentinel, $interval(1, 3)))) === $sentinel,
    'callback exception identity');
$check(call_host_mixed(with_recovery(
    fn(BigInteger $marker, Interval $value) => new Interval($value->lo, $value->hi->plus($marker)->minus(5)),
    $interval(1, 3)))->isEqualTo($n(4)), 'mixed host reply');

$closure = make_closure($n(9));
$check($closure($interval(2, 5))->isEqualTo($n(3)), 'closure result');
$check($reject(fn() => $closure($interval(5, 2)), LeanBridgeError::class)->getCode() === 1,
    'closure argument status');
$check($closure($interval(3, 3))->isZero(), 'closure recovery');
$closure->close(); $closure->close();
$check($closure->isClosed(), 'closure closes idempotently');

$mixed = make_mixed_closure($n(0));
$check($mixed($n(9), $interval(2, 5))->equals($interval(2, 5)), 'mixed closure result');
$check($reject(fn() => $mixed($n(9), $interval(5, 2)), LeanBridgeError::class)->getCode() === 1,
    'mixed closure argument status');
$check($mixed($n(9), $interval(3, 4))->equals($interval(3, 4)), 'mixed closure recovery');
$mixed->close();

$containerRecovery = new Ok(null);
$check(call_host_container(with_recovery(
    fn(mixed $_value) => new Ok(new Some($interval(1, 4))), $containerRecovery))->isEqualTo($n(3)),
    'container host reply');
$check($reject(fn() => call_host_container(with_recovery(
    fn(mixed $_value) => new Ok(new Some($interval(4, 1))), $containerRecovery)),
    LeanBridgeError::class)->getCode() === 1, 'container host reply status');
$container = make_container_closure($n(0));
$check($container([null, new Some($interval(2, 5))]) === null, 'container closure result');
$check($reject(fn() => $container([new Some($interval(5, 2))]), LeanBridgeError::class)->getCode() === 1,
    'container closure argument status');
$check($container([]) === null, 'container closure recovery');
$container->close();

$reply = $weighted(2, 5);
$reweigh = function(Weighted $value) use (&$calls, &$reply, $weighted): Weighted {
    ++$calls;
    if (!$value->equals($weighted(1, 2))) throw new RuntimeException('proof-free weighted argument');
    return $reply;
};
$check(call_host_nested(with_recovery($reweigh, $weighted(1, 2)))->isEqualTo($n(3)), 'weighted host reply');
$reply = $weighted(0, 5);
$check($reject(fn() => call_host_nested(with_recovery($reweigh, $weighted(1, 2))),
    LeanBridgeError::class)->getCode() === 1, 'zero weight status');
$reply = $weighted(6, 5);
$check($reject(fn() => call_host_nested(with_recovery($reweigh, $weighted(1, 2))),
    LeanBridgeError::class)->getCode() === 1, 'weight above limit status');
$before = $calls;
$check($reject(fn() => call_host_nested(with_recovery($reweigh, $weighted(0, 2))),
    LeanBridgeError::class)->getCode() === 1, 'invalid weighted recovery status');
$check($calls === $before, 'invalid weighted recovery stops callback');
$reply = $weighted(2, 5);
$check(call_host_nested(with_recovery($reweigh, $weighted(1, 2)))->isEqualTo($n(3)), 'weighted host recovery');
$nested = make_nested_closure($n(0));
$check($nested($weighted(2, 5))->isEqualTo($n(3)), 'weighted closure result');
$check($reject(fn() => $nested($weighted(0, 5)), LeanBridgeError::class)->getCode() === 1,
    'weighted closure zero status');
$check($reject(fn() => $nested($weighted(6, 5)), LeanBridgeError::class)->getCode() === 1,
    'weighted closure bound status');
$check($nested($weighted(5, 5))->isZero(), 'weighted closure recovery');
$nested->close();

echo "callback-checked-record-remaining-ok:{$checks}\n";
