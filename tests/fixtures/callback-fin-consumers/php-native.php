<?php
// Installed native PHP acceptance for checked Fin callbacks and Lean closures.
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanReviewedcallbacks\LeanBridgeError;
use LeanReviewedcallbacks\Tile;
use function LeanReviewedcallbacks\apply;
use function LeanReviewedcallbacks\counter;
use function LeanReviewedcallbacks\digits;
use function LeanReviewedcallbacks\scaler;
use function LeanReviewedcallbacks\tile_maker;
use function LeanReviewedcallbacks\tiles;
use function LeanReviewedcallbacks\visit;

$checks = 0;
$calls = 0;
$n = fn(int $value): BigInteger => BigInteger::of($value);
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
$refuses = fn(callable $operation): bool =>
    $reject($operation, LeanBridgeError::class)->getCode() === 1;

$scaler = scaler($n(3));
$check($scaler($n(4))->isEqualTo($n(12)), 'bounded closure argument');
$check($refuses(fn() => $scaler($n(10))), 'Fin 10 is refused');
$check($scaler($n(9))->isEqualTo($n(27)), 'closure remains usable');

$counter = counter($n(8));
$check($counter($n(4))->isEqualTo($n(2)), 'Lean-produced Fin result');

$host = function(BigInteger $value) use (&$calls, $n): BigInteger {
    ++$calls;
    if ($value->isNegative() || $value->isGreaterThanOrEqualTo($n(5)))
        throw new RuntimeException('Lean supplied an invalid Fin');
    return $value;
};
$check(visit($host)->isEqualTo($n(10)),
    'checked host callback arguments');
$check($calls === 5, 'host receives every Fin 5 value');
$sentinel = new RuntimeException('callback Fin sentinel');
$check($reject(fn() => visit(fn(BigInteger $_value) => throw $sentinel)) === $sentinel,
    'callback exception identity');
$check(apply(fn(BigInteger $value) => $value->plus(1), $n(2))->isEqualTo($n(3)),
    'unrefined callback stays direct');

$digits = digits(null);
$check($digits([$n(1), $n(2)])->isEqualTo($n(5)), 'nested Fin callback argument');
$check($refuses(fn() => $digits([$n(3)])), 'nested bound is refused');
$check($digits([])->isZero(), 'nested closure remains usable');

$tiles = tiles(null);
$check($tiles([new Tile($n(4), $n(2))])->isEqualTo($n(402)),
    'nominal Fin callback field');
$check($refuses(fn() => $tiles([new Tile($n(5), $n(2))])),
    'nominal Fin field is refused');

$tileMaker = tile_maker($n(3));
$check($tileMaker($n(4))->equals(new Tile($n(2), $n(4))),
    'Lean-produced nominal Fin field');

foreach ([$scaler, $counter, $digits, $tiles, $tileMaker] as $closure) {
    $closure->close(); $closure->close();
    $check($closure->isClosed(), 'closure closes idempotently');
}

echo "callback-fin-remaining-ok:{$checks}\n";
