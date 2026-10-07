<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanFinrecords\{Some, Tile, Nest, Late, Slot, ShapeCircle, ShapeLabel, ShapeEmpty, GateClosed, GateNever, LeanBridgeError};
use function LeanFinrecords\{tile_sum, nest_sum, late_sum, slot_count, shape_size, gate_open, tiles, maybe_shape, bump, make_shape};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $parameter, string $bound): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === "$parameter is not below its Fin $bound bound"; }
    return false;
}
function tile($digit, $count) { return new Tile($digit instanceof BigInteger ? $digit : n($digit), $count instanceof BigInteger ? $count : n($count)); }
/** Element-wise equality for a list of generated values. */
function same_list(array $left, array $right): bool {
    if (count($left) !== count($right)) return false;
    foreach ($left as $i => $value) if (!$value->equals($right[$i])) return false;
    return true;
}
$huge = BigInteger::of(2)->power(100);
// Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
// independently built copy before the caller changes it back.
for ($d = 0; $d < 5; ++$d) check(tile_sum(tile($d, 10))->isEqualTo($d + 10), 'tile valid');
check(tile_sum(tile(3, $huge))->isEqualTo($huge->plus(3)), 'tile unbounded count');
$t = tile(5, $huge);
check(rejected(fn() => tile_sum($t), 'arg0', '5') && $t->equals(tile(5, BigInteger::of(2)->power(100))), 'tile at bound');
$t = tile(BigInteger::of(2)->power(70), $huge);
check(rejected(fn() => tile_sum($t), 'arg0', '5') && $t->equals(tile(BigInteger::of(2)->power(70), BigInteger::of(2)->power(100))), 'tile beyond 64 bits');
// Nest: the inner record's own bound and the outer bound are both checked.
$nest = fn(int $digit, int $tag) => new Nest(tile($digit, 6), n($tag));
check(nest_sum($nest(4, 2))->isEqualTo(210), 'nest valid');
$value = $nest(5, 2);
check(rejected(fn() => nest_sum($value), 'arg0', '5') && $value->equals($nest(5, 2)), 'nest inner at bound');
$value = $nest(4, 3);
check(rejected(fn() => nest_sum($value), 'arg0', '3') && $value->equals($nest(4, 3)), 'nest tag at bound');
check(nest_sum($nest(4, 2))->isEqualTo(210), 'nest recovery');
// Late: heap fields precede the bound; a rejection leaves them as the caller built them.
$items = [n(1), n(2)];
check(late_sum(new Late('ab', $items, n(4)))->isEqualTo(4005), 'late valid');
$late = new Late('ab', $items, n(5));
check(rejected(fn() => late_sum($late), 'arg0', '5') && $late->equals(new Late('ab', [n(1), n(2)], n(5))), 'late at bound');
check(late_sum(new Late('ab', $items, n(4)))->isEqualTo(4005), 'late recovery');
// Slot: Option (Fin 0) is valid only when absent.
check(slot_count(new Slot(null, n(8)))->isEqualTo(8), 'slot absent');
$slot = new Slot(new Some(n(0)), n(8));
check(rejected(fn() => slot_count($slot), 'arg0', '0') && $slot->equals(new Slot(new Some(n(0)), n(8))), 'slot present');
// Shape: only the active case is checked.
check(shape_size(new ShapeCircle(n(9)))->isEqualTo(9), 'circle valid');
$shape = new ShapeCircle(n(10));
check(rejected(fn() => shape_size($shape), 'arg0', '10') && $shape->equals(new ShapeCircle(n(10))), 'circle at bound');
check(shape_size(new ShapeLabel('abc'))->isEqualTo(1003), 'label');
check(shape_size(new ShapeEmpty())->isEqualTo(7), 'empty');
// Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
check(gate_open(new GateClosed())->isEqualTo(1), 'gate closed');
$gate = new GateNever(n(0));
check(rejected(fn() => gate_open($gate), 'arg0', '0') && $gate->equals(new GateNever(n(0))), 'gate never');
// Array Tile: every element; the empty array is valid.
$fresh = fn() => [tile(0, 1), tile(4, 2), tile(1, 0)];
$row = $fresh();
check(tiles([])->isEqualTo(0), 'tiles empty');
check(tiles($row)->isEqualTo(8), 'tiles valid');
for ($k = 0; $k < 3; ++$k) {
    $kept = $row[$k];
    $row[$k] = tile(5, $kept->count);
    $before = $fresh();
    $before[$k] = tile(5, $before[$k]->count);
    check(rejected(fn() => tiles($row), 'arg0', '5') && same_list($row, $before), "tiles element $k");
    $row[$k] = $kept;
}
check(tiles($row)->isEqualTo(8), 'tiles recovery');
// Option Shape: absent, a valid present circle, then an invalid one.
check(maybe_shape(null)->isEqualTo(99), 'maybe absent');
check(maybe_shape(new Some(new ShapeCircle(n(3))))->isEqualTo(3), 'maybe present');
$maybe = new Some(new ShapeCircle(n(10)));
check(rejected(fn() => maybe_shape($maybe), 'arg0', '10') && $maybe->equals(new Some(new ShapeCircle(n(10)))), 'maybe at bound');
// Results carrying bounds are produced by Lean and arrive below them.
check(bump(tile(4, 9))->equals(tile(0, 10)), 'bump');
$t = tile(5, 9);
check(rejected(fn() => bump($t), 'arg0', '5') && $t->equals(tile(5, 9)), 'bump at bound');
check(make_shape(n(4))->equals(new ShapeCircle(n(4))), 'make circle');
check(make_shape(n(23))->equals(new ShapeLabel('23')), 'make label');
for ($i = 0; $i < 1000; ++$i) {
    if (!tile_sum(tile($i % 5, $i))->isEqualTo($i % 5 + $i)) throw new Exception("round $i failed");
    $t = tile(5 + $i, $i);
    if (!rejected(fn() => tile_sum($t), 'arg0', '5') || !$t->equals(tile(5 + $i, $i))) throw new Exception("rejection round $i failed");
}
$checks += 2000;
echo "fin-record-ok:$checks\n";
