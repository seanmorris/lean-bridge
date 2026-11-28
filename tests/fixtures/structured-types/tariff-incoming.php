<?php
declare(strict_types=1);

use LeanTariffQuotes\LeanBridgeError;
use function LeanTariffQuotes\{flat_quote, visit_quote};

// Application code uses the generated API only; the caller observes cleanup.
function exerciseIncoming(Closure $checkpoint): void {
    $check = static function(bool $ok): void {
        if (!$ok) throw new LogicException('unexpected direct callback result');
    };
    $expired = static function(Closure $op): void {
        try { $op(); }
        catch (LeanBridgeError $e) { if ($e->getCode() === 4) return; throw $e; }
        throw new LogicException('expired borrow still worked');
    };
    $check(flat_quote(fn($a,$b) => $a+$b,2,3) === 5);
    $checkpoint('baseline');
    foreach ([false,true] as $keep) foreach ([false,true] as $fail) {
        $borrow = $lease = null;
        $original = new DomainException('application rejected quote');
        try {
            $result = visit_quote(40,function($quote,$n) use ($keep,$fail,$check,$original,&$borrow,&$lease) {
                $check($borrow === null && $quote($n) === 42);
                $borrow = $quote;
                if ($keep) {
                    $lease = $quote->retain();
                    $check($quote !== $lease && $quote->sameIdentity($lease) && $lease->sameIdentity($quote));
                }
                if ($fail) throw $original;
                return $quote($n);
            },2);
            $check(!$fail && $result === 42);
        } catch (DomainException $e) { $check($fail && $e === $original); }
        $expired(fn() => $borrow(1));
        if ($keep) {
            $expired(fn() => $borrow->sameIdentity($lease));
            if (!$fail) $checkpoint('held');
            $borrow->close();
            $check($lease(5) === 45);
            $lease->close(); $expired(fn() => $lease(1));
        } else $borrow->close();
        $checkpoint($keep ? ($fail ? 'errorLease' : 'lease') : ($fail ? 'error' : 'success'));
    }
    $marker = new DomainException('inner refused'); $inner = null;
    $total = visit_quote(30,function($outer,$n) use ($check,$expired,$marker,&$inner) {
        try {
            visit_quote(90,function($other,$m) use ($outer,$check,$marker,&$inner) {
                $check(!$outer->sameIdentity($other) && $other($m) === 93);
                $inner = $other; throw $marker;
            },3);
            throw new LogicException('lost inner error');
        } catch (DomainException $e) { $check($e === $marker); }
        $expired(fn() => $inner(1)); $inner->close();
        return $outer($n);
    },4);
    $check($total === 34); $checkpoint('nested');
    $check(visit_quote(1,fn($q,$n) => $q($n),5) === 6);
    $check(visit_quote(60,fn($q,$n) => $q($n),3) === 63); $checkpoint('fresh');
}

// The engine, not Lean, creates this error. Consumers may catch it outside
// the bridge or leave it to PHP's normal uncaught-error handler.
function incomingTypeError(): never {
    visit_quote(70,static function($q,$n) {
        if ($q($n) !== 72) throw new LogicException('bad captured function');
        return strlen([]);
    },2);
    throw new LogicException('swallowed PHP engine error');
}
