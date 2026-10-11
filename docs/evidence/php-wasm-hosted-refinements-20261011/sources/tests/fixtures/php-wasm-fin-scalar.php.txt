<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanNativeFin\LeanBridgeError;
$checks = 0;
function check(bool $value, string $label): void {
    global $checks;
    if (!$value) throw new RuntimeException("failed: $label");
    ++$checks;
}
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
function throwsType(string $type, callable $call): bool {
    try { $call(); } catch (Throwable $error) { return $error instanceof $type; }
    return false;
}
function n(int|string $value): BigInteger { return BigInteger::of($value); }
$huge = BigInteger::of(2)->power(70); $word = BigInteger::of(2)->power(32);
check(rejected(fn() => LeanNativeFin\impossible(n(0)), 'arg0', '0'), 'Fin 0 rejects zero');
check(rejected(fn() => LeanNativeFin\impossible(n(1)), 'arg0', '0'), 'Fin 0 rejects one');
check(LeanNativeFin\only(n(0))->isEqualTo(7), 'Fin 1 accepts zero');
check(rejected(fn() => LeanNativeFin\only(n(1)), 'arg0', '1'), 'Fin 1 rejects its bound');
check(LeanNativeFin\mirror(n(0))->isEqualTo(9) && LeanNativeFin\mirror(n(9))->isEqualTo(0), 'Fin 10 endpoints');
check(LeanNativeFin\mirror(n(4)) instanceof BigInteger, 'exact BigInteger results');
foreach ([n(10), n(11), $word, $huge] as $value)
    check(rejected(fn() => LeanNativeFin\mirror($value), 'arg0', '10'), 'Fin 10 rejects ' . $value);
check(throwsType(ValueError::class, fn() => LeanNativeFin\mirror(n(-1))), 'negative is the Nat ValueError');
foreach ([1, '1', 1.0, true, null] as $value)
    check(throwsType(TypeError::class, fn() => LeanNativeFin\mirror($value)), 'non-BigInteger is TypeError: ' . get_debug_type($value));
check(LeanNativeFin\twice(n(299))->isEqualTo(598), 'alias accepts its largest value');
check(rejected(fn() => LeanNativeFin\twice(n(300)), 'arg0', '300'), 'alias rejects its bound');
check(rejected(fn() => LeanNativeFin\twice(n(301)), 'arg0', '300'), 'alias rejects beyond its bound');
check(LeanNativeFin\succ_huge($word)->isEqualTo($word->plus(1)), 'large Fin crosses a limb');
check(LeanNativeFin\succ_huge($huge->minus(2))->isEqualTo($huge->minus(1)) && LeanNativeFin\succ_huge($huge->minus(1))->isEqualTo($huge->minus(1)), 'large Fin endpoints');
foreach ([$huge, $huge->plus(1), BigInteger::of(2)->power(128)] as $value)
    check(rejected(fn() => LeanNativeFin\succ_huge($value), 'arg0', (string) $huge), 'large Fin rejects ' . $value);
check(LeanNativeFin\wrap(n(100))->isEqualTo(2) && LeanNativeFin\wrap($huge)->isEqualTo(2) && LeanNativeFin\wrap(n(0))->isEqualTo(0), 'result-only Fin values');
$base = n(5); $name = 'slot';
check(LeanNativeFin\label($base, n(3), $name) === 'slot:8', 'mixed arguments');
check(rejected(fn() => LeanNativeFin\label($base, n(4), $name), 'arg1', '4'), 'mixed arguments reject the Fin site');
check($base->isEqualTo(5) && $name === 'slot' && LeanNativeFin\label($base, n(0), $name) === 'slot:5', 'caller data unchanged');
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => LeanNativeFin\mirror(n(10 + $i)), 'arg0', '10')) throw new RuntimeException("invalid call accepted at $i");
    if (!LeanNativeFin\mirror(n($i % 10))->isEqualTo(9 - $i % 10)) throw new RuntimeException("valid call failed at $i");
}
$checks += 2000;
echo "php-fin-ok:$checks\n";
