<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanRecursivecheckedrecords\{LeanBridgeError, Packet, Some};
use function LeanRecursivecheckedrecords\{first, groups, produce};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$n = fn($value) => BigInteger::of($value);
$packet = fn($value, $digit, $tail = null) => new Packet(
    $n($value), $n($digit), $tail === null ? null : new Some($tail)
);
$refused = function (callable $call) use ($check): void {
    try { $call(); }
    catch (LeanBridgeError $error) { $check($error->getCode() !== 0, 'checked refusal status'); return; }
    throw new RuntimeException('expected checked refusal');
};

$single = $packet(40, 2);
$check(first($single) instanceof BigInteger, 'direct');
$refused(fn() => first($packet(40, 2, $packet(100, 1))));
$refused(fn() => first($packet(0, 2)));
$check(first($single) instanceof BigInteger, 'recovery');
$check(groups([new Some($single), new Some($single)]) instanceof BigInteger, 'repeated fields');
$check(groups([null]) instanceof BigInteger, 'inactive branch');
$check(produce($n(40)) instanceof Packet, 'constructor-free result');

echo json_encode([
    'checks' => $checks, 'family' => 'recursive-checked-record',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
