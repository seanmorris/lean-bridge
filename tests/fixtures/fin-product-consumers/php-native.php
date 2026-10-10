<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanFinproducts\{Some, Ok, Err, LeanBridgeError};
use function LeanFinproducts\{first, second, wide, absent_only, ok_only, error_only, both, nested, aliased, produce, pair_up};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
$wide = BigInteger::of(10)->shiftedLeft(64)->plus(10);
$same = fn(array $pair, int $a, $b) => $pair[0]->isEqualTo($a) && $pair[1]->isEqualTo($b);
// Fin 10 × Nat: only the first component is bounded.
for ($d = 0; $d < 10; ++$d) check($same(first([n($d), n(1000)]), 9 - $d, 1001), 'first valid');
check(rejected(fn() => first([n(10), n(0)]), 'arg0.0', '10'), 'first at bound');
check(rejected(fn() => first([BigInteger::of(2)->power(70), n(0)]), 'arg0.0', '10'), 'first beyond 64 bits');
check(first([n(3), BigInteger::of(2)->power(200)])[1]->isEqualTo(BigInteger::of(2)->power(200)->plus(1)), 'unbounded component');
// Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
check(second([n(41), n(0)])->isEqualTo(41), 'second valid');
check(rejected(fn() => second([n(41), n(1)]), 'arg0.1', '1'), 'second at bound');
check(wide([$wide->minus(1), n(9)])->isEqualTo($wide->plus(8)), 'wide valid');
check(rejected(fn() => wide([$wide, n(9)]), 'arg0.0', (string)$wide), 'wide at bound');
check(rejected(fn() => wide([$wide->minus(1), n(10)]), 'arg0.1', '10'), 'wide second at bound');
// Option (Fin 0 × Nat): only none is valid.
check(absent_only(null)->isEqualTo(7), 'absent only none');
check(rejected(fn() => absent_only(new Some([n(0), n(0)])), 'arg0?.0', '0'), 'absent only some');
// Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
check(ok_only(new Ok(n(9)))->isEqualTo(9), 'ok valid');
check(rejected(fn() => ok_only(new Ok(n(10))), 'arg0.ok', '10'), 'ok at bound');
check(ok_only(new Err('four'))->isEqualTo(104), 'inactive ok');
// Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
check(error_only(new Ok(BigInteger::of(2)->power(100)))->isEqualTo(BigInteger::of(2)->power(100)), 'unbounded ok');
check(error_only(new Err(n(4)))->isEqualTo(104), 'error valid');
check(rejected(fn() => error_only(new Err(n(5))), 'arg0.error', '5'), 'error at bound');
// Except (Fin 3) (Fin 7): only the active branch is checked.
check(both(new Ok(n(6)))->isEqualTo(6), 'both ok valid');
check(rejected(fn() => both(new Ok(n(7))), 'arg0.ok', '7'), 'both ok at bound');
check(both(new Err(n(2)))->isEqualTo(102), 'both error valid');
check(rejected(fn() => both(new Err(n(3))), 'arg0.error', '3'), 'both error at bound');
// List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
$rows = fn(int $a, int $b) => [null, new Some([n($a), new Ok(n(50))]), new Some([n(1), new Err(n($b))])];
check(nested($rows(2, 1))->isEqualTo(54), 'nested valid');
check(rejected(fn() => nested($rows(2, 2)), 'arg0[2]?.1.error', '2'), 'nested branch');
check(rejected(fn() => nested($rows(3, 1)), 'arg0[1]?.0', '3'), 'nested component');
check(nested($rows(2, 1))->isEqualTo(54), 'nested recovery');
// DigitPair := Digit × Digit through the alias.
check($same(aliased([n(1), n(9)]), 9, 1), 'aliased valid');
check(rejected(fn() => aliased([n(1), n(10)]), 'arg0.1', '10'), 'aliased at bound');
// Results carrying bounds are produced by Lean and arrive below them.
$produced = produce(n(4));
check($produced instanceof Err && $produced->value->isEqualTo(4), 'produce error');
check(produce(n(23)) instanceof Ok, 'produce ok');
check($same(pair_up(n(23)), 3, 23), 'pair up');
for ($i = 0; $i < 1000; ++$i) {
    if (!first([n($i % 10), n($i)])[0]->isEqualTo(9 - $i % 10)) throw new Exception("round $i failed");
    if (!rejected(fn() => first([n(10 + $i), n($i)]), 'arg0.0', '10')) throw new Exception("rejection round $i failed");
}
$checks += 2000;
echo "fin-product-ok:$checks\n";
