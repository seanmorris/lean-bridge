<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';

try {
    LeanJournal\bump(1);
    throw new LogicException('Modified component executed');
} catch (RuntimeException $failure) {
    if (!str_contains($failure->getMessage(), 'differs from compiled evidence')) throw $failure;
}
if (LeanCompanion\bump(9) !== 9) throw new LogicException('Unaffected component did not load');
echo "modified component refused before loading\n";
