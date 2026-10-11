<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanStructuralsubtypes\{Some, Ok, Err, LeanBridgeError};

// Independent value snapshots, never the generated equality implementation.
function structural_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['nat', (string) $value];
    if ($value instanceof Some || $value instanceof Ok || $value instanceof Err) {
        return [get_class($value), structural_snapshot($value->value)];
    }
    if (is_array($value)) {
        $entries = [];
        foreach ($value as $key => $item) $entries[] = [gettype($key), $key, structural_snapshot($item)];
        return ['array', $entries];
    }
    if (is_string($value)) return ['string', bin2hex($value)];
    if (is_int($value) || $value === null) return [gettype($value), $value];
    throw new RuntimeException('Unsupported snapshot input: ' . get_debug_type($value));
}

function check_structural_subtypes(array $api): array {
    $checks = 0; $rejections = 0; $snapshotControls = 0;
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $same = fn($left, $right) => structural_snapshot($left) === structural_snapshot($right);
    $n = fn($value) => BigInteger::of($value);
    $refused = function (callable $call, array $args, string $path, ?string $constructor = null, ?BigInteger $bound = null) use ($check, &$rejections): void {
        $before = structural_snapshot($args);
        $expected = $bound !== null ? "$path is not below its Fin $bound bound"
            : "$path was rejected by StructuralSubtypes.$constructor";
        try { $call(...$args); }
        catch (LeanBridgeError $error) {
            $check($error->getCode() === 1 && $error->getMessage() === $expected, 'exact refusal: ' . $expected . ' got ' . $error->getMessage());
            $check(structural_snapshot($args) === $before, 'complete rejected inputs unchanged');
            ++$rejections;
            return;
        }
        throw new RuntimeException('accepted: ' . $expected);
    };
    $huge = $n(2)->power(100); $wide = $n('184467440737095516170');
    $original = [[new Some($huge), null], [new Some([255, "a\0tail"])]];
    $mutations = [
        [[new Some($huge->plus(1)), null], $original[1]],
        [[null, null], $original[1]],
        [[new Some($huge), null, null], $original[1]],
        [$original[0], [new Some([254, "a\0tail"])]],
        [$original[0], [new Some([255, "a\0changed"])]],
        [$original[0], [null]],
    ];
    foreach ($mutations as $changed) { $check(!$same($changed, $original), 'snapshot mutation control'); ++$snapshotControls; }
    $check($same($api['scalar']($huge), $huge), 'scalar wide Nat');
    $refused($api['scalar'], [$n(0)], 'arg0', 'checkedPositive');
    foreach (['arrays', 'lists', 'specialized'] as $name) {
        $call = $api[$name]; $values = [$n(1), $huge, $n(3)];
        $check($same($call([]), []), "$name empty");
        $check($same($call($values), $values), "$name wide values");
        for ($position = 0; $position < 3; ++$position) {
            $bad = $values; $bad[$position] = $n(0);
            $refused($call, [$bad], "arg0[$position]", 'checkedPositive');
        }
        $check($same($call($values), $values), "$name recovery");
    }
    $check($api['options'](null) === null, 'absent option');
    $check($same($api['options'](new Some($huge)), new Some($huge)), 'present option');
    $refused($api['options'], [new Some($n(0))], 'arg0?', 'checkedPositive');
    $text = "h\u{e9}llo\0tail\u{1F642}";
    $check($same($api['product']([$huge, $text]), [$huge, $text]), 'product Unicode and NUL suffix');
    $refused($api['product'], [[$n(0), $text]], 'arg0.0', 'checkedPositive');
    $refused($api['product'], [[$huge, '']], 'arg0.1', 'checkedWord');
    $check($same($api['branch'](new Ok($huge)), new Ok($huge)), 'active ok branch');
    $check($same($api['branch'](new Err($text)), new Err($text)), 'active error branch');
    $refused($api['branch'], [new Ok($n(0))], 'arg0.ok', 'checkedPositive');
    $refused($api['branch'], [new Err('')], 'arg0.error', 'checkedWord');
    $bytes = [null, new Some([255, $huge])];
    $check($same($api['byte_branches']($bytes), $bytes), 'UInt8 and Nat carriers');
    $refused($api['byte_branches'], [[null, new Some([0, $huge])]], 'arg0[1]?.0', 'checkedByte');
    $refused($api['byte_branches'], [[null, new Some([1, $n(0)])]], 'arg0[1]?.1', 'checkedPositive');
    $nested = [[null, new Some([$huge, $wide->minus(1)])], [], [new Some([$n(2), $n(3)])]];
    $check($same($api['nested']($nested), $n(3)), 'nested valid');
    for ($row = 0; $row < 3; ++$row) for ($column = 0; $column < 3; ++$column) {
        $rows = array_fill(0, 3, array_fill(0, 3, new Some([$huge, $wide->minus(1)])));
        $rows[$row][$column] = new Some([$n(0), $wide]);
        $refused($api['nested'], [$rows], "arg0[$row][$column]?.1", null, $wide);
        $rows[$row][$column] = new Some([$n(0), $wide->minus(1)]);
        $refused($api['nested'], [$rows], "arg0[$row][$column]?.0", 'checkedPositive');
        $rows[$row][$column] = new Some([$n(1), $wide->minus(1)]);
        $check($same($api['nested']($rows), $n(3)), 'nested position recovery');
    }
    $first = [new Some($n(1)), null, new Some($huge)];
    $second = [new Some($huge), new Some($n(3)), null];
    $normalized = [new Some($huge->plus(1)), new Some($n(4)), null];
    $check($same($api['alias_pair']([$first, $second]), [$first, $normalized]), 'independent alias-site constructors');
    $check($same($api['alias_arguments']($first, $second), array_merge($first, $normalized)), 'independent parameter constructors');
    $check($same($api['plain_fin']([null, new Some($n(0)), new Some($n(9))]), $n(3)), 'Fin-only endpoints');
    $refused($api['plain_fin'], [[new Some($n(10))]], 'arg0[0]?', null, $n(10));
    for ($position = 0; $position < 3; ++$position) {
        $left = [new Some($n(1)), new Some($huge), new Some($n(3))]; $left[$position] = new Some($n(0));
        $refused($api['alias_pair'], [[$left, $second]], "arg0.0[$position]?", 'checkedPositive');
        $right = [new Some($huge), new Some($n(3)), new Some($n(4))]; $right[$position] = new Some($n(0));
        $refused($api['alias_pair'], [[$first, $right]], "arg0.1[$position]?", 'normalizePositive');
    }
    for ($round = 0; $round < 1000; ++$round) {
        $late = [new Some($huge), new Some($n(3)), new Some($n(4))]; $position = $round % 3; $late[$position] = new Some($n(0));
        $refused($api['alias_arguments'], [&$first, &$late], "arg1[$position]?", 'normalizePositive');
        $before = structural_snapshot([$first, $second]);
        $check($same($api['alias_arguments']($first, $second), array_merge($first, $normalized)), 'late rejection recovery');
        $check(structural_snapshot([$first, $second]) === $before, 'normalization preserves both inputs');
    }
    return compact('checks', 'rejections', 'snapshotControls');
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require 'vendor/autoload.php';
    $api = [];
    foreach (['scalar', 'arrays', 'lists', 'options', 'product', 'branch', 'byte_branches', 'nested', 'alias_pair', 'alias_arguments', 'plain_fin', 'specialized'] as $name) {
        $api[$name] = 'LeanStructuralsubtypes\\' . $name;
    }
    echo json_encode(check_structural_subtypes($api), JSON_THROW_ON_ERROR) . "\n";
}
