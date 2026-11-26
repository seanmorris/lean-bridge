<?php
declare(strict_types=1);

use Brick\Math\BigInteger as UInt;
use LeanTariffQuotes\{LeanBridgeError, Tariff};
use function LeanTariffQuotes\{apply_tariff, echo_tariff, make_tariff, pack_quote, staged_quote, unpack_quote, with_recovery};

function check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException($label);
}
function refused(int $code, Closure $call): void {
    try { $call(); } catch (LeanBridgeError $e) {
        check($e->getCode() === $code, "incorrect refusal: ".$e->getMessage());
        return;
    }
    throw new RuntimeException("missing refusal: ".$code);
}
function live(): int {
    gc_collect_cycles();
    return owned_installed_snapshot()['liveIdentities'];
}
function exercise(): array {
    check(PHP_INT_SIZE === 4 && PHP_MAJOR_VERSION === 8 && PHP_MINOR_VERSION === 4, "not wasm32 PHP 8.4");
    make_tariff(UInt::of(0))->quote->close();
    if (!function_exists('owned_installed_snapshot')) dl('observer.so');
    $baseline = live();
    $orig = make_tariff(UInt::of(40));
    $echo = echo_tariff(new Tariff($orig->quote)); $unpacked = unpack_quote($echo);
    $retained = $unpacked->retain(); $repacked = pack_quote($retained); $keep = $repacked->quote->retain();
    $held = live(); check($held > $baseline, "observer missed live closures");
    foreach ([$orig->quote,$echo->quote,$unpacked,$retained,$repacked->quote] as $old) $old->close();
    check((string)$keep(UInt::of(3)) === '43' && (string)apply_tariff(new Tariff($keep),UInt::of(2)) === '42', "independent field lease");
    $visits = 0;
    $escaped = pack_quote(function(UInt $n) use (&$visits): UInt { ++$visits; return $n; });
    refused(10, fn() => ($escaped->quote)(UInt::of(1)));
    refused(10, fn() => apply_tariff($escaped,UInt::of(1)));
    check($visits === 0, "expired PHP callback ran"); $escaped->quote->close();
    $stageCalls = 0; $recovery = make_tariff(UInt::of(100))->quote;
    $stage = with_recovery(function(UInt $n) use ($keep,&$stageCalls) {
        check((string)$n === '40', "wrong first argument"); ++$stageCalls; return $keep;
    },$recovery);
    check((string)staged_quote($stage,UInt::of(40),UInt::of(4)) === '44' && $stageCalls === 1, "higher-order reply");
    $marker = new RuntimeException("application rejected tariff");
    $fail = with_recovery(function(UInt $n) use ($marker) {
        $tmp = make_tariff($n)->quote;
        try { check((string)$tmp(UInt::of(1)) === '10', "nested allocation"); throw $marker; }
        finally { $tmp->close(); }
    },$recovery);
    try { staged_quote($fail,UInt::of(9),UInt::of(3)); throw new RuntimeException("swallowed failure"); }
    catch (Throwable $e) { if ($e !== $marker) throw $e; }
    check((string)$recovery(UInt::of(2)) === '102' && (string)$keep(UInt::of(5)) === '45', "failure damaged owner");
    $recovery->close(); $keep->close();
    refused(4, fn() => echo_tariff(new Tariff($keep)));
    $fresh = make_tariff(UInt::of(6))->quote; $result = (string)$fresh(UInt::of(36)); $fresh->close();
    $after = live(); check($after === $baseline && $result === '42', "recovery or cleanup");
    return compact("baseline","held","after","visits","stageCalls","result");
}
echo json_encode(exercise(), JSON_THROW_ON_ERROR);
