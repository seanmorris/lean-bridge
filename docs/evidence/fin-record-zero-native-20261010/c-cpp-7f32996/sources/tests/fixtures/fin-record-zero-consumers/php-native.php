<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanFinrecordzero\{Fields, Zero, LeanBridgeError};
use function LeanFinrecordzero\{array_records, list_records, field_collections, array_fields, list_fields};
$checks = 0;
function check(bool $value, string $label): void { global $checks; if (!$value) throw new Exception($label); ++$checks; }
function fields(?string $member = null, mixed $digit = 0): Fields {
    return new Fields('kept', [BigInteger::of(7), BigInteger::of(2)->power(100)],
        $member === 'array' ? [BigInteger::of($digit)] : [], $member === 'list' ? [BigInteger::of($digit)] : []);
}
function same(mixed $a, mixed $b): bool {
    if (is_array($a)) {
        if (!is_array($b) || count($a) !== count($b)) return false;
        foreach ($a as $k => $value) if (!same($value, $b[$k])) return false;
        return true;
    }
    return $a->equals($b);
}
function refused(callable $call, callable $build, string $path): bool {
    $value = $build(); $before = $build();
    try { $call($value); }
    catch (LeanBridgeError $error) {
        return $error->getCode() === 1 && $error->getMessage() === "$path is not below its Fin 0 bound" && same($value, $before);
    }
    return false;
}
foreach (['LeanFinrecordzero\\array_records', 'LeanFinrecordzero\\list_records'] as $call) {
    check(same($call([]), []), 'empty record collection');
    foreach ([0, 1, BigInteger::of(2)->power(100)] as $digit) {
        check(refused($call, fn() => [new Zero(BigInteger::of($digit))], 'arg0[0].digit'), 'populated record collection');
    }
    check(same($call([]), []), 'record recovery');
}
check(field_collections(fields())->equals(fields()), 'empty fields and result');
foreach (['array', 'list'] as $member) {
    foreach ([0, 1, BigInteger::of(2)->power(100)] as $digit) {
        check(refused('LeanFinrecordzero\\field_collections', fn() => fields($member, $digit), "arg0.{$member}[0]"), 'populated field');
    }
}
check(field_collections(fields())->equals(fields()), 'field recovery');
foreach (['LeanFinrecordzero\\array_fields', 'LeanFinrecordzero\\list_fields'] as $call) {
    check(same($call([]), []), 'empty outer collection');
    check(same($call([fields(), fields(), fields()]), [fields(), fields(), fields()]), 'populated outer collection of empty fields');
    for ($index = 0; $index < 3; ++$index) {
        foreach (['array', 'list'] as $member) {
            $build = fn() => array_map(fn($k) => $k === $index ? fields($member, 0) : fields(), range(0, 2));
            check(refused($call, $build, "arg0[$index].{$member}[0]"), 'nested field rejection');
            check(same($call([fields(), fields(), fields()]), [fields(), fields(), fields()]), 'nested field recovery');
        }
    }
}
for ($index = 0; $index < 1000; ++$index) {
    check(field_collections(fields())->equals(fields()), 'round valid');
    $member = $index % 2 === 0 ? 'array' : 'list';
    check(refused('LeanFinrecordzero\\field_collections', fn() => fields($member, $index), "arg0.{$member}[0]"), 'round rejection');
}
echo "fin-record-zero-ok:$checks\n";
