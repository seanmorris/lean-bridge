<?php
declare(strict_types=1);
use Brick\Math\BigInteger as B;
use function LeanDepot\{alias,badge,checked,closes,make,pending,read,release,stream};
use function LeanPeer\bump;
function check(bool $ok,string $label): void { if (!$ok) throw new LogicException($label); }
function rejects(string $class,Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { if ($e instanceof $class) return $e; throw $e; }
    throw new LogicException("Missing $class");
}
$t=make(B::of(10)); $b=badge(B::of(10));
check($t instanceof LeanDepot\Ticket && $t instanceof LeanPeer\Ticket && !($t instanceof LeanDepot\Badge),'canonical aliases');
rejects(Error::class,fn()=>new LeanDepot\Ticket());
rejects(LogicException::class,fn()=>serialize($t));
rejects(Error::class,fn()=>clone $t);
$fake=(new ReflectionClass(LeanPeer\Ticket::class))->newInstanceWithoutConstructor();
rejects(LogicException::class,fn()=>read($fake));
rejects(TypeError::class,fn()=>bump($b,B::of(1)));
rejects(TypeError::class,fn()=>$t->sameResource($b)); $b->close();
$keep=$t->retain(); $alias=alias($t);
check($alias->sameResource($keep),'retained identity'); $alias->close(); $alias->close();
rejects(LogicException::class,fn()=>read($alias));
$task=pending($t); $t->close(); release(B::of(5)); $delivered=$task->await();
check($task->await()===$delivered && $keep->sameResource($delivered),'one task result, independent native owner');
$foreign=bump($delivered,B::of(4))->await(); $delivered->close();
check($foreign->sameResource($keep) && read($foreign)->isEqualTo(19),'shared mutation');
$e=rejects(LeanDepot\CheckedError::class,fn()=>checked(true,$foreign));
check($e->declaration==='Depot.checked' && $e->payload->sameResource($keep),'immediate factory failure owns payload');
$foreign->close(); check(read($e->payload)->isEqualTo(19),'payload outlives caller'); $e->payload->close();
$success=checked(false,$keep)->await(); check($success->sameResource($keep),'factory success'); $success->close();
$start=closes()->toInt();
foreach (stream($keep,false) as $item) { check($item->sameResource($keep),'iterator element'); }
check(closes()->toInt()===$start+1 && read($item)->isEqualTo(19),'item outlives closed cursor');
$err=rejects(LeanDepot\StreamStepError::class,static function() use ($item) {
    foreach (stream($item,true) as $v) $v->close();
});
check($err->payload->sameResource($item),'step failure owns payload'); $err->payload->close();
foreach (stream($keep,false) as $v) { $v->close(); break; }
check(closes()->toInt()===$start+3,'exhaustion, error and early break close once');
$late=pending($item); $item->close(); check($late->cancel(),'cancel pending lease'); release(B::of(7));
rejects(LeanDepot\TaskCancelled::class,fn()=>$late->await()); $late->awaitCleanup();
$unobserved=checked(false,$keep);
vrzno_await(vrzno_shared('testIdle')());
unset($unobserved);
check(read($keep)->isEqualTo(26),'cancel stops delivery, not the released worker mutation');
$mixed=LeanDepot\using_callback($keep,static function(B $count): B {
    check($count->isEqualTo(26),'callback receives the current shared value');
    return $count->plus(7);
})->await();
check($mixed->sameResource($keep),'callback task returns the same owned resource');
check(read($mixed)->isEqualTo(33),'callback updates the shared value once');
$problem=new DomainException('unable to update');
$job=LeanDepot\using_callback($mixed,fn(B $count)=>throw $problem);
check(rejects(DomainException::class,fn()=>$job->await())===$problem,'resource task preserves callback exception identity');
$job->awaitCleanup(); $mixed->close(); $keep->close();
echo 'PHP lease API: cross-package identity, error ownership and disposal passed';
