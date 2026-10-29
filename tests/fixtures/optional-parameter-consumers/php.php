<?php
declare(strict_types=0);
require 'vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanDefaults\Some;
use function LeanDefaults\character;
use function LeanDefaults\maybe;
use function LeanDefaults\natural;
use function LeanDefaults\present;
use function LeanDefaults\text;
use function LeanDefaults\unit_value;
use function LeanDefaults\word;

$checks = 0;
function check(bool $condition): void
{
    global $checks;
    if (!$condition) throw new RuntimeException('Optional-parameter mismatch');
    ++$checks;
}

check(word() === 7);
check(word(7) === 7);
check(word(11) === 11);

$large = BigInteger::of('184467440737095516160');
check(natural()->isEqualTo($large));
check(natural($large)->isEqualTo($large));
check(natural(BigInteger::of(11))->isEqualTo(11));

check(text() === "Lean\nBridge");
check(text("Lean\nBridge") === "Lean\nBridge");
check(text('other') === 'other');

check(character() === 'λ');
check(character('λ') === 'λ');
check(character('猫') === '猫');

check(maybe() === null);
check(maybe(null) === null);
check(maybe(new Some(11))->value === 11);

$omittedPresent = present();
check($omittedPresent instanceof Some && $omittedPresent->value === 9);
check(present(new Some(9))->value === 9);
check(present(null) === null);
check(present(new Some(11))->value === 11);

check(unit_value() === null);
check(unit_value(null) === null);

foreach ([
    static fn() => word(null),
    static fn() => natural(null),
] as $invalid) {
    $rejected = false;
    try {
        $invalid();
    } catch (TypeError) {
        $rejected = true;
    }
    check($rejected);
}

echo "optional-parameter-php:$checks\n";
