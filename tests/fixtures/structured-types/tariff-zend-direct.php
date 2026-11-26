<?php
declare(strict_types=1);

use Brick\Math\BigInteger as U;
use LeanTariffQuotes\LeanBridgeError;
use function LeanTariffQuotes\{flat_quote, visit_quote};

function demand(bool $ok): void {
    if (!$ok) throw new LogicException('unexpected callback behavior at '.debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS,1)[0]['line']);
}
function closedBorrow(Closure $call): void {
    try { $call(); } catch (LeanBridgeError $e) {
        if ($e->getCode() !== 4) throw $e;
        return;
    }
    throw new LogicException('expired function still usable');
}
function exerciseZendVisitor(Closure $observe): void {
    demand(PHP_INT_SIZE === 4 && PHP_MAJOR_VERSION === 8 && PHP_MINOR_VERSION === 4);
    demand((string)flat_quote(fn(U $a,U $b): U => $a->plus($b),U::of(2),U::of(3)) === '5');
    $observe('baseline');
    foreach ([false,true] as $keep) foreach ([false,true] as $fail) {
        $borrow = $lease = null; $marker = new DomainException('visitor refused');
        try {
            $result = visit_quote(U::of(40),function($q,U $n) use ($keep,$fail,$marker,&$borrow,&$lease): U {
                demand($borrow === null && (string)$q($n) === '42'); $borrow = $q;
                if ($keep) {
                    $lease = $q->retain();
                    demand($q !== $lease && $q->sameIdentity($lease) && $lease->sameIdentity($q));
                }
                if ($fail) throw $marker;
                return $q($n);
            },U::of(2));
            demand(!$fail && (string)$result === '42');
        } catch (DomainException $e) { demand($fail && $e === $marker); }
        closedBorrow(fn() => $borrow(U::of(1)));
        if ($keep) {
            closedBorrow(fn() => $borrow->sameIdentity($lease));
            closedBorrow(fn() => $lease->sameIdentity($borrow));
            if (!$fail) $observe('held');
            $borrow->close(); demand((string)$lease(U::of(5)) === '45');
            $lease->close(); closedBorrow(fn() => $lease(U::of(1)));
        } else { $borrow->close(); }
        $observe($keep ? ($fail ? 'errorLease' : 'lease') : ($fail ? 'error' : 'success'));
    }
    $nested=visit_quote(U::of(30),static function($outer,U $n): U {
        $inner=null; $marker=new DomainException('inner refused');
        try {
            visit_quote(U::of(90),static function($other,U $m) use ($outer,$marker,&$inner): U {
                demand(!$outer->sameIdentity($other) && (string)$other($m) === '93');
                $inner=$other; throw $marker;
            },U::of(3));
            throw new LogicException('lost inner error');
        } catch (DomainException $e) { demand($e === $marker); }
        closedBorrow(fn() => $inner(U::of(1))); $inner->close();
        return $outer($n);
    },U::of(4));
    demand((string)$nested === '34'); $observe('nested');
    foreach ([[1,5,'6'],[60,3,'63']] as [$base,$units,$expected])
        demand((string)visit_quote(U::of($base),fn($q,U $n): U => $q($n),U::of($units)) === $expected);
    $observe('fresh');
}

// Measure only after the application has opened its binding; the JS host
// separately closes the binding with a live control before refreshing PHP.
$direct=[];
exerciseZendVisitor(static function(string $label) use (&$direct): void {
    if (!function_exists('owned_installed_snapshot')) dl('observer.so');
    gc_collect_cycles(); $direct[$label]=owned_installed_snapshot()['liveIdentities'];
});
echo json_encode(compact('direct'),JSON_THROW_ON_ERROR);
