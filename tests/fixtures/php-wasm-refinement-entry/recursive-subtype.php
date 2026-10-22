<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanRecursivesubtypes\{ChainEmpty, ChainNode, LeanBridgeError, Some};
use function LeanRecursivesubtypes\{echo_, first, groups, produce};

$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException($label);
    ++$checks;
};
$n = fn($value) => BigInteger::of($value);
$node = fn($value, $digit, $tail = null) => new ChainNode($n($value), $n($digit), $tail ?? new ChainEmpty());
$refused = function (callable $call) use ($check): void {
    try { $call(); }
    catch (LeanBridgeError $error) { $check($error->getCode() !== 0, 'checked refusal status'); return; }
    throw new RuntimeException('expected checked refusal');
};

$direct = $node(40, 2, $node(80, 1));
$check(first($direct) instanceof BigInteger, 'direct');
$refused(fn() => first($node(40, 2, $node(100, 1))));
$single = $node(40, 2);
$check(first($single) instanceof BigInteger, 'recovery');
$check(groups([new Some($single), new Some($single)]) instanceof BigInteger, 'repeated fields');
$check(echo_(new ChainEmpty()) instanceof ChainEmpty, 'inactive branch');
$check(echo_($single) instanceof ChainNode, 'active branch');
$check(produce($n(40)) instanceof ChainNode, 'constructor-free result');

echo json_encode([
    'checks' => $checks, 'family' => 'recursive-subtype',
    'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION,
], JSON_THROW_ON_ERROR);
