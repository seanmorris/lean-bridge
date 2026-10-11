<?php
declare(strict_types=0);
require "vendor/autoload.php";
use Brick\Math\BigInteger;
use LeanCheckedrecords\{Interval, Triple, Percent, LeanBridgeError};
use function LeanCheckedrecords\{width, span, total, first_of, smallest, scale, repeated, complement};
$checks = 0;
function check($value) { global $checks; if (!$value) throw new Exception("checked-record assertion failed"); $checks++; }
function n($value) { return BigInteger::of($value); }
function same_numbers(array $actual, array $expected): bool {
    return array_map(fn($value) => (string)$value, $actual) === array_map(fn($value) => (string)$value, $expected);
}
$big = n(2)->power(100);
check(same_numbers((repeated($big))->data, [$big, $big, $big]));
$first = repeated(n(7));
$second = repeated(n(7));
$readonly = false;
try { $first->data[0] = n(99); } catch (Error) { $readonly = true; }
check($readonly && $first !== $second && same_numbers($first->data, [n(7), n(7), n(7)]) && same_numbers($second->data, [n(7), n(7), n(7)]));
for ($i = 0; $i < 1000; ++$i) {
    check(same_numbers((repeated(n($i)))->data, [n($i), n($i), n($i)]));
}
echo "checked-record-ok:$checks\n";
