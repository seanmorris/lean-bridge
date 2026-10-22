<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanDependentrecords\{Dependent, LeanBridgeError};

function dependent_snapshot(mixed $value): mixed {
    if ($value instanceof BigInteger) return ['bigint', (string)$value];
    if (is_array($value)) return ['array', array_map(dependent_snapshot(...), $value)];
    if ($value instanceof Dependent) {
        $fields = get_object_vars($value);
        if (array_keys($fields) !== ['bound', 'below']) throw new RuntimeException('unexpected Dependent fields');
        return ['Dependent', array_map(dependent_snapshot(...), $fields)];
    }
    if (is_object($value)) throw new RuntimeException('unexpected public value: ' . get_class($value));
    return [gettype($value), $value];
}

function check_dependent_records(bool $resultOnly = false, string $parameterPrefix = 'arg'): array {
    if (!in_array($parameterPrefix, ['arg', 'value'], true)) {
        throw new InvalidArgumentException('Invalid dependent-record caller options');
    }
    $checks = 0; $calls = 0; $rejections = 0; $recoveries = 0; $snapshots = 0;
    $check = static function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('dependent-record assertion failed: ' . $label);
        ++$checks;
    };
    $n = static fn(mixed $value): BigInteger => BigInteger::of($value);
    $record = static fn(BigInteger $bound, BigInteger $below): Dependent => new Dependent($bound, $below);
    $function = static fn(string $name): string => 'LeanDependentrecords\\' . $name;
    $invoke = static function (string $name, array $args, mixed $expected, string $label) use (&$calls, &$snapshots, $check, $function): mixed {
        $before = dependent_snapshot($args); ++$calls;
        $actual = $function($name)(...$args);
        $check(dependent_snapshot($actual) === dependent_snapshot($expected), $label . ' exact result');
        $check(dependent_snapshot($args) === $before, $label . ' preserves caller input');
        ++$snapshots;
        return $actual;
    };
    $refuse = static function (Dependent $value, string $label) use (&$calls, &$rejections, &$snapshots, $check, $function, $parameterPrefix): void {
        $before = dependent_snapshot($value); ++$calls;
        $refused = false;
        try { $function('dependent_total')($value); }
        catch (LeanBridgeError $error) {
            $check($error->getCode() === 1
                && $error->getMessage() === $parameterPrefix . '0 was rejected by DependentRecords.mkDependent',
                $label . ' exact checked-record refusal');
            $check(true, $label . ' refuses invalid input');
            $refused = true;
        }
        if (!$refused) throw new RuntimeException('Accepted invalid dependent record: ' . $label);
        $check(dependent_snapshot($value) === $before, $label . ' preserves rejected input');
        ++$rejections; ++$snapshots;
    };

    $check(function_exists($function('dependent_total')) !== $resultOnly, 'dependent_total export selection');
    $check(function_exists($function('dependent_roundtrip')) !== $resultOnly, 'dependent_roundtrip export selection');
    $check(function_exists($function('dependent_result')), 'dependent_result export selection');

    $produced = static function (BigInteger $seed, string $label) use (&$calls, &$snapshots, $check, $function, $record): void {
        ++$calls;
        $value = $function('dependent_result')($seed);
        $check(dependent_snapshot($value) === dependent_snapshot($record($seed->plus(1), $seed)), $label . ' exact result');
        ++$snapshots;
    };
    for ($index = 0; $index < 512; ++$index) $produced($n($index), 'result ' . $index);
    $huge = BigInteger::one()->shiftedLeft(130);
    $produced($huge, 'huge result');

    if (!$resultOnly) {
        $recover = static function () use ($invoke, &$recoveries, $n, $record): void {
            $invoke('dependent_total', [$record($n(2), $n(1))], $n(3), 'recovery');
            ++$recoveries;
        };

        $invoke('dependent_total', [$record($n(3), $n(2))], $n(5), 'valid total');
        $refuse($record($n(2), $n(2)), 'equal fields');
        $recover();
        $refuse($record($n(0), $n(0)), 'zero bound');
        $recover();
        $valid = $record($n(3), $n(2));
        $invoke('dependent_roundtrip', [$valid], $valid, 'roundtrip');
        $below = $huge->minus(1);
        $invoke('dependent_total', [$record($huge, $below)], $huge->plus($below), 'huge total');
        $hugeRecord = $record($huge, $below);
        $invoke('dependent_roundtrip', [$hugeRecord], $hugeRecord, 'huge roundtrip');
        for ($index = 0; $index < 256; ++$index) {
            $bound = $n($index + 1);
            $invoke('dependent_total', [$record($bound, $n($index))], $n(2 * $index + 1), 'loop total ' . $index);
            $refuse($record($bound, $bound), 'loop refusal ' . $index);
            $recover();
        }
    }

    $actual = [$calls, $checks, $recoveries, $rejections, $snapshots];
    $expected = $resultOnly ? [513, 516, 0, 0, 513] : [1289, 2326, 258, 258, 1289];
    if ($actual !== $expected) {
        throw new RuntimeException('dependent-record exact caller totals ' . json_encode($actual) . ' != ' . json_encode($expected));
    }
    return ['calls' => $calls, 'checks' => $checks, 'recoveries' => $recoveries
        , 'rejections' => $rejections, 'snapshots' => $snapshots];
}

    $observed = check_dependent_records(false, 'value');
    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
