<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanDependentrecords\{Dependent, LeanBridgeError};

$checks = 0;
$check = static function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException('dependent entry probe: ' . $label);
    ++$checks;
};
$n = static fn(mixed $value): BigInteger => BigInteger::of($value);
$call = static fn(string $name): string => 'LeanDependentrecords\\' . $name;

$check($call('dependent_total')(new Dependent($n(3), $n(2)))->isEqualTo(5), 'direct');
try {
    $call('dependent_total')(new Dependent($n(2), $n(2)));
    throw new RuntimeException('dependent refusal accepted');
} catch (LeanBridgeError $error) {
    $check($error->getCode() === 1
        && str_contains($error->getMessage(), 'DependentRecords.mkDependent'), 'first refusal');
}
$check($call('dependent_total')(new Dependent($n(2), $n(1)))->isEqualTo(3), 'recovery');
$roundtrip = $call('dependent_roundtrip')(new Dependent($n(4), $n(3)));
$check($roundtrip->bound->isEqualTo(4) && $roundtrip->below->isEqualTo(3), 'roundtrip');
$result = $call('dependent_result')($n(5));
$check($result->bound->isEqualTo(6) && $result->below->isEqualTo(5), 'result proof erasure');

echo json_encode(['checks' => $checks, 'family' => 'dependent-full'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
