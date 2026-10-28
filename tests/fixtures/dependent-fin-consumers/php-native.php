<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanDependentfin\LeanBridgeError;
use function LeanDependentfin\{mirror, label};

$checks = 0;
function check($condition, string $message): void {
    global $checks;
    if (!$condition) throw new Exception('failed: ' . $message);
    ++$checks;
}
function n($value): BigInteger { return BigInteger::of($value); }
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) {
        return $error->getCode() === 1
            && $error->getMessage() === "$parameter is not below its dependent Fin bound $bound";
    }
    return false;
}
function throwsType(string $type, callable $call): bool {
    try { $call(); } catch (Throwable $error) { return $error instanceof $type; }
    return false;
}

$huge = n(2)->power(70);
$word = n(2)->power(32);
// Fin 0: the live bound zero has no values.
check(rejected(fn() => mirror(n(0), n(0)), 'arg1', 'arg0'), 'Fin 0 rejects zero');
check(rejected(fn() => mirror(n(0), n(1)), 'arg1', 'arg0'), 'Fin 0 rejects one');
// Fin 1: only zero.
check(mirror(n(1), n(0))->isEqualTo(0), 'Fin 1 accepts zero');
check(rejected(fn() => mirror(n(1), n(1)), 'arg1', 'arg0'), 'Fin 1 rejects its bound');
// Exact endpoints of a small live bound.
check(mirror(n(10), n(0))->isEqualTo(9)
    && mirror(n(10), n(9))->isEqualTo(0), 'Fin 10 endpoints');
foreach ([n(10), n(11), $word, $huge] as $value)
    check(rejected(fn() => mirror(n(10), $value), 'arg1', 'arg0'), 'Fin 10 rejects ' . $value);
// Live bounds wider than a machine word are compared limb by limb.
check(mirror($word, $word->minus(1))->isEqualTo(0)
    && mirror($word->plus(1), $word)->isEqualTo(0), 'word bounds');
check(rejected(fn() => mirror($word, $word), 'arg1', 'arg0'), 'word bound rejects itself');
check(mirror($huge, $huge->minus(1))->isEqualTo(0)
    && mirror($huge, n(0))->isEqualTo($huge->minus(1)), 'huge endpoints');
check(mirror($huge->plus(1), $huge)->isEqualTo(0), 'one past huge');
foreach ([$huge, $huge->plus(1), n(2)->power(128)] as $value)
    check(rejected(fn() => mirror($huge, $value), 'arg1', 'arg0'), 'huge reject ' . $value);
// The bound is the argument of this call, never a frozen constant.
for ($bound = 0; $bound < 12; ++$bound) {
    if ($bound > 5)
        check(mirror(n($bound), n(5))->isEqualTo($bound - 6), 'live bound ' . $bound);
    else check(rejected(fn() => mirror(n($bound), n(5)), 'arg1', 'arg0'), 'reject live bound ' . $bound);
}
// The later arg2 depends on arg1, not the unrelated larger arg0.
check(label(n(100), n(3), n(2), 'slot') === 'slot:102', 'later dependency');
check(rejected(fn() => label(n(100), n(3), n(3), 'slot'), 'arg2', 'arg1'), 'correct later bound');
check(rejected(fn() => label(n(100), n(0), n(0), 'slot'), 'arg2', 'arg1'), 'later Fin 0');
check(label(n(0), $huge, $huge->minus(1), 'x') === 'x:' . $huge->minus(1), 'later huge');
// Ordinary Nat/type validation happens before the dependent Fin check.
check(throwsType(ValueError::class, fn() => mirror(n(-1), n(0))), 'negative bound');
check(throwsType(ValueError::class, fn() => mirror(n(5), n(-1))), 'negative value');
check(throwsType(TypeError::class, fn() => mirror(n(5), 1.5)), 'float value');
// Rejection leaves caller values unchanged.
$start = n(7); $bound = n(4); $value = n(4); $name = 'slot';
check(rejected(fn() => label($start, $bound, $value, $name), 'arg2', 'arg1'), 'rejected label');
check($start->isEqualTo(7) && $bound->isEqualTo(4) && $value->isEqualTo(4)
    && $name === 'slot' && label($start, $bound, n(3), $name) === 'slot:10', 'caller unchanged');
// 1000 rejection/recovery cycles use a different live bound on every valid call.
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => mirror(n(10), n(10 + $i % 5)), 'arg1', 'arg0'))
        throw new Exception('invalid call accepted at ' . $i);
    if (!mirror(n($i % 7 + 1), n($i % 7))->isEqualTo(0)
        || !mirror(n(10), n($i % 10))->isEqualTo(9 - $i % 10))
        throw new Exception('valid call failed at ' . $i);
}
$checks += 2000;
echo "dependent-fin-ok:$checks\n";
