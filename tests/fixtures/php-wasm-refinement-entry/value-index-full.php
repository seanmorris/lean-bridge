<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanCheckedrecordvalueindices\{Ab, EmptySized, LeanBridgeError, On, WideToken, ZeroToken};

$checks = 0;
$check = static function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException('value-index entry probe: ' . $label);
    ++$checks;
};
$n = static fn(mixed $value): BigInteger => BigInteger::of($value);
$call = static fn(string $name): string => 'LeanCheckedrecordvalueindices\\' . $name;
$refuse = static function (string $name, object $value, string $constructor) use ($call, $check): void {
    try { $call($name)($value); throw new RuntimeException('value-index refusal accepted'); }
    catch (LeanBridgeError $error) {
        $check($error->getCode() === 1 && str_contains($error->getMessage(), $constructor), $constructor);
    }
};

$check($call('true_bool_index')(new On($n(0)))->isZero(), 'direct Bool');
$check($call('ab_string_index')(new Ab($n(2)))->isEqualTo(2), 'direct String');
$check($call('empty_sized_index')(new EmptySized([]))->isZero(), 'direct Nat');
$refuse('true_bool_index', new On($n(1)), 'CheckedRecordValueIndices.mkOn');
$check($call('zero_nat_index')(new ZeroToken($n(9)))->isEqualTo(9), 'Bool recovery');
$refuse('ab_string_index', new Ab($n(1)), 'CheckedRecordValueIndices.mkAb');
$check($call('zero_nat_index')(new ZeroToken($n(10)))->isEqualTo(10), 'String recovery');
$refuse('empty_sized_index', new EmptySized([$n(1)]), 'CheckedRecordValueIndices.mkEmptySized');
$check($call('zero_nat_index')(new ZeroToken($n(11)))->isEqualTo(11), 'Nat recovery');
$wide = $n('340282366920938463463374607431768211457');
$check($call('wide_nat_index')(new WideToken($wide))->isEqualTo($wide), 'wide index');
$produced = $call('produce_wide_nat')($n('1267650600228229401496703205393'));
$check($produced->count->isEqualTo('1267650600228229401496703205393'), 'result proof erasure');

echo json_encode(['checks' => $checks, 'family' => 'value-index-full'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
