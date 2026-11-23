<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use function LeanCounter\issue;
use function LeanDepot\{count, revisit};

$ticket = issue(40);
$updated = revisit($ticket, static function (int $before) use ($ticket): int {
    $ticket->close();
    return $before + 2;
})->await();
try {
    echo count($updated), PHP_EOL; // 42
} finally {
    $updated->close();
}
