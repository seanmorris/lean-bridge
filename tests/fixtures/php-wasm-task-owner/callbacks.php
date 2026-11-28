<?php
declare(strict_types=1);
use Brick\Math\BigInteger as B;
use LeanRelay as R;
function check(bool $ok,string $reason): void { if (!$ok) throw new LogicException($reason); }
function failure(string $class,Closure $run): Throwable {
    try { $run(); } catch (Throwable $e) { if ($e instanceof $class) return $e; throw $e; }
    throw new LogicException("Missing ".$class);
}
$n=B::of(6); $order=[];
$blocked=\LeanJobs\hold();
$signal=R\worker($n,function(B $v) { \LeanJobs\release($v); return $v->plus(1); });
check($blocked->await()->isEqualTo(6) && $signal->await()->isEqualTo(7),'await on Jobs must dispatch Relay callback to unblock itself');
$two=R\twice($n,function(B $v) use (&$order) { $order[]=(string)$v; return $v->plus(1); },
    function(B $v) use (&$order) { $order[]=(string)$v; return $v->multipliedBy(3); });
check($two->await()->isEqualTo(21) && $order===['6','7'],'callback ordering and scalar transport');
$nested=R\factory($n,fn(B $v)=>R\worker($v,fn(B $x)=>R\add($x))->await());
check($nested->await()->isEqualTo(7),'nested PHP await and synchronous reentry');
check(R\text("a\0🌿",fn(string $v)=>$v.'!')->await()==="a\0🌿!",'UTF-8 with embedded NUL');
$bad=new DomainException('same message'); $other=new DomainException('same message');
$first=R\worker($n,fn(B $v)=>throw $bad);
$second=R\worker($n,fn(B $v)=>throw $other);
check(failure(DomainException::class,fn()=>$second->await())===$other,'second owner identity');
check(failure(DomainException::class,fn()=>$first->await())===$bad && failure(DomainException::class,fn()=>$first->await())===$bad,'original PHP exception across repeated awaits');
check(failure(DomainException::class,fn()=>R\propagate($n,fn(B $v)=>throw $bad)->await())===$bad,'Lean rethrows original');
check(R\recover($n,fn(B $v)=>throw $bad)->await()->isEqualTo(7),'Lean recovered from PHP error');
$replaced=failure(R\TaskIOError::class,fn()=>R\replace($n,fn(B $v)=>throw $bad)->await());
check($replaced!==$bad && $replaced->payload==='JavaScript callback failed','replacement is not original');
failure(TypeError::class,fn()=>R\worker($n,fn(B &$v)=>$v));
failure(TypeError::class,fn()=>R\worker($n,fn(B $v)=>'7')->await());
$registration=null;
$registration=new R\RetainedCallback(function(B $v) use (&$registration) { $registration->close(); return $v; });
check(R\worker($n,$registration)->await()->isEqualTo(6) && $registration->isClosed(),'self-disposal preserved active reply');
failure(R\CallbackClosed::class,fn()=>R\worker($n,$registration)->await());
$task=null;
$task=R\worker($n,function(B $v) use (&$task) { failure(LogicException::class,fn()=>$task->awaitCleanup());check($task->cancel(),'self-cancel'); return $v; });
$cancelled=failure(R\TaskCancelled::class,fn()=>$task->await());
check(failure(R\TaskCancelled::class,fn()=>$task->await())===$cancelled && !$task->cancel(),'late answer ignored');
$task->awaitCleanup(); $task->awaitCleanup();
$sink=new class { public function __invoke(B $v): B { throw new LogicException('discarded callback ran'); } };
$weak=WeakReference::create($sink); $abandoned=R\worker($n,$sink);unset($sink,$abandoned);gc_collect_cycles();
check($weak->get()===null,'abandoned callback released without await');
$kept=new class { public function __invoke(B $x): B { return $x; } };
$ref=WeakReference::create($kept);$finished=R\worker($n,$kept);unset($kept);
$finished->awaitCleanup(); gc_collect_cycles();
check($ref->get()===null && $finished->await()->isEqualTo(6),'cleanup releases callable while caching result');
check(R\worker($n,fn(B $v)=>$v)->await()->isEqualTo(6),'runtime reusable');
echo 'PHP callback API: reentry, exception identity and cancellation passed';
