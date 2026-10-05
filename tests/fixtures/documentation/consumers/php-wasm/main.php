<?php
declare(strict_types=1);

require_once '/vendor/autoload.php';

use LeanAlpha\Box;
use Brick\Math\BigInteger;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(BigInteger::of('41'));
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, BigInteger::of('8'), 'consumer', Bytes::fromString("\x00\x7f\xff"),
        array_map(BigInteger::of(...), ['1', '5', '13']),
    ));
    $addTwo = makeAdder(BigInteger::of('2'));
    $result = [
        'box' => (string) $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, (string) $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), array_map(strval(...), $payload->values),
        ],
        'callback' => (string) withCallback(BigInteger::of('40'), static fn(BigInteger $value): BigInteger => $value),
        'closure' => (string) $addTwo(BigInteger::of('40')),
    ];
    $expected = [
        'box' => '41',
        'identity' => true,
        'payload' => [true, '9', 'consumer', '007fff', ['1', '5', '13']],
        'callback' => '42',
        'closure' => '42',
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
