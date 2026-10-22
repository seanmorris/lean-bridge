<?php
// Installed PHP-Wasm acceptance for checked Fin callbacks and closures.
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanReviewedcallbacks\LeanBridgeError;
use LeanReviewedcallbacks\Tile;
use function LeanReviewedcallbacks\apply;
use function LeanReviewedcallbacks\counter;
use function LeanReviewedcallbacks\digits;
use function LeanReviewedcallbacks\scaler;
use function LeanReviewedcallbacks\three;
use function LeanReviewedcallbacks\tile_maker;
use function LeanReviewedcallbacks\tiles;
use function LeanReviewedcallbacks\visit;
use function LeanReviewedcallbacks\with_recovery;

$checks = 0;
$rejections = 0;
$calls = 0;
$check = function(bool $value, string $label) use (&$checks): void {
    if (!$value) throw new RuntimeException($label);
    ++$checks;
};
$reject = function(callable $operation) use (&$rejections): Throwable {
    try { $operation(); }
    catch (Throwable $error) { ++$rejections; return $error; }
    throw new RuntimeException('expected rejection');
};
$n = fn(int $value): BigInteger => BigInteger::of($value);

$scale = scaler($n(3));
$check($scale($n(4))->isEqualTo($n(12)), 'closure Fin input');
$check($reject(fn() => $scale($n(10))) instanceof LeanBridgeError, 'closure Fin input rejection');
$check($scale($n(2))->isEqualTo($n(6)), 'closure Fin recovery');
$scale->close(); $scale->close();
$check($scale->isClosed(), 'closure closes idempotently');

$count = counter($n(8));
$check($count($n(5))->isEqualTo($n(3)), 'closure Fin result');
$check($count($n(12))->isZero(), 'closure Fin result wraps');
$count->close();

$seen = [];
$host = function(BigInteger $digit) use (&$calls, &$seen): BigInteger {
    ++$calls; $seen[] = $digit->toInt(); return $digit->plus(1);
};
$check(visit(with_recovery($host, $n(0)))->isEqualTo($n(15)), 'host Fin arguments');
$check($seen === [0, 1, 2, 3, 4], 'host argument order');
$before = $calls;
$check($reject(fn() => visit($host)) instanceof TypeError, 'host callback requires recovery');
$check($calls === $before, 'missing recovery stops host callback');

$array = digits($n(0));
$check($array([$n(1), $n(2), $n(0)])->isEqualTo($n(15)), 'nested closure Fin inputs');
$check($reject(fn() => $array([$n(3)])) instanceof LeanBridgeError, 'nested closure Fin rejection');
$check($array([])->isZero(), 'nested closure recovery');
$array->close();

$rows = tiles($n(0));
$tile = fn(int $digit, int $count): Tile => new Tile($n($digit), $n($count));
$check($rows([$tile(2, 5), $tile(4, 1)])->isEqualTo($n(606)), 'nominal closure Fin fields');
$check($reject(fn() => $rows([$tile(5, 1)])) instanceof LeanBridgeError, 'nominal field rejection');
$rows->close();

$maker = tile_maker($n(4));
$made = $maker($n(3));
$check($made->equals($tile(2, 3)), 'nominal closure result');
$maker->close();

$plain = function(BigInteger $value) use (&$calls): BigInteger { ++$calls; return $value->plus(2); };
$check(apply($plain, $n(8))->isEqualTo($n(10)), 'ordinary callback remains ordinary');

$identity = function(BigInteger $value) use (&$calls): BigInteger { ++$calls; return $value; };
$check(three(with_recovery($identity, $n(0)), $n(2))->isEqualTo($n(2)), 'host Fin reply');
$check($reject(fn() => three(with_recovery(fn(BigInteger $_value) => $n(3), $n(0)), $n(1))) instanceof LeanBridgeError,
    'host Fin reply rejection');
$check($reject(fn() => three(with_recovery($identity, $n(3)), $n(1))) instanceof LeanBridgeError,
    'host Fin recovery rejection');
$check($reject(fn() => three(with_recovery($identity, $n(0)), $n(3))) instanceof LeanBridgeError,
    'ordinary Fin argument rejection');
$check(three(with_recovery($identity, $n(0)), $n(1))->isEqualTo($n(1)), 'host Fin recovery');
$check($calls === 7, 'callback call count');

echo json_encode([
    'checks' => $checks,
    'rejections' => $rejections,
    'callback_calls' => $calls,
    'word_bits' => PHP_INT_SIZE * 8,
    'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR) . "\n";
