<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanCheckedrecordvalueindices\{Ab, EmptySized, EmptyToken, Off, On, UnicodeToken, WideToken, ZeroToken};

$checks = 0;
$n = static fn(mixed $value): BigInteger => BigInteger::of($value);
$call = static fn(string $name): string => 'LeanCheckedrecordvalueindices\\' . $name;
$values = [
    $call('produce_true_bool')() instanceof On,
    $call('produce_false_bool')() instanceof Off,
    $call('produce_ab')() instanceof Ab,
    $call('produce_empty_string')($n(7)) instanceof EmptyToken,
    $call('produce_unicode_string')($n(8)) instanceof UnicodeToken,
    $call('produce_empty_sized')() instanceof EmptySized,
    $call('produce_zero_nat')($n(9)) instanceof ZeroToken,
    $call('produce_wide_nat')($n('1267650600228229401496703205393')) instanceof WideToken,
];
foreach ($values as $value) {
    if (!$value) throw new RuntimeException('value-index result-only entry probe');
    ++$checks;
}

echo json_encode(['checks' => $checks, 'family' => 'value-index-result-only'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
