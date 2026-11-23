<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use function LeanLedger\{add,choose,read_total};
use function LeanSwitchboard\{answer,make_adder,twice};

require_once '/vendor/lean-bridge/switchboard/bootstrap.php';
require_once '/vendor/lean-bridge/ledger/bootstrap.php';
function ok(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException($label);
}
function fails(string $class, Closure $f): Throwable {
    try { $f(); } catch (Throwable $e) {
        if (!$e instanceof $class) throw new RuntimeException("Expected $class, got ".get_class($e).': '.$e->getMessage(),0,$e);
        return $e;
    }
    throw new RuntimeException('Expected '.$class);
}
ok(answer()===17 && dl('snapshot.so'), 'startup peer and read-only observer');
$cold=fails(RuntimeException::class,fn()=>twice(0,fn($v)=>read_total()));
ok(str_contains($cold->getMessage(),'inside a synchronous Lean callback'),'no first-use dl inside callback');
ok(read_total()->isZero(),'cold callback did not mutate Ledger');
$counts=static fn()=>lean_bridge_test_snapshot();
ok($counts()===[1,2,1,2,2,0],'two ready components, zero leases');
$events=[];
$step=static function(int $value) use (&$events): int {
    $events[]=$value;
    add(BigInteger::one());
    return $value+1;
};
ok(twice(0,fn($n)=>twice($n,$step))===4 && $events===[0,1,2,3] && (string)read_total()==='4','nested reentry/order');
$mark=new LogicException('caller failure');
$caught=fails(LogicException::class,fn()=>twice(0,fn($n)=>twice($n,fn()=>throw $mark)));
ok($caught===$mark && $counts()[5]===0,'original host exception and cleanup');
$seen=null;
$throwLean=static function() use (&$seen) {
    try { choose(true,true,"typed\0detail"); }
    catch (LeanLedger\ChooseError $e) { $seen=$e; throw $e; }
};
$caught=fails(LeanLedger\ChooseError::class,fn()=>twice(0,fn($n)=>twice($n,$throwLean)));
ok($seen===$caught && $caught->declaration==='Ledger.choose' && $caught->payload->value==="typed\0detail" && $counts()[5]===0,'typed EIO across two callbacks');
fails(TypeError::class,fn()=>twice(0,fn()=>'not an int'));
ok(answer()===17 && (string)read_total()==='4' && $counts()[5]===0,'bad callback reply is recoverable');
$owned=new stdClass();
$weak=WeakReference::create($owned);
$short=static function(int $n) use ($owned): int { return $n+1; };
ok(twice(2,$short)===4,'borrowed callback');
unset($short,$owned);
ok($weak->get()===null,'borrowed PHP captures released');
$plus=make_adder(6);
ok($plus(7)===13 && $counts()[5]===1,'one live Lean closure');

// Inject an already-copied reply at the generated private decoder. The
// broker, extension, saved closure and both public APIs remain unmodified.
[$fault,$slots]=json_decode(file_get_contents('/case.json'),true,512,JSON_THROW_ON_ERROR);
function reply(int $slot, string $bytes): mixed {
    return (new ReflectionMethod(LeanLedger\Internal\Native::class,'reply'.$slot))->invoke(null,$bytes);
}
$copied=read_total();
fails(ValueError::class,fn()=>reply($slots['Ledger.magnitude'],"\0\0".str_repeat("\0",6823)."\1"));
ok($plus(0)===6 && $counts()[1]===2,'conversion limit leaves runtime ready');
[$name,$bytes]=match($fault) {
    'pending'=>['Ledger.readTotal',"\1\0"],
    'sum'=>['Ledger.choose',"\3\1\xff"],
    'padding'=>['Ledger.readTotal',"\0\1".pack('V2',4,0)],
    default=>throw new LogicException('unknown test case')
};
$err=fails(LeanLedger\LeanBridgeError::class,fn()=>reply($slots[$name],$bytes));
ok(str_contains($err->getMessage(),$name) && $counts()[1]===3,'malformed result retires shared runtime');
fails(LeanLedger\LeanBridgeError::class,fn()=>read_total());
fails(RuntimeException::class,fn()=>answer());
fails(RuntimeException::class,fn()=>$plus(1));
$plus->close(); $plus->close();
ok($plus->isClosed() && $counts()===[1,3,1,2,2,0],'cleanup after retirement');
ok((string)$copied==='4' && $seen->payload->value==="typed\0detail",'independent copied payloads');
echo 'callbacks:',$fault,':retired:0';
