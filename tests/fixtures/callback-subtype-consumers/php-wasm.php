<?php
// Installed PHP-Wasm acceptance for directional callback Subtypes.
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanCallbacksubtypes\LeanBridgeError;
use LeanCallbacksubtypes\Ok;
use LeanCallbacksubtypes\Some;
use function LeanCallbacksubtypes\call_host;
use function LeanCallbacksubtypes\call_host_container;
use function LeanCallbacksubtypes\call_host_mixed;
use function LeanCallbacksubtypes\make_closure;
use function LeanCallbacksubtypes\make_container_closure;
use function LeanCallbacksubtypes\make_mixed_closure;
use function LeanCallbacksubtypes\with_recovery;

$checks = 0;
$rejections = 0;
$calls = 0;
$check = function(bool $value, string $label) use (&$checks): void {
    if (!$value) throw new RuntimeException($label);
    ++$checks;
};
$reject = function(callable $operation, string $kind = Throwable::class) use (&$rejections): Throwable {
    try { $operation(); }
    catch (Throwable $error) {
        if ($error instanceof $kind) { ++$rejections; return $error; }
        throw $error;
    }
    throw new RuntimeException("expected {$kind}");
};
$n = fn(int $value): BigInteger => BigInteger::of($value);

$increment = function(BigInteger $value) use (&$calls): BigInteger {
    ++$calls;
    return $value->plus(1);
};
$check(call_host(with_recovery($increment, $n(1)))->isEqualTo($n(2)), 'valid host result');
$before = $calls;
$check($reject(fn() => call_host($increment), TypeError::class) instanceof TypeError,
    'missing recovery status');
$check($calls === $before, 'missing recovery stops callback');
$check($reject(fn() => call_host(with_recovery($increment, $n(0))), LeanBridgeError::class)->getCode() === 1,
    'invalid recovery status');
$check($calls === $before, 'invalid recovery stops callback');
$invalidHostResult = function(BigInteger $_value) use (&$calls, $n): BigInteger {
    ++$calls;
    return $n(0);
};
$check($reject(fn() => call_host(with_recovery($invalidHostResult, $n(1))), LeanBridgeError::class)->getCode() === 1,
    'invalid host result status');
$check($calls === $before + 1, 'invalid host result calls once');
$sentinel = new RuntimeException('callback failed');
$throwing = function(BigInteger $_value) use (&$calls, $sentinel): never {
    ++$calls;
    throw $sentinel;
};
$check($reject(fn() => call_host(with_recovery($throwing, $n(1)))) === $sentinel,
    'callback exception identity');
$check(call_host(with_recovery(function(BigInteger $value) use (&$calls): BigInteger {
    ++$calls;
    return $value;
}, $n(1)))->isEqualTo($n(1)), 'host recovery reuse');
$check(call_host_mixed(with_recovery(function(BigInteger $marker, BigInteger $value) use (&$calls): BigInteger {
    ++$calls;
    return $marker->minus(5)->plus($value);
}, $n(1)))->isEqualTo($n(3)), 'mixed host result');

$closure = make_closure($n(9));
$check($closure($n(2))->isEqualTo($n(2)), 'closure result');
$check($reject(fn() => $closure($n(0)), LeanBridgeError::class)->getCode() === 1,
    'closure argument status');
$check($closure($n(3))->isEqualTo($n(3)), 'closure recovery');
$closure->close(); $closure->close();
$check($closure->isClosed(), 'closure closes idempotently');

$mixed = make_mixed_closure($n(0));
$check($mixed($n(9), $n(2))->isEqualTo($n(2)), 'mixed closure result');
$check($reject(fn() => $mixed($n(9), $n(0)), LeanBridgeError::class)->getCode() === 1,
    'mixed closure argument status');
$check($mixed($n(9), $n(3))->isEqualTo($n(3)), 'mixed closure recovery');
$mixed->close();

$containerRecovery = new Ok(new Some($n(1)));
$reply = call_host_container(with_recovery(function(mixed $value) use (&$calls, $check, $n): Ok {
    ++$calls;
    $check($value === null, 'nested host argument');
    return new Ok(new Some($n(2)));
}, $containerRecovery));
$check($reply instanceof Ok && $reply->value instanceof Some
    && $reply->value->value->isEqualTo($n(2)), 'nested host result');
$before = $calls;
$unexpectedNested = function(mixed $_value) use (&$calls): Ok { ++$calls; return new Ok(null); };
$check($reject(fn() => call_host_container(with_recovery($unexpectedNested,
    new Ok(new Some($n(0))))), LeanBridgeError::class)->getCode() === 1,
    'nested recovery status');
$check($calls === $before, 'nested recovery stops callback');
$invalidNestedResult = function(mixed $_value) use (&$calls, $n): Ok {
    ++$calls; return new Ok(new Some($n(0)));
};
$check($reject(fn() => call_host_container(with_recovery($invalidNestedResult,
    $containerRecovery)), LeanBridgeError::class)->getCode() === 1,
    'nested host result status');
$reply = call_host_container(with_recovery(
    function(mixed $_value) use (&$calls): Ok { ++$calls; return new Ok(null); },
    $containerRecovery));
$check($reply instanceof Ok && $reply->value === null, 'nested host recovery');

$container = make_container_closure($n(0));
$check($container([null, new Some($n(2))]) === null, 'nested closure result');
$check($reject(fn() => $container([new Some($n(0))]), LeanBridgeError::class)->getCode() === 1,
    'nested closure argument status');
$check($container([]) === null, 'nested closure recovery');
$container->close(); $container->close();
$check($container->isClosed(), 'nested closure closes idempotently');
$check($calls === 8, 'callback call count');

echo json_encode([
    'checks' => $checks,
    'rejections' => $rejections,
    'callback_calls' => $calls,
    'word_bits' => PHP_INT_SIZE * 8,
    'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR) . "\n";
