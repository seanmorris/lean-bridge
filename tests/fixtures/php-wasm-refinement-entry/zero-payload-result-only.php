<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanZeropayloadcheckedrecords\{MarkBlank, Marker, Some, Token, Witness};

$checks = 0;
$n = static fn(mixed $value): BigInteger => BigInteger::of($value);
$call = static fn(string $name): string => 'LeanZeropayloadcheckedrecords\\' . $name;
$values = [
    $call('produce_witness')() instanceof Witness,
    $call('produce_token')() instanceof Token,
    count($call('witnesses')($n(2))) === 2,
    $call('maybe_witness')(true) instanceof Some,
    $call('produce_marker')() instanceof Marker,
    $call('produce_mark')(false) instanceof MarkBlank,
];
foreach ($values as $value) {
    if (!$value) throw new RuntimeException('zero-payload result-only entry probe');
    ++$checks;
}

echo json_encode(['checks' => $checks, 'family' => 'zero-payload-result-only'
    , 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
