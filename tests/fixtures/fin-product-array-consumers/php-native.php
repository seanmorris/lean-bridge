<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanFinproductarrays\{Ok, Err, LeanBridgeError};
use function LeanFinproductarrays\{rows, reversed};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
// Rows compare by component, active branch and that branch's value.
function same(array $a, array $b): bool {
    if (count($a) !== count($b)) return false;
    foreach ($a as $i => [$component, $branch])
        if (!$component->isEqualTo($b[$i][0]) || get_class($branch) !== get_class($b[$i][1]) || !$branch->value->isEqualTo($b[$i][1]->value)) return false;
    return true;
}
// (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
$huge = BigInteger::of(2)->power(100);
$valid = fn() => [[n(0), new Ok($huge)], [n(2), new Err(n(5))], [n(3), new Ok(n(6))]];
$expected = $huge->plus(1016);
// An empty array is valid, in and out.
check(rows([])->isEqualTo(0), 'empty rows');
check(reversed([]) === [], 'empty reversed');
$rows = $valid();
check(rows($rows)->isEqualTo($expected), 'valid rows');
// A component at its bound is rejected in the first, middle and last element.
for ($k = 0; $k < 3; ++$k) {
    $rows[$k][0] = n(4);
    $before = array_map(fn($row) => [$row[0], clone $row[1]], $rows);
    check(rejected(fn() => rows($rows), "arg0[$k].0", '4') && same($rows, $before), "component at $k");
    $rows[$k][0] = $valid()[$k][0];
}
// The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
$rows[1][1] = new Err(n(6));
$before = array_map(fn($row) => [$row[0], clone $row[1]], $rows);
check(rejected(fn() => rows($rows), 'arg0[1].1.error', '6') && same($rows, $before), 'error branch at bound');
$rows[1][1] = new Err(n(5));
// A valid call recovers.
check(same($rows, $valid()), 'caller rows unchanged');
check(rows($rows)->isEqualTo($expected), 'recovery');
// Lean returns the rows reversed, each below its bounds.
check(same(reversed($rows), array_reverse($valid())), 'reversed');
for ($i = 0; $i < 1000; ++$i) {
    if (!rows($rows)->isEqualTo($expected)) throw new Exception("round $i failed");
    $bad = $rows; $bad[2][0] = n(4 + $i);
    if (!rejected(fn() => rows($bad), 'arg0[2].0', '4') || !$bad[2][0]->isEqualTo(4 + $i)) throw new Exception("rejection round $i failed");
}
$checks += 2000;
echo "fin-product-array-ok:$checks\n";
