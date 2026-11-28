<?php
declare(strict_types=1);

use LeanTariffQuotes\{Tariff, TariffInput};
use function LeanTariffQuotes\{apply_tariff_with_host_fields, echo_tariff_with_host_fields, make_tariff, unpack_quote_with_host_fields};

function exerciseHostFields(Closure $live): array {
    $baseline = $live(); $settled = [];
    $settle = function(string $point) use ($live, $baseline, &$settled): void {
        check(($settled[$point] = $live()) === $baseline, $point.' left an identity behind');
    };
    $calls = 0;
    $local = new TariffInput(quote: function(int $n) use (&$calls): int { return $n + 39 + ++$calls; });
    check(apply_tariff_with_host_fields($local, 2) === 42 && apply_tariff_with_host_fields($local, 2) === 43, 'captured field');
    $settle('capture');
    $inner = 0;
    $nested = new TariffInput(function(int $n) use (&$inner): int {
        return apply_tariff_with_host_fields(new TariffInput(function(int $x) use (&$inner): int { ++$inner; return $x+40; }), $n);
    });
    check(apply_tariff_with_host_fields($nested, 2) === 42 && $inner === 1, 'nested inputs');
    $settle('reentry');
    $escaped = echo_tariff_with_host_fields($local)->quote;
    try { refused(10, fn() => $escaped(3)); } finally { $escaped->close(); }
    $returned = unpack_quote_with_host_fields($local);
    try { refused(10, fn() => $returned(3)); } finally { $returned->close(); }
    check($calls === 2, 'late dispatch');
    $settle('expired');
    $marker = new RuntimeException('field failed');
    try { apply_tariff_with_host_fields(new TariffInput(fn(int $v) => throw $marker), 2); throw new RuntimeException('unexpected success'); }
    catch (Throwable $e) { if ($e !== $marker) throw $e; }
    check(apply_tariff_with_host_fields($local, 2) === 44, 'healthy retry');
    $settle('error');
    $source = make_tariff(40);
    check(apply_tariff_with_host_fields($source, 2) === 42, 'leased input');
    $saved = echo_tariff_with_host_fields(new TariffInput($source->quote))->quote;
    $held = $live(); check($held > $baseline, 'no held-lease control');
    $source->quote->close();
    check($saved(2) === 42, 'lost returned lease');
    refused(4, fn() => apply_tariff_with_host_fields($source, 2)); $saved->close();
    $settle('lease');
    foreach ([new stdClass(), new TariffInput(17), new TariffInput(fn(int $x, int $y) => $x+$y)] as $bad) {
        try { apply_tariff_with_host_fields($bad, 2); throw new RuntimeException('accepted invalid input'); }
        catch (TypeError|ArgumentCountError $expected) {}
    }
    check($calls === 3 && $inner === 1, 'invalid input dispatched');
    $settle('validation');
    return compact('settled','held','calls','inner');
}

// The original observer emits its independent cleanup measurements at shutdown.
require __DIR__ . '/tariff-observer.php';
echo json_encode(exerciseHostFields($live), JSON_THROW_ON_ERROR), "\n";
