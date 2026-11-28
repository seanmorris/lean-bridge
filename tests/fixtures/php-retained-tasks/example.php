<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use function LeanRetained\repeat_call;

$result = repeat_call('hello', static fn(string $text): string => $text.'!');
echo $result->await(), "\n"; // hello!!
