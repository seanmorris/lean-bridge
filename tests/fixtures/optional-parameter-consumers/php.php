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

function same_number(mixed $actual, mixed $expected): bool
{
	if ($actual instanceof BigInteger && $expected instanceof BigInteger) {
		return $actual->isEqualTo($expected);
	}
	return $actual === $expected;
}

$defaultWord = word();
$wasmNumbers = $defaultWord instanceof BigInteger;
$wordSeven = $wasmNumbers ? BigInteger::of(7) : 7;
$wordEleven = $wasmNumbers ? BigInteger::of(11) : 11;
check($wasmNumbers ? $defaultWord->isEqualTo(7) : $defaultWord === 7);
$wordSevenResult = word($wordSeven);
check($wasmNumbers ? $wordSevenResult->isEqualTo(7) : $wordSevenResult === 7);
$wordElevenResult = word($wordEleven);
check($wasmNumbers ? $wordElevenResult->isEqualTo(11) : $wordElevenResult === 11);

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
check(same_number(maybe(new Some($wordEleven))->value, $wordEleven));

$omittedPresent = present();
check($omittedPresent instanceof Some && ($wasmNumbers
    ? $omittedPresent->value->isEqualTo(9)
    : $omittedPresent->value === 9));
check(same_number(present(new Some($wordSeven))->value, $wordSeven));
check(present(null) === null);
check(same_number(present(new Some($wordEleven))->value, $wordEleven));

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
