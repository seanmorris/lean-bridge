<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\{CancelledException,DeferredCancellation,DeferredFuture,Future};
use LeanBridge\NativeHostV2\References;
use LeanWorkshop\{CheckedError,Err,IOError,OpenBrokenStepError,OpenCursorStepError,PullStream,RetainedCallback,TaskIOError};
use function LeanWorkshop\withHosts;

class Box {
    public function __construct(public int $level) {}
    public function read(): int { return $this->level; }
    public function identity(): self { return $this; }
}
final class WatchedBox extends Box {
    public function __construct(private readonly Closure $drop) {parent::__construct(51);}
    public function __destruct() {($this->drop)();}
}
$checks=0;
function check(bool $b,string $why): void { global $checks; if (!$b) throw new LogicException($why); ++$checks; }
function failure(string $cls,Closure $body): Throwable {
    try { $body(); } catch (Throwable $e) {
        if (!$e instanceof $cls) throw new RuntimeException('Expected '.$cls.', got '.get_class($e).': '.$e->getMessage(),0,$e);
        check(true,'expected error'); return $e;
    }
    throw new LogicException('Expected '.$cls.' but call succeeded');
}
$bind=fn()=>withHosts(['Box'=>Box::class]);
$api=$bind(); $peer=$bind();
$a=new Box(11); $b=new Box(37); $seen=[];
$f=$api->relay($a,function(Box $x) use ($api,$peer,$a,$b,&$seen) {
    check($x===$a && $peer->read($x)===11,'Wrong input on first callback'); $seen[]=1;
    check($api->project($x,fn(Box $v)=>$v->read()+1)->await()===12,'Nested await changed the result');
    return $b;
},function(Box $x) use ($a,$b,&$seen) {
    check($x===$b,'Wrong input on second callback'); $seen[]=2; return $a;
});
check($f instanceof Future && $f->await()===$a && $seen===[1,2],'Relay did not preserve order and identity');
check($api->select(9,function(int $n) use($b) {check($n===9,'Scalar callback argument'); return $b;})->await()===$b,'Scalar-to-object reply');
$either=$api->either($a)->await(); check($either instanceof Err && $either->value===$a,'Returned Except was not a value');
$err=failure(CheckedError::class,fn()=>$api->checked($a)->await());
check($err->declaration==='Workshop.checked' && $err->payload===$a,'Factory EIO lost typed payload');
$err=failure(IOError::class,fn()=>$api->prepare($a,fn($x)=>1,true)->await());
check(str_contains($err->payload,'factory refused'),'Factory IO error misclassified');
$err=failure(TaskIOError::class,fn()=>$api->faulty($a,fn($x)=>1)->await());
check(str_contains($err->payload,'worker failed'),'Terminal IO error misclassified');
$original=new DomainException('owner failed');
check(failure(DomainException::class,fn()=>$api->project($a,fn($x)=>throw $original)->await())===$original,'Lost PHP exception identity');
$closed=new RetainedCallback(fn(Box $x)=>$x); $closed->close();
failure(LeanWorkshop\CallbackClosed::class,fn()=>$api->relay($a,$closed,fn($x)=>$x)->await());
failure(TypeError::class,fn()=>$api->project(new stdClass(),fn($v)=>1));
failure(TypeError::class,fn()=>$api->select(1,fn($v)=>new stdClass())->await());
check($api->read($a)===11,'Input validation retired a healthy binding');
$cursor=$api->open_cursor($a); check($cursor instanceof PullStream,'Expected a single-pass iterable');
$values=[]; $err=failure(OpenCursorStepError::class,function() use ($cursor,&$values) {
    foreach ($cursor as $v) $values[]=$v;
});
check($values===[$a] && $err->payload===$a && $err->declaration==='Workshop.pull','Lost cursor yield, error ownership or phase');
$err=failure(OpenBrokenStepError::class,function() use ($api,$a) {foreach ($api->open_broken($a) as $_) throw new LogicException('Unexpected yield');});
check(str_contains($err->payload,'cursor failed') && $err->declaration==='Workshop.pullBroken','Cursor IO failure lost');
$early=$api->open_cursor($b); foreach ($early as $v) {check($v===$b,'Invalid early yield');break;}
$early->close();
$watched=new Box(53); $weak=WeakReference::create($watched);
$heldOnlyByLean=$api->open_cursor($watched); unset($watched); gc_collect_cycles();
check($weak->get()!==null,'Pending cursor did not retain the object');
$heldOnlyByLean->close(); gc_collect_cycles();
check($weak->get()===null,'Cursor close retained a weak-canonical PHP object until a later call');
$cleanup=new DomainException('cleanup failed'); $drained=false;
$watched=new WatchedBox(function() use($api,$a,$cleanup,&$drained) {
    $drained=$api->read($a)===11; throw $cleanup;
});
$cleaning=$api->open_cursor($watched); unset($watched);
check(failure(DomainException::class,fn()=>$cleaning->close())===$cleanup && $drained,'Cleanup could not reenter or lost its exception');
$cleanCancel=new DeferredCancellation();$cleaned=false;
$watched=new WatchedBox(function() use(&$cleaned) {$cleaned=true;throw new DomainException('secondary cleanup');});
$cleaning=$api->open_cursor($watched,$cleanCancel->getCancellation());unset($watched);
$cleanCancel->cancel();Amp\delay(0.002);
failure(CancelledException::class,function() use($cleaning) {foreach ($cleaning as $_) {}});
check($cleaned,'Cancellation did not drain the last cursor root');
$cancel=new DeferredCancellation(); $late=0;
$cancelled=$api->relay($a,function(Box $v) use ($cancel,&$late) {
    $cancel->cancel(); Amp\delay(0.001); ++$late; return $v;
},function($x) {throw new LogicException('Late reply invoked the second callback');},$cancel->getCancellation());
failure(CancelledException::class,fn()=>$cancelled->await());
Amp\delay(0.01); check($late===1 && $peer->read($b)===37,'Cancelled reply interfered with the other binding');
// Closing a binding while its callback is on another fiber must settle every
// pending result once, detach its cursor, and leave the independent binding usable.
$entered=new DeferredFuture(); $resume=new DeferredFuture();
$pending=$api->project($b,function($v) use($entered,$resume) {
    $entered->complete(); $resume->getFuture()->await(); return $v->level;
});
$entered->getFuture()->await(); $held=$api->open_cursor($a); $api->close(); $api->close();
failure(LogicException::class,fn()=>$pending->await());
failure(LogicException::class,function() use($held) {foreach ($held as $_) {}});
$resume->complete(); Amp\delay(0.005);
failure(LogicException::class,fn()=>$api->read($a));
check($peer->project($b,fn($x)=>$x->level)->await()===37,'Closing one binding disabled its peer');
$fork=function_exists('pcntl_fork');
if ($fork) {
    $pid=pcntl_fork();
    if ($pid===0) {try {$peer->either($a)->await();exit(42);} catch (RuntimeException) {exit(0);}}
    if ($pid<0) throw new RuntimeException('fork failed');
    pcntl_waitpid($pid,$status);check(pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'Child admitted an inherited future');
}
$peer->close();
check(References::count()===0,'Leaked PHP tokens after scheduler shutdown');
$retiring=$bind(); $trap=new Error('unexpected application fault');
check(failure(Error::class,fn()=>$retiring->project($a,fn($v)=>throw $trap)->await())===$trap,'Unexpected trap did not escape intact');
failure(RuntimeException::class,fn()=>$retiring->read($a));
$retiring->close();
check(References::count()===0,'Retired native runtime leaked PHP tokens during binding close');
echo json_encode(['php'=>PHP_VERSION,'fork'=>$fork,'checks'=>$checks,'livePhpReferences'=>References::count()],JSON_THROW_ON_ERROR)."\n";
