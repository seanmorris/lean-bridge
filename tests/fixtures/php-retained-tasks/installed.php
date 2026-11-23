<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\CancelledException;
use Amp\DeferredCancellation;
use Amp\Future;
use Amp\TimeoutCancellation;
use Brick\Math\BigInteger;
use LeanRetained as R;
use Revolt\EventLoop;

$checks=0;
function check(bool $ok,string $why): void {
    global $checks;
    if (!$ok) throw new RuntimeException($why);
    ++$checks;
}
function rejects(string $class,Closure $run): Throwable {
    try { $run(); } catch (Throwable $e) {
        check($e instanceof $class,'expected '.$class.', got '.$e::class.': '.$e->getMessage()); return $e;
    }
    throw new RuntimeException('expected '.$class);
}
function value(Future $f): mixed { return $f->await(new TimeoutCancellation(15)); }
function until(Closure $test): void {
    $timer=new TimeoutCancellation(15);
    while (!$test()) Amp\delay(.002,cancellation:$timer);
}
function same(mixed $v,mixed $expected): bool {
    return $expected instanceof BigInteger ? $v instanceof BigInteger && $v->isEqualTo($expected) :
        ($expected instanceof R\Bytes ? $v instanceof R\Bytes && $v->equals($expected) : $v===$expected);
}
function fds(): int { return count(scandir('/proc/self/fd')); }
check(R\plain(41)===42,'first call initialized this component');
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
function live(): int {
    global $observer;
    $s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s)); return $s->live_identities;
}
$huge=BigInteger::of('123456789123456789123456789'); $max=BigInteger::of('18446744073709551615');
$bin=R\Bytes::fromString("\0\xff"); $values=[null,true,'🙂',"a\0雪",$bin,$huge,$huge->negated(),255,65535,4294967295,
    $max,$max,-128,-32768,-2147483648,PHP_INT_MIN,PHP_INT_MAX,1.25,-INF,null];
$fs=[]; $seen=[];
for ($i=0;$i<19;$i++) $fs[]=static function($v) use ($i,$values,&$seen) {
    $seen[]=$i; check(same($v,$values[$i]),'exact input for slot '.$i); return $values[$i+1];
};
check(value(R\scalar_tour(...$fs))===null && $seen===range(0,18),'Lean consumed every reply in order');
$baseline=fds(); $events=[];
$joined=R\during_start(static function(string $s) use (&$events) { $events[]='f'; return $s.'f'; },
    static function(string $s) use (&$events) {
        $events[]='g'; check(R\plain(7)===8,'same-thread synchronous reentry');
        return value(R\repeat_call($s,static fn(string $v)=>$v.'g'));
    },'a');
check($joined instanceof Future && value($joined)==='afggf' && $events===['f','g','f'],'nested await on a different retained owner');
$fault=new DomainException('identical');
$bad=static fn($v)=>throw $fault;
$future=R\repeat_call('x',$bad);
check(rejects(DomainException::class,fn()=>value($future))===$fault,'original PHP exception object');
check(rejects(DomainException::class,fn()=>value($future))===$fault,'same exception on another await');
$other=new DomainException('identical');
$first=R\once(1,$bad); $second=R\once(2,static fn($v)=>throw $other);
check(rejects(DomainException::class,fn()=>value($second))===$other && rejects(DomainException::class,fn()=>value($first))===$fault,'same text, independent owners');
$caught=value(R\recover($bad,$huge));
check($caught instanceof R\Err && $caught->value==='caught in Lean','Lean caught the PHP exception');
$replacement=rejects(R\TaskIOError::class,fn()=>value(R\replace_error($bad)));
check($replacement!==$fault && $replacement->payload==='identical','Lean replacement with the same text is not the original');
$start=R\during_start($bad,static fn($v)=>$v,'start');
check(rejects(DomainException::class,fn()=>value($start))===$fault,'propagated PHP object from inside factory');
$visits=0; $count=static function($v) use (&$visits) { ++$visits; return $v; };
$eio=R\typed_start($count,true,$bin);
$e=rejects(R\TypedStartError::class,fn()=>value($eio));
check($e->payload==='factory refused' && $e->declaration==='Retained.typedStart' && $visits===0,'declared typed factory failure');
$io=R\early(true,$count); $e=rejects(R\IOError::class,fn()=>value($io));
check($e->declaration==='Feedback.early' && $e->payload==='early Ruby factory' && $visits===0,'IO factory error, not terminal IO');
check(value(R\typed_start($count,false,$bin))->equals($bin) && $visits===1,'typed factory success');
rejects(TypeError::class,fn()=>R\once(0,static function(&$v) { return $v; }));
rejects(TypeError::class,fn()=>R\once(0,static fn($x,$y)=>$x+$y));
rejects(TypeError::class,fn()=>R\once(0,static function($v) { yield $v; }));
rejects(TypeError::class,fn()=>R\once(0,static function &($v) { return $v; }));
rejects(TypeError::class,fn()=>R\once(0,null));
rejects(TypeError::class,fn()=>value(R\once(0,static fn($v)=>'7')));
check(R\plain(11)===12,'invalid reply closes only its own task');
$reg=null; $reg=new R\RetainedCallback(static function(int $v) use (&$reg): int { $reg->close(); return $v+1; });
check(value(R\once(9,$reg))===10 && $reg->isClosed(),'self-disposal allows active reply');
rejects(R\CallbackClosed::class,fn()=>value(R\once(9,$reg)));
$reg->close(); rejects(LogicException::class,fn()=>serialize($reg));
$invokable=new class { public function __invoke(int $x): int { throw new LogicException('expired callback was invoked'); } };
$weak=WeakReference::create($invokable);
$remember=R\remember($invokable); unset($invokable);
check(value($remember)===17,'Lean retained a callback past completion');
gc_collect_cycles(); check($weak->get()===null,'settled owner released PHP callable even while future is held');
rejects(R\TaskIOError::class,fn()=>value(R\use_expired())); R\forget();

$cancel=new DeferredCancellation(); $calls=0;
$self=R\repeat_call('x',static function($s) use (&$calls,$cancel) { ++$calls; $cancel->cancel(); return $s; },$cancel->getCancellation());
rejects(CancelledException::class,fn()=>value($self));
check($calls===1,'cancellation inside the first call suppresses its reply and the second call');
rejects(CancelledException::class,fn()=>R\once(0,$count,$cancel->getCancellation()));
R\reset(); $stop=new DeferredCancellation(); $queued=R\queued($count,$stop->getCancellation());
until(fn()=>R\state()===3); $stop->cancel(); rejects(CancelledException::class,fn()=>value($queued));
R\release(); until(fn()=>R\state()===4);
check($visits===1,'cancelled queued request did not invoke its callback');
R\reset(); $stop=new DeferredCancellation(); $late=R\cancel_late($count,$stop->getCancellation());
until(fn()=>R\state()===1); $stop->cancel(); rejects(CancelledException::class,fn()=>value($late));
R\release(); until(fn()=>R\state()===2);
check($visits===1,'late-created Lean worker observed cancellation');
until(fn()=>live()===0 && fds()===$baseline);
check(live()===0,'settled owners released all native identities and descriptors');

$entered=new Amp\DeferredFuture(); $resume=new Amp\DeferredFuture();
$pending=R\once(8,static function($v) use ($entered,$resume) {
    $entered->complete(); value($resume->getFuture()); return $v;
});
value($entered->getFuture()); check(!$pending->isComplete(),'first owner has a suspended PHP callback');
$trap=new Error('unrecoverable PHP error');
check(rejects(Error::class,fn()=>value(R\once(1,static fn($v)=>throw $trap)))===$trap,'unexpected PHP error retires the runtime and propagates');
rejects(R\LeanBridgeError::class,fn()=>value($pending));
$resume->complete();
rejects(R\LeanBridgeError::class,fn()=>R\plain(0));
until(fn()=>live()===0 && fds()===$baseline);
echo json_encode(['checks'=>$checks,'php'=>PHP_VERSION,'live'=>live(),'fdDelta'=>fds()-$baseline],JSON_THROW_ON_ERROR),"\n";
