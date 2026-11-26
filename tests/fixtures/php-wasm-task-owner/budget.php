<?php
declare(strict_types=1);

use Brick\Math\BigInteger as B;
use LeanBudget\CallbackAlreadyInvoked;
use function LeanBudget\{pair,probe,retry,single};

function check(bool $ok): void { if (!$ok) throw new LogicException('Unexpected callback budget result'); }
function failed(Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { return $e; }
    throw new LogicException('Expected a callback failure');
}
$first=0; $many=0; $nested=0;
$job=probe(B::of(39),function(B $n) use (&$first,&$nested) {
    ++$first;
    return single($n,function(B $v) use (&$nested) { ++$nested; return $v->plus(1); })->await();
},function(B $v) use (&$many) { ++$many; return $v->plus(1); });
$used=failed(fn()=>$job->await());
check($used instanceof CallbackAlreadyInvoked && failed(fn()=>$job->await())===$used);
check([$first,$many,$nested]===[1,2,1]);
$calls=0; $original=new DomainException('A once callback cannot be invoked more than once');
$reject=function(B $n) use (&$calls,$original) { ++$calls; throw $original; };
check(failed(fn()=>retry(B::of(1),$reject)->await()) instanceof CallbackAlreadyInvoked && $calls===1);
check(failed(fn()=>single(B::of(1),$reject)->await())===$original && $calls===2);
// Even a real policy error re-thrown by application code keeps its original identity.
check(failed(fn()=>single(B::of(1),fn(B $n)=>throw $used)->await())===$used);
$same=0; $add=function(B $n) use (&$same) { ++$same; return $n->plus(1); };
check(pair(B::of(40),$add,$add)->await()->isEqualTo(42) && $same===2);
check(single(B::of(41),$add)->await()->isEqualTo(42) && $same===3);
echo 'PHP callback budget: once 1, many 2, nested 1, distinct slots 2, fresh task 42';
