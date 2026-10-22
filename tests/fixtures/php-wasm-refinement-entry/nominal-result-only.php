<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanNominalprimitivesubtypes\{Bytes, RawPacket};
use function LeanNominalprimitivesubtypes\{produce, produce_pair, word_bits};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$n = fn($value) => BigInteger::of($value);
$raw = function (array $changes = []) use ($n): RawPacket {
    $fields = array_replace([
        'unitValue' => null, 'boolValue' => true,
        'uint8Value' => 42, 'uint16Value' => 42, 'uint32Value' => 42, 'uint64Value' => $n(42),
        'int8Value' => -42, 'int16Value' => -42, 'int32Value' => -42, 'int64Value' => -42,
        'natValue' => $n(42), 'intValue' => $n(-42), 'float32Value' => 1.5, 'float64Value' => 1.5,
        'textValue' => 'a', 'bytesValue' => Bytes::fromString("\x00\x80\xff"), 'charValue' => 'a',
        'usizeValue' => $n(42), 'isizeValue' => -42, 'digit' => $n(2),
    ], $changes);
    return new RawPacket(...array_values($fields));
};

$check(produce($raw()) !== null, 'present result');
$check(produce($raw(['boolValue' => false])) === null, 'absent result');
$check(produce_pair($raw()) !== null, 'repeated result');
$check(word_bits() === 32, 'constructor-free scalar');

echo json_encode([
    'checks' => $checks, 'family' => 'nominal-result-only',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
