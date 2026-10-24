<?php
// Independent installed native-PHP checks for generic Subtype compositions.
declare(strict_types=0);
require 'vendor/autoload.php';

use Brick\Math\BigInteger;
use LeanNominalsubtypes\{GenericNat, LeanBridgeError};
use function LeanNominalsubtypes\{generic_use, echo_generic_first, echo_generic_second};

$checks = $rejections = 0;
$n = fn(int $value) => BigInteger::of($value);
$generic = fn(int $value, int $marker) => new GenericNat($n($value), $n($marker));
$snapshot = fn(GenericNat $value) => [(string) $value->value, (string) $value->marker];
$check = function(bool $condition, string $label) use (&$checks): void {
    if (!$condition) throw new RuntimeException('failed: ' . $label); ++$checks;
};
$call = function(string $name, GenericNat $input, callable $action, GenericNat $expected) use ($snapshot, $check): void {
    $before = $snapshot($input); $result = $action($input);
    $check($snapshot($result) === $snapshot($expected), "$name exact copied result");
    $check($snapshot($input) === $before, "$name input unchanged");
};
$scalar = function(GenericNat $input, BigInteger $expected) use ($snapshot, $check): void {
    $before = $snapshot($input);
    $check(generic_use($input)->isEqualTo($expected), 'generic_use exact result');
    $check($snapshot($input) === $before, 'generic_use input unchanged');
};
$refused = function(string $name, GenericNat $input, callable $action, string $constructor) use ($snapshot, $check, &$rejections): void {
    $before = $snapshot($input); $expected = "value0.value was rejected by NominalSubtypes.$constructor";
    try { $action($input); } catch (LeanBridgeError $error) {
        $check(get_class($error) === LeanBridgeError::class && $error->getCode() === 1 && $error->getMessage() === $expected, "$name exact refusal");
        $check($snapshot($input) === $before, "$name rejected input unchanged"); ++$rejections; return;
    }
    throw new RuntimeException("accepted: $expected");
};

$scalar($generic(40, 2), $n(43));
$call('echo_generic_first', $generic(40, 2), 'LeanNominalsubtypes\\echo_generic_first', $generic(41, 2));
$call('echo_generic_second', $generic(40, 2), 'LeanNominalsubtypes\\echo_generic_second', $generic(42, 2));
$scalar($generic(99, 7), $n(107));
$call('echo_generic_first', $generic(99, 7), 'LeanNominalsubtypes\\echo_generic_first', $generic(100, 7));
$refused('generic_use', $generic(100, 2), 'LeanNominalsubtypes\\generic_use', 'plusOne');
$refused('echo_generic_first', $generic(100, 2), 'LeanNominalsubtypes\\echo_generic_first', 'plusOne');
$refused('echo_generic_second', $generic(90, 2), 'LeanNominalsubtypes\\echo_generic_second', 'plusTwo');
$call('echo_generic_second', $generic(40, 2), 'LeanNominalsubtypes\\echo_generic_second', $generic(42, 2));
echo json_encode(compact('checks', 'rejections'), JSON_THROW_ON_ERROR) . "\n";
