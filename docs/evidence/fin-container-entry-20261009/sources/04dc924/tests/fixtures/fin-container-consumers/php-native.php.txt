<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanFincontainers\Some;
use LeanFincontainers\LeanBridgeError;
use function LeanFincontainers\{mirror_all, count_none, sum_huge, or_default, present, flatten, label, wrap_all};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
function throwsType(string $type, callable $call): bool {
    try { $call(); } catch (Throwable $error) { return $error instanceof $type; }
    return false;
}
function texts(array $values): array { return array_map(fn($v) => (string)$v, $values); }
$huge = BigInteger::of(2)->power(70);
$word = BigInteger::of(2)->power(32);
$digits = array_map('n', range(0, 9));
// Array (Fin 10): every element is checked; results stay below the bound.
check(texts(mirror_all($digits)) === texts(array_reverse($digits)), 'mirror endpoints');
check(mirror_all([]) === [], 'empty array');
for ($position = 0; $position < 3; ++$position) {
    $bad = [n(1), n(2), n(3)];
    $bad[$position] = n(10);
    check(rejected(fn() => mirror_all($bad), 'arg0', '10'), 'invalid element at ' . $position);
    check($bad[$position]->isEqualTo(10), 'input unchanged');
}
check(rejected(fn() => mirror_all([$word, n(1), n(2)]), 'arg0', '10'), 'word element');
check(throwsType(ValueError::class, fn() => mirror_all([n(-1), n(1)])), 'negative is the Nat ValueError');
check(throwsType(TypeError::class, fn() => mirror_all([1])) && throwsType(TypeError::class, fn() => mirror_all(n(1))), 'non-BigInteger elements are TypeError');
// Array (Fin 0): only the empty array has values.
check(count_none([])->isEqualTo(0), 'Fin 0 empty');
check(rejected(fn() => count_none([n(0)]), 'arg0', '0'), 'Fin 0 present');
// List Huge: a 2^70 bound compared limb by limb.
check(sum_huge([$word, $huge->minus(1)])->isEqualTo($word->plus($huge)->minus(1)) && sum_huge([])->isEqualTo(0), 'huge sums');
check(rejected(fn() => sum_huge([$word, $huge]), 'arg0', (string)$huge), 'huge bound');
// Option (Fin 1): none is valid; a present value is checked.
check(or_default(null)->isEqualTo(7) && or_default(new Some(n(0)))->isEqualTo(0), 'option values');
check(rejected(fn() => or_default(new Some(n(1))), 'arg0', '1'), 'present Fin 1');
// Array (Option Digit): only present elements are checked.
check(texts(present([new Some(n(1)), null, new Some(n(9))])) === ['1', '9'], 'present digits');
check(rejected(fn() => present([new Some(n(1)), null, new Some(n(10))]), 'arg0', '10'), 'present invalid');
check(count(present([new Some(n(1)), null, null])) === 1, 'absent is never read');
// List (Array Digit) -> Option (List Digit): nested rows.
$flat = flatten([[n(1), n(2)], [n(3)]]);
check($flat instanceof Some && texts($flat->value) === ['1', '2', '3'], 'flatten rows');
check(flatten([]) === null, 'no rows');
check(rejected(fn() => flatten([[n(1), n(2)], [n(10)]]), 'arg0', '10'), 'nested invalid last');
// A late refined argument after an unrefined one.
$names = ['a', 'b'];
check(label($names, [n(1), n(3)]) === 'a:1,b:3', 'label');
check(rejected(fn() => label($names, [n(1), n(4)]), 'arg1', '4') && $names === ['a', 'b'], 'late argument, caller data unchanged');
// A result-only container refinement projects each element after Lean returns.
check(texts(wrap_all([n(100), $huge])) === ['2', '2'] && wrap_all([]) === [], 'wrapped results');
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => mirror_all([n(10 + $i % 5)]), 'arg0', '10')) throw new Exception('invalid call accepted at ' . $i);
    if (!mirror_all([n($i % 10)])[0]->isEqualTo(9 - $i % 10)) throw new Exception('valid call failed at ' . $i);
}
$checks += 2000;
echo "fin-container-ok:$checks\n";
