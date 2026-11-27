<?php
declare(strict_types=1);

use LeanTariffQuotes\LeanBridgeError;
use function LeanTariffQuotes\{exchange_ticket, flat_quote, make_tariff, new_ticket, pass_application_quote, staged_quote, ticket_serial, visit_application_quote, with_recovery};

function forwardedPrices(Closure $checkpoint): array {
    $check = static function(bool $ok): void {
        if (!$ok) throw new LogicException('unexpected value from installed PHP application');
    };
    $stale = static function($quote): void {
        try { $quote(999); }
        catch (LeanBridgeError $e) { if ($e->getCode() === 10) return; throw $e; }
        throw new LogicException('expired registration reentered PHP');
    };
    $check(flat_quote(fn($a,$b) => $a+$b,1,2) === 3); $checkpoint('baseline');
    $trace = [];
    $price = static function(int $n) use (&$trace): int { $trace[] = $n; return 40+$n; };
    $expired = pass_application_quote($price);
    try { $stale($expired); } finally { $expired->close(); }
    $check($trace === []); $checkpoint('expired');
    $fallback = make_tariff(800)->quote; $alias = null;
    try {
        $forwarded = visit_application_quote($price, function($q,$n) use ($check,$checkpoint,$fallback,&$alias) {
            $alias = $q->retain();
            $live = pass_application_quote($q);
            try {
                $check($live(0) === 40); $checkpoint('held');
                return staged_quote(with_recovery(fn($unused) => $live,$fallback),99,$n);
            } finally { $live->close(); }
        },2);
        $check($forwarded === 42); $stale($alias);
    } finally { $alias?->close(); $fallback->close(); }
    $checkpoint('forward');

    $failure = new DomainException('inner price rejected');
    $after = visit_application_quote($price,static function($outer,$n) use ($failure) {
        try { visit_application_quote(fn($m) => throw $failure,fn($inner,$m) => $inner($m),99); }
        catch (DomainException $e) { if ($e !== $failure) throw $e; return $outer($n); }
        throw new LogicException('nested callback exception was swallowed');
    },3);
    $check($trace === [0,2,3] && $after === 43); $checkpoint('nested');
    $replies = [];
    foreach ([42,71] as $n) {
        $input=new_ticket($n); $recovery=new_ticket(800); $reply=new_ticket($n+1);
        try {
            $hits=0;
            $exchange=static function($t) use ($n,$reply,$check,&$hits) {
                ++$hits; $check(ticket_serial($t) === $n); return $reply;
            };
            $result=exchange_ticket($input,with_recovery($exchange,$recovery));
            $check($result === $n+1 && $hits === 1); $replies[]=$result;
            try {
                exchange_ticket($input,with_recovery(static function($t) use ($n,$check,$failure) {
                    $check(ticket_serial($t) === $n); throw $failure;
                },$recovery));
                throw new LogicException('returned recovery Ticket instead of throwing');
            } catch (DomainException $e) { if ($e !== $failure) throw $e; }
            $check(ticket_serial($input) === $n && ticket_serial($recovery) === 800);
        } finally { $reply->close(); $recovery->close(); $input->close(); }
        $checkpoint('ticket'.$n);
    }
    return compact('forwarded','after','trace','replies');
}
