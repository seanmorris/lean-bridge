<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
$other=LeanCounter\issue(9);
try {
    LeanDepot\make(3,'tampered');
    throw new LogicException('Modified ledger was accepted');
} catch (RuntimeException $error) {
    if (!str_contains($error->getMessage(),'differs from compiled evidence: liblb_task_resources_')) throw $error;
}
$alias=LeanCounter\bump($other);
if (!$other->sameResource($alias)) throw new LogicException('Unaffected package stopped working');
$alias->close(); $other->close();
echo "modified ledger refused\n";
