<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanZeropayloadcheckedrecords\{LeanBridgeError, MarkBlank, MarkMarked, Some, Token, Witness};

$checks = 0;
$check = static function (bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException('zero-payload entry probe: ' . $label);
    ++$checks;
};
$n = static fn(mixed $value): BigInteger => BigInteger::of($value);
$call = static fn(string $name): string => 'LeanZeropayloadcheckedrecords\\' . $name;

$check($call('witness_count')(new Witness())->isEqualTo(1), 'direct');
try { $call('absent_count')(new Witness()); throw new RuntimeException('empty refusal accepted'); }
catch (LeanBridgeError $error) {
    $check($error->getCode() === 1
        && str_contains($error->getMessage(), 'ZeroPayloadCheckedRecords.mkAbsent'), 'first refusal');
}
$check($call('witness_count')(new Witness())->isEqualTo(1), 'recovery');
$check($call('token_tag')(new Token(null)) === null, 'unit payload');
$check($call('mark_count')(new MarkBlank())->isZero(), 'inactive branch');
$check($call('mark_count')(new MarkMarked(new Witness()))->isEqualTo(1), 'active branch');
$check($call('produce_witness')() instanceof Witness, 'result proof erasure');
$check(count($call('witnesses')($n(2))) === 2, 'array result');
$check($call('maybe_witness')(false) === null, 'absent result');
$check($call('produce_mark')(true) instanceof MarkMarked, 'variant result');

echo json_encode(['checks' => $checks, 'family' => 'zero-payload-full'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
