<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use LeanCounter as Counter;
use LeanDepot as Depot;
use Revolt\EventLoop;

Depot\reset();
$original = Counter\issue(40);
try {
    $work = Depot\pending($original, true);
} finally {
    $original->close(); // The worker now holds its own Lean reference.
}
EventLoop::delay(0.01, static function (): void { Depot\release(); });
$result = $work->await();
try {
    $peer = Counter\bump($result);
    try {
        echo Depot\count($peer), PHP_EOL; // 42, on the same ticket.
    } finally {
        $peer->close();
    }
} finally {
    $result->close();
}
