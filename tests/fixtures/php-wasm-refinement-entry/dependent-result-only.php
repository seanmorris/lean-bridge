<?php
declare(strict_types=0);

use Brick\Math\BigInteger;

$checks = 0;
$call = 'LeanDependentrecords\\dependent_result';
foreach (['0', '340282366920938463463374607431768211457'] as $seed) {
    $seed = BigInteger::of($seed);
    $value = $call($seed);
    if (!$value->bound->isEqualTo($seed->plus(1)) || !$value->below->isEqualTo($seed)) {
        throw new RuntimeException('dependent result-only entry probe');
    }
    ++$checks;
}

echo json_encode(['checks' => $checks, 'family' => 'dependent-result-only'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
