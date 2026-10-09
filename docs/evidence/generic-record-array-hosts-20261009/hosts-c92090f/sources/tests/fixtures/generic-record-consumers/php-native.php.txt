<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanGenericrecords\{Some, NatBox, NatBoxAgain, TextBox, WordPair, MaybeBox, BoxPair, TaggedNat, MarkerTag};
use function LeanGenericrecords\{bump, again, shout, swap_named, or_zero, total, first_boxes, unpair, retag, relabel};
$checks = 0;
function check($condition) { global $checks; if (!$condition) throw new Exception('Generic record mismatch at line ' . debug_backtrace()[0]['line']); ++$checks; }
function rejected(callable $call): bool { try { $call(); } catch (TypeError|ValueError|ArgumentCountError $error) { return true; } return false; }
$n = fn(int $value) => BigInteger::of($value);
$natBox = fn(int $value, int $count) => new NatBox($n($value), $n($count));
// Each alias is its own readonly class with the structure's fields instantiated; Nat fields are BigInteger.
$box = $natBox(4, 1);
$bumped = bump($box);
check($bumped instanceof NatBox && $bumped->value->isEqualTo(5) && $bumped->count->isEqualTo(2) && $box->value->isEqualTo(4) && $bumped !== $box);
$again = again(new NatBoxAgain($n(4), $n(1)));
check($again instanceof NatBoxAgain && $again->value->isEqualTo(8) && $again->count->isEqualTo(1));
// Two aliases of one application are two distinct classes with the same layout; each call checks the exact class.
check(rejected(fn() => bump(new NatBoxAgain($n(1), $n(2)))));
check(rejected(fn() => again($natBox(1, 2))));
$greeting = "h\u{e9}llo \u{1F642}";
$shouted = shout(new TextBox($greeting, $n(3)));
check($shouted->value === "$greeting!" && $shouted->count->isEqualTo(3));
$swapped = swap_named(new WordPair('a', $n(1)));
check($swapped->first === 'a!' && $swapped->second->isEqualTo(2));
// A parameter instantiated with Option Nat and a List of a named instantiation.
check(or_zero(new MaybeBox(new Some($n(5)), $n(2)))->isEqualTo(7));
check(or_zero(new MaybeBox(null, $n(2)))->isEqualTo(2));
$huge = BigInteger::of(2)->power(70);
$boxes = [$natBox(1, 0), $natBox(2, 0), new NatBox($huge, $n(0))];
check(total($boxes)->isEqualTo($huge->plus(3)) && total([])->isEqualTo(0));
$first = first_boxes($n(2));
check($first instanceof Some && count($first->value) === 2 && $first->value[1]->value->isEqualTo(1) && $first->value[1]->count->isEqualTo(2));
check(first_boxes($n(0)) === null);
// A pair of two named instantiations.
check(unpair(new BoxPair($natBox(3, 0), new TextBox('abcd', $n(0))))->isEqualTo(7));
// A universe-polymorphic structure instantiated at Type.
$retagged = retag(new TaggedNat('t', $n(1)));
check($retagged->tag === 't#' && $retagged->payload->isEqualTo(2));
// A phantom argument: the instantiation names Marker, which no field carries.
check(relabel(new MarkerTag('m'))->label === 'm?');
// Field and shape checks stay exact: wrong field types, wrong records and missing fields are refused.
check(rejected(fn() => new NatBox('four', $n(1))));
check(rejected(fn() => new NatBox($n(-1), $n(1))));
check(rejected(fn() => bump(['value' => 4, 'count' => 1])));
check(rejected(fn() => new BoxPair($natBox(3, 0), $natBox(4, 0))));
check(rejected(fn() => total([$natBox(1, 0), [1, 0]])));
check(rejected(fn() => new NatBox($n(1))));
foreach (['swap'] as $name) check(!function_exists('LeanGenericrecords\\' . $name));
for ($i = 0; $i < 1000; ++$i) {
    $round = bump($natBox($i, $i));
    if (!$round->value->isEqualTo($i + 1) || !$round->count->isEqualTo($i + 1)) throw new Exception("round $i failed");
}
$checks += 1000;
echo "generic-records-ok:$checks\n";
