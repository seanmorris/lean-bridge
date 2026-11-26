<?php
declare(strict_types=1);

use Brick\Math\BigInteger as UInt;
use LeanTariffQuotes\{LeanBridgeError, Tariff};
use function LeanTariffQuotes\{apply_tariff, echo_tariff, make_tariff, pack_quote, staged_quote, unpack_quote, with_recovery};
use LeanTariffQuotes\{TariffInput, PriceCardInput};
use function LeanTariffQuotes\{apply_tariff_with_host_fields, echo_tariff_with_host_fields, unpack_quote_with_host_fields, compare_cards_with_host_fields};

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
function inputCases(int $baseline): array {
    $settled = []; $calls = 0; $inner = 0; $two = UInt::of(2);
    $settle = static function(string $stage) use ($baseline,&$settled): void {
        check(($settled[$stage] = live()) === $baseline, $stage.' left a live identity');
    };
    $row = new TariffInput(quote: static function(UInt $v) use (&$calls): UInt {
        return $v->plus(39 + ++$calls);
    });
    check((string)apply_tariff_with_host_fields($row,$two) === '42', 'first capture');
    check((string)apply_tariff_with_host_fields($row,$two) === '43', 'second capture');
    $settle('capture');
    $nested = new TariffInput(static function(UInt $v) use (&$inner): UInt {
        return apply_tariff_with_host_fields(new TariffInput(static function(UInt $x) use (&$inner): UInt {
            ++$inner; return $x->plus(40);
        }),$v);
    });
    check((string)apply_tariff_with_host_fields($nested,$two) === '42' && $inner === 1, 'nested frame');
    $settle('reentry');
    foreach ([echo_tariff_with_host_fields($row)->quote,unpack_quote_with_host_fields($row)] as $expired) {
        try { refused(10, fn() => $expired($two)); } finally { $expired->close(); }
    }
    check($calls === 2, 'late dispatch'); $settle('expired');
    $marker = new RuntimeException('callback marker');
    try { apply_tariff_with_host_fields(new TariffInput(fn(UInt $x) => throw $marker),$two); throw new RuntimeException('unexpected success'); }
    catch (Throwable $failure) { if ($failure !== $marker) throw $failure; }
    check((string)apply_tariff_with_host_fields($row,$two) === '44', 'healthy retry'); $settle('error');
    $source = make_tariff(UInt::of(40));
    check((string)apply_tariff_with_host_fields($source,$two) === '42', 'original leased record');
    $saved = echo_tariff_with_host_fields(new TariffInput($source->quote))->quote;
    $held = live(); check($held > $baseline, 'no held-lease control');
    $source->quote->close(); check((string)$saved($two) === '42','lost independent lease');
    refused(4, fn() => apply_tariff_with_host_fields($source,$two)); $saved->close();
    $settle('lease');
    foreach ([new stdClass(),new TariffInput(17),new TariffInput(fn(UInt $a,UInt $b) => $a)] as $bad) {
        try { apply_tariff_with_host_fields($bad,$two); throw new RuntimeException('accepted invalid callback'); }
        catch (TypeError|ArgumentCountError $expected) {}
    }
    try { apply_tariff_with_host_fields($row,UInt::of(-1)); throw new RuntimeException('invalid unsigned input'); }
    catch (ValueError $expected) {}
    check($calls === 3 && $inner === 1,'validation dispatched');
    $settle('validation');
    $seen = [[],[],[],[]];
    $slot = static function(int $i, int $factor, int $offset) use (&$seen): Closure {
        return static function(UInt $x) use ($i,$factor,$offset,&$seen): UInt {
            $seen[$i][] = (string)$x; return $x->multipliedBy($factor)->plus($offset);
        };
    };
    $left = new PriceCardInput($slot(0,2,0),$slot(1,1,1),"A\0é",UInt::of(2));
    $right = new PriceCardInput($slot(2,3,0),$slot(3,1,7),"β",UInt::of(5));
    $bad = new PriceCardInput($slot(2,3,0),new stdClass(),"β",UInt::of(5));
    try { compare_cards_with_host_fields($left,$bad); throw new RuntimeException('accepted invalid second input'); }
    catch (TypeError $expected) {}
    check($seen === [[],[],[],[]], 'partial dispatch');
    $mixed = (string)compare_cards_with_host_fields($left,$right);
    check($mixed === '78' && $seen === [['9'],['5'],['6'],['2']], 'mixed arguments');
    $settle('mixed');
    return compact('settled','held','calls','inner','mixed','seen');
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
    $report = compact("baseline","held","after","visits","stageCalls","result");
    if (class_exists(TariffInput::class,false)) $report['hostInputs'] = inputCases($baseline);
    return $report;
}
echo json_encode(exercise(), JSON_THROW_ON_ERROR);
