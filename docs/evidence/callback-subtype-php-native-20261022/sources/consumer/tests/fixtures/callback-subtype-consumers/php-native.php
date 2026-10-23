<?php
// Installed native PHP acceptance for directional callback Subtypes.
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanCallbacksubtypes\LeanBridgeError;
use function LeanCallbacksubtypes\call_host;
use function LeanCallbacksubtypes\call_host_mixed;
use function LeanCallbacksubtypes\make_closure;
use function LeanCallbacksubtypes\make_mixed_closure;
use function LeanCallbacksubtypes\with_recovery;

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
$increment = function(BigInteger $value) use (&$calls): BigInteger { ++$calls; return $value->plus(1); };
$check(call_host(with_recovery($increment, $n(1)))->isEqualTo($n(2)), 'valid host result');
$before = $calls;
$recovery = $reject(fn() => call_host(with_recovery($increment, $n(0))), LeanBridgeError::class);
$check($recovery->getCode() === 1, 'invalid recovery status');
$check($calls === $before, 'invalid recovery stops callback');
$result = $reject(fn() => call_host(with_recovery(fn(BigInteger $_value) => $n(0), $n(1))), LeanBridgeError::class);
$check($result->getCode() === 1, 'invalid host result status');
$sentinel = new RuntimeException('callback failed');
$check($reject(fn() => call_host(with_recovery(fn(BigInteger $_value) => throw $sentinel, $n(1)))) === $sentinel, 'callback exception identity');
$check(call_host(with_recovery(fn(BigInteger $value) => $value, $n(1)))->isEqualTo($n(1)), 'host recovery reuse');
$check(call_host_mixed(with_recovery(fn(BigInteger $marker, BigInteger $value) => $marker->minus(5)->plus($value), $n(1)))->isEqualTo($n(3)), 'mixed host result');

$closure = make_closure($n(9));
$check($closure($n(2))->isEqualTo($n(2)), 'closure result');
$check($reject(fn() => $closure($n(0)), LeanBridgeError::class)->getCode() === 1, 'closure argument status');
$check($closure($n(3))->isEqualTo($n(3)), 'closure recovery');
$closure->close(); $closure->close();
$check($closure->isClosed(), 'closure closes idempotently');

$mixed = make_mixed_closure($n(0));
$check($mixed($n(9), $n(2))->isEqualTo($n(2)), 'mixed closure result');
$check($reject(fn() => $mixed($n(9), $n(0)), LeanBridgeError::class)->getCode() === 1, 'mixed closure argument status');
$check($mixed($n(9), $n(3))->isEqualTo($n(3)), 'mixed closure recovery');
$mixed->close();

echo "callback-subtype-remaining-ok:{$checks}\n";
