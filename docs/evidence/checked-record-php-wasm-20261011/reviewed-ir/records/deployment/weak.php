<?php
declare(strict_types=0);
use Brick\Math\BigInteger;
use LeanCheckedrecords\{Interval, Triple, Percent, LeanBridgeError};
$checks = 0;

$public_calls = 0;
$input_snapshots = 0;
$constructor_rejections = 0;
function caller_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['integer', get_class($value), (string)$value];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) $items[] = [get_debug_type($key), $key, caller_snapshot($item)];
        return ['array', $items];
    }
    if (is_object($value)) return ['object', get_class($value), caller_snapshot(get_object_vars($value))];
    return [get_debug_type($value), $value];
}
function observe_public_call(string $name, array $arguments): mixed {
    global $public_calls, $input_snapshots, $constructor_rejections;
    $before = caller_snapshot($arguments);
    $public_calls++;
    $function = '\\LeanCheckedrecords\\' . $name;
    try { return $function(...$arguments); }
    catch (LeanBridgeError $error) { $constructor_rejections++; throw $error; }
    finally {
        check(caller_snapshot($arguments) === $before);
        $input_snapshots++;
    }
}
function width(...$arguments): mixed { return observe_public_call('width', $arguments); }
function span(...$arguments): mixed { return observe_public_call('span', $arguments); }
function total(...$arguments): mixed { return observe_public_call('total', $arguments); }
function first_of(...$arguments): mixed { return observe_public_call('first_of', $arguments); }
function smallest(...$arguments): mixed { return observe_public_call('smallest', $arguments); }
function scale(...$arguments): mixed { return observe_public_call('scale', $arguments); }
function repeated(...$arguments): mixed { return observe_public_call('repeated', $arguments); }
function complement(...$arguments): mixed { return observe_public_call('complement', $arguments); }
function check($value) { global $checks; if (!$value) throw new Exception("checked-record assertion failed"); $checks++; }
function n($value) { return BigInteger::of($value); }
function same_numbers(array $actual, array $expected): bool {
    return array_map(fn($value) => (string)$value, $actual) === array_map(fn($value) => (string)$value, $expected);
}
// BEGIN CHECKED INPUT HELPERS
function rejected(callable $call, string $message): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === $message; }
    return false;
}
// END CHECKED INPUT HELPERS
$big = n(2)->power(100);
// BEGIN CHECKED INPUT CASES
$good = new Interval(n(3), n(10));
$bad = new Interval(n(9), n(3));
$values = [n(9), n(2), n(4)];
$triple = new Triple($values);
check(width($good)->isEqualTo(n(7)));
check(width(new Interval(n(1), n(1)))->isEqualTo(n(0)));
check(width(new Interval($big, $big->plus(n(9))))->isEqualTo(n(9)));
check(span($good, new Interval(n(5), n(20)))->isEqualTo(n(17)));
check(rejected(fn() => width($bad), "value0 was rejected by CheckedRecords.mkInterval"));
check(rejected(fn() => span($bad, $good), "value0 was rejected by CheckedRecords.mkInterval"));
check(rejected(fn() => span($good, $bad), "value1 was rejected by CheckedRecords.mkInterval"));
check(total($triple)->isEqualTo(n(15)));
check(first_of($triple)->isEqualTo(n(9)));
check(smallest($triple)->isEqualTo(n(2)));
check(same_numbers($triple->data, [n(9), n(2), n(4)]) && same_numbers($values, [n(9), n(2), n(4)]));
check(same_numbers((scale(n(3), $triple))->data, [n(27), n(6), n(12)]));
check(same_numbers($triple->data, [n(9), n(2), n(4)]) && same_numbers($values, [n(9), n(2), n(4)]));
check(rejected(fn() => total(new Triple([])), "value0 was rejected by CheckedRecords.mkTriple"));
check(rejected(fn() => first_of(new Triple([n(1), n(2)])), "value0 was rejected by CheckedRecords.mkTriple"));
check(rejected(fn() => smallest(new Triple([n(4), n(3), n(2), n(1)])), "value0 was rejected by CheckedRecords.sortedTriple"));
check(rejected(fn() => scale(n(3), new Triple([n(1), n(2)])), "value1 was rejected by CheckedRecords.mkTriple"));
check(complement(new Percent(n(0)))->isEqualTo(n(100)));
check(complement(new Percent(n(100)))->isEqualTo(n(0)));
check(rejected(fn() => complement(new Percent(n(101))), "value0 was rejected by CheckedRecords.mkPercent"));
check(rejected(fn() => complement(new Percent($big)), "value0 was rejected by CheckedRecords.mkPercent"));
for ($i = 0; $i < 1000; ++$i) {
    check(rejected(fn() => width(new Interval(n($i + 1), n($i))), "value0 was rejected by CheckedRecords.mkInterval"));
    check(width(new Interval(n($i), n($i + 7)))->isEqualTo(n(7)));
    check(rejected(fn() => total(new Triple([n(1), n(2)])), "value0 was rejected by CheckedRecords.mkTriple"));
    check(total($triple)->isEqualTo(n(15)));
    check(rejected(fn() => smallest(new Triple([n(4), n(3), n(2), n(1)])), "value0 was rejected by CheckedRecords.sortedTriple"));
    check(smallest($triple)->isEqualTo(n(2)));
    check(rejected(fn() => complement(new Percent(n(101))), "value0 was rejected by CheckedRecords.mkPercent"));
    check(complement(new Percent(n(100)))->isEqualTo(n(0)));
}
check(same_numbers($triple->data, [n(9), n(2), n(4)]) && same_numbers($values, [n(9), n(2), n(4)]) && $good->lo->isEqualTo(n(3)) && $good->hi->isEqualTo(n(10)) && $bad->lo->isEqualTo(n(9)) && $bad->hi->isEqualTo(n(3)));
// END CHECKED INPUT CASES
check(same_numbers((repeated($big))->data, [$big, $big, $big]));
$first = repeated(n(7));
$second = repeated(n(7));
$readonly = false;
try { $first->data[0] = n(99); } catch (Error) { $readonly = true; }
check($readonly && $first !== $second && same_numbers($first->data, [n(7), n(7), n(7)]) && same_numbers($second->data, [n(7), n(7), n(7)]));
for ($i = 0; $i < 1000; ++$i) {
    check(same_numbers((repeated(n($i)))->data, [n($i), n($i), n($i)]));
}
$low_bit = n(2)->power(80)->plus(n(1));
check(same_numbers((repeated($low_bit))->data, [$low_bit, $low_bit, $low_bit]));
echo json_encode(['checks' => $checks, 'public_calls' => $public_calls,
    'input_snapshots' => $input_snapshots, 'constructor_rejections' => $constructor_rejections,
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
