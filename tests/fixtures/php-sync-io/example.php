<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';

use LeanJournal\{ChooseError, Err};
use function LeanJournal\choose;

$result = choose(false, false, 'unused');
if (!$result instanceof Err || $result->value !== 37) {
    throw new RuntimeException('Expected a returned Err(37)');
}
try {
    choose(true, false, 'unused');
    throw new RuntimeException('Expected a declared failure');
} catch (ChooseError $failure) {
    if (!$failure->payload instanceof Err || $failure->payload->value !== 37) {
        throw $failure;
    }
}
