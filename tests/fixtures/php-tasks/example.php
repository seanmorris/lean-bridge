<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use Amp\TimeoutCancellation;
use LeanPulse\Bytes;
use function LeanPulse\{bytes, series};

$deadline = new TimeoutCancellation(5);
$result = bytes(Bytes::fromString("hello"), cancellation: $deadline)->await();
echo $result->toString(), PHP_EOL;

foreach (series(false, false, 'first item') as $item) {
    echo $item->value, PHP_EOL;
    break; // No second pull; the loop releases the cursor.
}
