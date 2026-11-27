<?php
declare(strict_types=1);

use Brick\Math\BigInteger as U;
use LeanTariffQuotes\LeanBridgeError;
use function LeanTariffQuotes\{flat_quote,make_tariff,pass_application_quote,staged_quote,visit_application_quote,with_recovery};

function expectValue(bool $ok): void {
    if (!$ok) throw new LogicException('unexpected PHP-Wasm forwarding result at line '.debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS,1)[0]['line']);
}
function expiredPrice($q, int $status): void {
    try { $q(U::of(999)); }
    catch (LeanBridgeError $e) { if ($e->getCode()===$status) return; throw $e; }
    throw new LogicException('expired callback reentered PHP');
}
function prices(Closure $observe): array {
    expectValue(PHP_INT_SIZE===4 && PHP_MAJOR_VERSION===8 && PHP_MINOR_VERSION===4);
    expectValue((string)flat_quote(fn(U $a,U $b): U=>$a->plus($b),U::of(1),U::of(2))==='3');
    $observe('baseline');
    $calls=[];
    $price=static function(U $n) use (&$calls): U { $calls[]=(string)$n; return $n->plus(40); };
    $expired=pass_application_quote($price); expiredPrice($expired,10); $expired->close();
    expectValue($calls===[]); $observe('expired');
    $saved=$lease=null; $fallback=make_tariff(U::of(800))->quote;
    try {
        $forwarded=visit_application_quote($price,static function($q,U $n) use (&$saved,&$lease,$fallback,$observe): U {
            $saved=$q; $lease=$q->retain(); expectValue((string)$q(U::of(0))==='40');
            $live=pass_application_quote($q);
            try {
                $observe('held'); return staged_quote(with_recovery(fn(U $unused)=>$live,$fallback),U::of(99),$n);
            } finally { $live->close(); }
        },U::of(2));
        expectValue((string)$forwarded==='42' && $calls===['0','2']);
        expiredPrice($saved,4); expiredPrice($lease,10);
    } finally { $saved?->close(); $lease?->close(); $fallback->close(); }
    $observe('forward');
    $marker=new DomainException('inner price rejected');
    $after=visit_application_quote($price,static function($outer,U $n) use ($marker): U {
        try { visit_application_quote(fn(U $m): U=>throw $marker,fn($q,U $m): U=>$q($m),U::of(99)); }
        catch (DomainException $error) { if ($error!==$marker) throw $error; return $outer($n); }
        throw new LogicException('swallowed callback exception');
    },U::of(3));
    expectValue((string)$after==='43' && $calls===['0','2','3']); $observe('nested');
    $source=make_tariff(U::of(900))->quote; $kept=pass_application_quote($source); $source->close();
    try { expectValue((string)$kept(U::of(6))==='906'); } finally { $kept->close(); }
    $fresh=visit_application_quote($price,fn($q,U $n): U=>$q($n),U::of(7));
    expectValue((string)$fresh==='47' && $calls===['0','2','3','7']); $observe('fresh');
    return [(string)$forwarded,(string)$after,(string)$fresh,$calls];
}
$direct=[];
$application=prices(static function(string $where) use (&$direct): void {
    if (!function_exists('owned_installed_snapshot')) dl('observer.so');
    gc_collect_cycles(); $direct[$where]=owned_installed_snapshot()['liveIdentities'];
});
echo json_encode(compact('direct','application'),JSON_THROW_ON_ERROR);
