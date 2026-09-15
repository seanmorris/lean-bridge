<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use LeanClover\BigInteger;
use function LeanClover\{array_u32, echo_nat, echo_text, echo_u32};

$large = BigInteger::fromDecimal('184467440737095516160000000001');
if (echo_u32(42) !== 42
    || (string) echo_nat($large) !== (string) $large
    || echo_text("Lean λ\0") !== "Lean λ\0"
    || array_u32([0, 4294967295]) !== [0, 4294967295]) {
    throw new RuntimeException('Lean returned an unexpected result');
}
echo '42; exact integers and copied arrays', PHP_EOL;
