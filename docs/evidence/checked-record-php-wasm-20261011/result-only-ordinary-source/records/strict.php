<?php
declare(strict_types=1);
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
function repeated(...$arguments): mixed { return observe_public_call('repeated', $arguments); }
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
$low_bit = n(2)->power(80)->plus(n(1));
check(same_numbers((repeated($low_bit))->data, [$low_bit, $low_bit, $low_bit]));
echo json_encode(['checks' => $checks, 'public_calls' => $public_calls,
    'input_snapshots' => $input_snapshots, 'constructor_rejections' => $constructor_rejections,
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
