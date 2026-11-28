<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

$original = LeanDepot\make(10, 'order');
$alias = LeanCounter\bump($original);
try {
    if (!$original->sameResource($alias)) throw new LogicException('Expected the same ticket');
    $original->close();
    if (LeanDepot\count($alias) !== 11) throw new LogicException('Expected the updated counter');
} finally {
    $original->close();
    $alias->close();
}
