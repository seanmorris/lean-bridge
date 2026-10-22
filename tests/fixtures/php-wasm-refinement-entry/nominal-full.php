<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanNominalprimitivesubtypes\{Bytes, EventBox, EventEmpty, LeanBridgeError, Packet, RawPacket};
use function LeanNominalprimitivesubtypes\{combine, echo_a, echo_event_a, produce};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$n = fn($value) => BigInteger::of($value);
$fields = function (array $changes = []) use ($n): array {
    return array_replace([
        'unitValue' => null, 'boolValue' => true,
        'uint8Value' => 42, 'uint16Value' => 42, 'uint32Value' => 42, 'uint64Value' => $n(42),
        'int8Value' => -42, 'int16Value' => -42, 'int32Value' => -42, 'int64Value' => -42,
        'natValue' => $n(42), 'intValue' => $n(-42), 'float32Value' => 1.5, 'float64Value' => 1.5,
        'textValue' => 'a', 'bytesValue' => Bytes::fromString("\x00\x80\xff"), 'charValue' => 'a',
        'usizeValue' => $n(42), 'isizeValue' => -42, 'digit' => $n(2),
    ], $changes);
};
$packet = fn(array $changes = []) => new Packet(...array_values($fields($changes)));
$raw = fn(array $changes = []) => new RawPacket(...array_values($fields($changes)));
$refused = function (callable $call) use ($check): void {
    try { $call(); }
    catch (LeanBridgeError $error) { $check($error->getCode() !== 0, 'checked refusal status'); return; }
    throw new RuntimeException('expected checked refusal');
};

$a = $packet();
$b = $packet(['boolValue' => false]);
$check(echo_a($a) instanceof Packet, 'direct');
$refused(fn() => echo_a($packet(['isizeValue' => -43])));
$check(echo_a($a) instanceof Packet, 'recovery');
$check(is_array(combine($a, $b)), 'repeated fields');
$check(echo_event_a(new EventEmpty()) instanceof EventEmpty, 'inactive branch');
$check(echo_event_a(new EventBox($a)) instanceof EventBox, 'active branch');
$check(produce($raw()) !== null, 'constructor-free result');

echo json_encode([
    'checks' => $checks, 'family' => 'nominal-full',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
