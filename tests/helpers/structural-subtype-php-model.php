<?php
declare(strict_types=1);
// Synthetic caller controls only. No Lean execution or installed-package claim.
require $argv[1];
require $argv[2];
require $argv[3];

use Brick\Math\BigInteger;
use LeanStructuralsubtypes\{Some, Ok, Err, LeanBridgeError};

function structural_model(string $prefix): array {
    $arg = $prefix . '0';
    $refuse = function ($path, $constructor): never { throw new LeanBridgeError("$path was rejected by StructuralSubtypes.$constructor", 1); };
    $positive = function (BigInteger $value, $path, $normalize = false) use ($refuse): BigInteger {
        if ($value->isLessThanOrEqualTo(0)) $refuse($path, $normalize ? 'normalizePositive' : 'checkedPositive');
        return $normalize ? $value->plus(1) : $value;
    };
    $word = function ($value, $path) use ($refuse): string { if ($value === '') $refuse($path, 'checkedWord'); return $value; };
    $bound = function (BigInteger $value, $path, BigInteger $limit): void {
        if ($value->isGreaterThanOrEqualTo($limit)) throw new LeanBridgeError("$path is not below its Fin $limit bound", 1);
    };
    $group = function ($values, $path, $normalize = false) use ($positive): array {
        $result = [];
        foreach ($values as $i => $value) $result[] = $value === null ? null : new Some($positive($value->value, "{$path}[$i]?", $normalize));
        return $result;
    };
    $api = ['scalar' => fn($value) => $positive($value, $arg)];
    foreach (['arrays', 'lists', 'specialized'] as $name) {
        $api[$name] = function ($values) use ($positive, $arg): array {
            $result = [];
            foreach ($values as $i => $value) $result[] = $positive($value, "{$arg}[$i]");
            return $result;
        };
    }
    $api['options'] = fn($value) => $value === null ? null : new Some($positive($value->value, $arg . '?'));
    $api['product'] = fn($pair) => [$positive($pair[0], $arg . '.0'), $word($pair[1], $arg . '.1')];
    $api['branch'] = fn($value) => $value instanceof Ok ? new Ok($positive($value->value, $arg . '.ok')) : new Err($word($value->value, $arg . '.error'));
    $api['byte_branches'] = function ($values) use ($arg, $refuse, $positive): array {
        $result = [];
        foreach ($values as $i => $value) {
            if ($value === null) { $result[] = null; continue; }
            [$byte, $nat] = $value->value;
            if ($byte === 0) $refuse("{$arg}[$i]?.0", 'checkedByte');
            $result[] = new Some([$byte, $positive($nat, "{$arg}[$i]?.1")]);
        }
        return $result;
    };
    $api['nested'] = function ($rows) use ($bound, $positive, $arg): BigInteger {
        foreach ($rows as $i => $row) foreach ($row as $j => $value) {
            if ($value !== null) $bound($value->value[1], "{$arg}[$i][$j]?.1", BigInteger::of('184467440737095516170'));
        }
        foreach ($rows as $i => $row) foreach ($row as $j => $value) {
            if ($value !== null) $positive($value->value[0], "{$arg}[$i][$j]?.0");
        }
        return BigInteger::of(count($rows));
    };
    $api['plain_fin'] = function ($values) use ($bound, $arg): BigInteger {
        foreach ($values as $i => $value) if ($value !== null) $bound($value->value, "{$arg}[$i]?", BigInteger::of(10));
        return BigInteger::of(count($values));
    };
    $api['alias_pair'] = fn($pair) => [$group($pair[0], $arg . '.0'), $group($pair[1], $arg . '.1', true)];
    $api['alias_arguments'] = fn($left, $right) => array_merge($group($left, $arg), $group($right, $prefix . '1', true));
    return $api;
}

$prefix = $argv[4];
$expected = ['checks' => 4119, 'rejections' => 1042, 'snapshotControls' => 6];
if (check_structural_subtypes(structural_model($prefix)) !== $expected) throw new RuntimeException('wrong baseline');
$mutations = [
    'scalar' => fn($value) => $value,
    'arrays' => fn($values) => $values,
    'product' => fn($pair) => [$pair[0], explode("\0", $pair[1])[0]],
    'alias_pair' => fn($pair) => $pair,
    'nested' => fn($rows) => BigInteger::of(count($rows)),
    'branch' => fn($value) => $value,
];
$controls = 0;
$detect = function ($api, $label) use (&$controls): void {
    try { check_structural_subtypes($api); }
    catch (RuntimeException $error) {
        if (!str_starts_with($error->getMessage(), 'failed: ') && !str_starts_with($error->getMessage(), 'accepted: ')) throw $error;
        ++$controls; return;
    }
    throw new RuntimeException('undetected mutant: ' . $label);
};
foreach ($mutations as $name => $replacement) {
    $api = structural_model($prefix); $api[$name] = $replacement; $detect($api, $name);
}
foreach ([0, 1] as $position) {
    $api = structural_model($prefix); $original = $api['alias_arguments'];
    $api['alias_arguments'] = function (&$left, &$right) use ($original, $prefix, $position) {
        foreach ($right as $i => $value) if ($value !== null && $value->value->isEqualTo(0)) {
            if ($position === 0) $left[0] = new Some(BigInteger::of(999));
            else $right[0] = new Some(BigInteger::of(999));
            throw new LeanBridgeError("{$prefix}1[$i]? was rejected by StructuralSubtypes.normalizePositive", 1);
        }
        return $original($left, $right);
    };
    $detect($api, 'input mutation ' . $position);
}
echo json_encode($expected + ['callerMutationControls' => $controls], JSON_THROW_ON_ERROR) . "\n";
