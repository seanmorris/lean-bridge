<?php
declare(strict_types=1);

require __DIR__ . '/component/vendor/autoload.php';

use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(41);
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, 8, 'consumer', Bytes::fromString("\x00\x7f\xff"), [1, 5, 13],
    ));
    $addTwo = makeAdder(2);
    $result = [
        'box' => $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), $payload->values,
        ],
        'callback' => withCallback(40, static fn(int $value): int => $value),
        'closure' => $addTwo(40),
    ];
    $expected = [
        'box' => 41,
        'identity' => true,
        'payload' => [true, 9, 'consumer', '007fff', [1, 5, 13]],
        'callback' => 42,
        'closure' => 42,
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
