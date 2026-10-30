<?php
declare(strict_types=0);
require 'vendor/autoload.php';

use function LeanDirectprooferasure\keep;

$checks = 0;
function check(bool $condition): void
{
    global $checks;
    if (!$condition) throw new RuntimeException('Direct proof-erasure mismatch');
    ++$checks;
}

$function = new ReflectionFunction('LeanDirectprooferasure\\keep');
check($function->getNumberOfParameters() === 1);
check($function->getNumberOfRequiredParameters() === 1);
check($function->getParameters()[0]->getName() === 'value');
check($function->getReturnType()?->getName() === 'int');

$proofRejected = false;
try {
    keep(_before: true, value: 0, _after: true);
} catch (Error $error) {
    $proofRejected = str_contains($error->getMessage(), 'Unknown named parameter $_before');
}
check($proofRejected);

for ($value = 0; $value < 1000; ++$value) {
    check(keep($value) === $value);
}

echo "direct-proof-php:$checks\n";
