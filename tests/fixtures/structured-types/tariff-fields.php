<?php
declare(strict_types=1);

use LeanTariffQuotes\{LeanBridgeError, Tariff};
use function LeanTariffQuotes\{apply_tariff, echo_tariff, make_tariff, pack_quote, staged_quote, unpack_quote, with_recovery};

function check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException($label);
}
function refused(int $code, Closure $call): void {
    try { $call(); } catch (LeanBridgeError $e) {
        check($e->getCode() === $code, "wrong failure: " . $e->getMessage());
        return;
    }
    throw new RuntimeException("expected refusal " . $code);
}

// $live is a read-only measurement supplied by the separate observer.
function exercise(Closure $live): array {
    make_tariff(0)->quote->close();
    $baseline = $live();
    $original = make_tariff(40);
    $echoed = echo_tariff(new Tariff($original->quote));
    $unpacked = unpack_quote($echoed);
    $retained = $unpacked->retain();
    $repacked = pack_quote($retained);
    $keep = $repacked->quote->retain();
    $held = $live();
    check($held > $baseline, "native observer missed retained function");
    foreach ([$original->quote, $echoed->quote, $unpacked, $retained, $repacked->quote] as $fn) $fn->close();
    check($keep(3) === 43 && apply_tariff(new Tariff($keep), 2) === 42, "retained field");

    $visits = 0;
    $escaped = pack_quote(function(int $n) use (&$visits): int { ++$visits; return $n; });
    refused(10, fn() => ($escaped->quote)(1));
    refused(10, fn() => apply_tariff($escaped, 1));
    check($visits === 0, "expired PHP callback ran");
    $escaped->quote->close();

    $stageCalls = 0; $recovery = make_tariff(100)->quote;
    $stage = with_recovery(function(int $n) use ($keep, &$stageCalls) {
        check($n === 40, "stage argument"); ++$stageCalls; return $keep;
    }, $recovery);
    check(staged_quote($stage, 40, 4) === 44 && $stageCalls === 1, "staged reply");
    $marker = new RuntimeException("application rejected tariff");
    $bad = with_recovery(function(int $n) use ($marker) {
        $tmp = make_tariff($n)->quote;
        try { check($tmp(1) === $n+1, "nested call"); throw $marker; }
        finally { $tmp->close(); }
    }, $recovery);
    try { staged_quote($bad, 9, 3); throw new RuntimeException("swallowed callback failure"); }
    catch (Throwable $e) { if ($e !== $marker) throw $e; }
    check($recovery(2) === 102 && $keep(5) === 45, "failure disturbed existing functions");
    $recovery->close(); $keep->close();
    refused(4, fn() => echo_tariff(new Tariff($keep)));
    $fresh = make_tariff(6)->quote; $result = $fresh(36); $fresh->close();
    $after = $live();
    check($result === 42 && $baseline === $after, "recovery or cleanup failed");
    return compact("baseline", "held", "after", "stageCalls", "visits", "result");
}
