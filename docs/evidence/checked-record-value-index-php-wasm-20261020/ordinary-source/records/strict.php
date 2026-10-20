<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanCheckedrecordvalueindices\{Ab, EmptySized, EmptyToken, LeanBridgeError, Off, On, UnicodeToken, WideToken, ZeroToken};

function value_index_snapshot(mixed $value): mixed {
    if ($value instanceof BigInteger) return ['bigint', (string)$value];
    if (is_array($value)) return ['array', array_map(value_index_snapshot(...), $value)];
    if (is_object($value)) {
        $fields = get_object_vars($value);
        ksort($fields);
        return [get_class($value), array_map(value_index_snapshot(...), $fields)];
    }
    return [gettype($value), $value];
}

function check_value_index_records(bool $resultOnly = false, string $parameterPrefix = 'arg'): array {
    if (!in_array($parameterPrefix, ['arg', 'value'], true)) {
        throw new InvalidArgumentException('Invalid value-index caller options');
    }
    $checks = 0; $calls = 0; $rejections = 0; $recoveries = 0; $snapshots = 0;
    $check = static function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('value-index assertion failed: ' . $label);
        ++$checks;
    };
    $n = static fn(mixed $value): BigInteger => BigInteger::of($value);
    $function = static fn(string $name): string => 'LeanCheckedrecordvalueindices\\' . $name;
    $inputs = ['true_bool_index', 'false_bool_index', 'ab_string_index', 'empty_string_index'
        , 'unicode_string_index', 'empty_sized_index', 'zero_nat_index', 'wide_nat_index'];
    $results = ['produce_true_bool', 'produce_false_bool', 'produce_ab', 'produce_empty_string'
        , 'produce_unicode_string', 'produce_empty_sized', 'produce_zero_nat', 'produce_wide_nat'];
    foreach ($inputs as $name) $check(function_exists($function($name)) !== $resultOnly, 'input export selection: ' . $name);
    foreach ($results as $name) $check(function_exists($function($name)), 'result export selection: ' . $name);
    $invoke = static function (string $name, array $args, mixed $expected) use (&$calls, &$snapshots, $check, $function): void {
        $before = value_index_snapshot($args); ++$calls;
        $actual = $function($name)(...$args);
        $check(value_index_snapshot($actual) === value_index_snapshot($expected), $name . ' exact result');
        $check(value_index_snapshot($args) === $before, $name . ' preserves caller input');
        ++$snapshots;
    };
    $refuse = static function (string $name, array $args, string $constructor, string $label) use (&$calls, &$rejections, &$snapshots, $check, $function, $parameterPrefix): void {
        $before = value_index_snapshot($args); ++$calls;
        $refused = false;
        try { $function($name)(...$args); }
        catch (LeanBridgeError $error) {
            $check($error->getCode() === 1 && str_starts_with($error->getMessage(), $parameterPrefix . '0 was rejected by CheckedRecordValueIndices.' . $constructor), $label . ' checked-record refusal');
            $refused = true;
        }
        if (!$refused) throw new RuntimeException('Accepted invalid value-index input: ' . $label);
        $check(value_index_snapshot($args) === $before, $label . ' preserves rejected input');
        ++$rejections; ++$snapshots;
    };
    $hostRefuse = static function (string $name, callable $arguments, mixed $input, string $label) use (&$calls, &$rejections, &$snapshots, $check, $function): void {
        $before = value_index_snapshot($input); ++$calls;
        $refused = false;
        try { $function($name)(...$arguments()); }
        catch (TypeError|ValueError) { $check(true, $label . ' host refusal'); $refused = true; }
        if (!$refused) throw new RuntimeException('Accepted malformed value-index input: ' . $label);
        $check(value_index_snapshot($input) === $before, $label . ' preserves rejected input');
        ++$rejections; ++$snapshots;
    };
    $huge = $n('340282366920938463463374607431768211457');
    if (!$resultOnly) {
        $invoke('true_bool_index', [new On($n(0))], $n(0));
        $invoke('false_bool_index', [new Off($n(1))], $n(1));
        $invoke('ab_string_index', [new Ab($n(2))], $n(2));
        $invoke('empty_string_index', [new EmptyToken($n(9))], $n(9));
        $invoke('unicode_string_index', [new UnicodeToken($n(10))], $n(10));
        $invoke('empty_sized_index', [new EmptySized([])], $n(0));
        $invoke('zero_nat_index', [new ZeroToken($n(11))], $n(11));
        $invoke('wide_nat_index', [new WideToken($huge)], $huge);
        $refuse('ab_string_index', [new Ab($n(1))], 'mkAb', 'String index');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
        $refuse('empty_sized_index', [new EmptySized([$n(1)])], 'mkEmptySized', 'Nat index');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
        $refuse('true_bool_index', [new On($n(1))], 'mkOn', 'true Bool index');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
        $refuse('false_bool_index', [new Off($n(0))], 'mkOff', 'false Bool index');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
        $negativeTrue = $n(-1);
        $hostRefuse('true_bool_index', static fn(): array => [new On($negativeTrue)], $negativeTrue, 'negative true Nat');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
        $negativeToken = $n(-1);
        $hostRefuse('zero_nat_index', static fn(): array => [new ZeroToken($negativeToken)], $negativeToken, 'negative token Nat');
        $invoke('zero_nat_index', [new ZeroToken($n(99))], $n(99)); ++$recoveries;
    }
    $produced = static function (string $name, array $args, mixed $expected) use (&$calls, $check, $function): void {
        ++$calls;
        $check(value_index_snapshot($function($name)(...$args)) === value_index_snapshot($expected), $name . ' produced record');
    };
    $produced('produce_true_bool', [], new On($n(0)));
    $produced('produce_false_bool', [], new Off($n(1)));
    $produced('produce_ab', [], new Ab($n(2)));
    $produced('produce_empty_string', [$n(23)], new EmptyToken($n(23)));
    $produced('produce_unicode_string', [$n(24)], new UnicodeToken($n(24)));
    $produced('produce_empty_sized', [], new EmptySized([]));
    $produced('produce_zero_nat', [$n(25)], new ZeroToken($n(25)));
    $produced('produce_wide_nat', [$n('1267650600228229401496703205393')], new WideToken($n('1267650600228229401496703205393')));
    $expected = $resultOnly ? [8, 24, 0, 0, 0] : [28, 64, 6, 6, 20];
    $check([$calls, $checks, $recoveries, $rejections, $snapshots] === $expected, 'exact caller totals');
    return ['calls' => $calls, 'checks' => $checks, 'recoveries' => $recoveries
        , 'rejections' => $rejections, 'snapshots' => $snapshots];
}

    $observed = check_value_index_records(false, 'arg');
    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
