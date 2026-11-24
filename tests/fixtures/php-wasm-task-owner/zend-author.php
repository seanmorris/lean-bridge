<?php
declare(strict_types=1);
namespace Probe;
use Brick\Math\BigInteger;
use LeanBridge\Internal\PhpWasmObjectsV1\Domain;
use Probe\Internal\Port;

class Box {
    public mixed $level;
    public int $n;
    public function __construct(int|BigInteger $n) {$this->level=BigInteger::of($n);$this->n=is_int($n)?$n:0;}
    public static function fromValue(BigInteger $v): Box {return new SubBox($v);}
    public function read(): mixed {return $this->level;}
    public function identity(): Box {return $this;}
}
class SubBox extends Box {}
class HookBox extends Box {
    public function __construct(private readonly \Closure $fn) {parent::__construct(1);}
    public function read(): mixed {return ($this->fn)();}
}
class LeanBridgeError extends \RuntimeException {}
final class Ok {public function __construct(public mixed $value) {}}
final class Err {public function __construct(public mixed $value) {}}
class Failure extends \RuntimeException {public function __construct(public string $origin,public mixed $payload) {parent::__construct($origin);}}
final class StartFailure extends Failure {}
final class WorkerFailure extends Failure {}
final class Job extends Awaitable {public function await(): mixed {return $this->take();}}
$kind=(vrzno_shared('kind'))();$domain=new Domain([$kind=>Box::class],\Closure::fromCallable(vrzno_shared('mint')));
$methods=array_column(json_decode((vrzno_shared('methods'))(),true,flags: JSON_THROW_ON_ERROR),null,'name');
$members=new Internal\ZendMembers(json_decode((vrzno_shared('model'))(),true,flags: JSON_THROW_ON_ERROR),['Box'=>Box::class]);
function work(string $name,mixed ...$args): mixed {
    global $methods,$domain,$members;
    $m=$methods[$name];$op=$m['declaration'];
    $start=$m['startId']?[StartFailure::class,$op,$m['error']]:null;
    $terminal=$m['terminalId']?[WorkerFailure::class,$op,$m['terminal']]:null;
    return Port::call($name,$args,$m['args'],$m['delivery'],$m['delivery']==='task'?Job::class:PullStream::class,
        $op,$m['result'],$start,$terminal,$m['callbacks']??[],$domain,$m['hostPhases']['call']?$members:null);
}
$checks=[];
function check(bool $ok,string $why): void {global $checks;if (!$ok) throw new \LogicException($why);$checks[]=$why;}
$a=new Box(8);$b=new SubBox(9);$max=BigInteger::of('4294967295');
check(work('read',$a)->isEqualTo(8),'immediate member returns a PHP UInt32');
$made=work('make_box',$max);check($made::class===Box::class && $made->level->isEqualTo($max),'constructor runs in Zend with exact UInt32');
$sub=work('from_class',$max);check($sub instanceof SubBox,'static member returns real PHP subclass');
check(work('get_level',$made)->isEqualTo($max),'read declared PHP property');
check(work('set_level',$made,BigInteger::of(47))===null && $made->level->isEqualTo(47),'write declared PHP property');
check(work('same_box',$sub)===$sub,'receiver-anchored method returns the original PHP instance');
$visits=0;$nested=new HookBox(function() use($a,&$visits) {++$visits;return work('read',$a)->plus(1);});
check(work('read',$nested)->isEqualTo(9) && $visits===1,'PHP override makes nested immediate Lean call');
$marker=new \UnexpectedValueException('member threw');
$badBox=new HookBox(fn()=>throw $marker);
check(work('recover_read',$badBox)->isEqualTo(99),'Lean may catch a declared PHP member failure');
try {work('recover_read',new HookBox(fn()=>new \stdClass()));throw new \LogicException('Lean masked invalid member result');}
catch (\TypeError $e) {check(true,'Lean cannot swallow a boundary validation error');}
try {work('read',$badBox);throw new \LogicException('missing member error');}
catch (\UnexpectedValueException $e) {check($e===$marker,'immediate member rethrows original PHP object');}
try {work('read',new HookBox(fn()=>work('read',$badBox)));throw new \LogicException('missing nested error');}
catch (\UnexpectedValueException $e) {check($e===$marker,'nested member frames preserve original exception');}
try {work('read',new HookBox(fn()=>new \stdClass()));throw new \LogicException('invalid member return succeeded');}
catch (\TypeError $e) {check(true,'invalid member result is a PHP validation error');}
check(work('read',$a)->isEqualTo(8),'valid call after member validation or application error');
$pending=work('project',$a,fn($v)=>$max);$stream=work('open_cursor',$a);
foreach (['await'=>fn()=>$pending->await(),'drain'=>fn()=>$pending->awaitCleanup(),
          'cursor close'=>fn()=>$stream->close(),'cursor pull'=>fn()=>$stream->getIterator()->rewind()] as $label=>$wait) {
    try {work('read',new HookBox($wait));throw new \RuntimeException('suspended a synchronous PHP member');}
    catch (\LogicException $e) {check(str_contains($e->getMessage(),'Cannot suspend'),'reject member wait: '.$label);}
}
check($pending->await()->isEqualTo($max),'rejected member wait leaves task usable');$pending->awaitCleanup();
check(work('read',new HookBox(fn()=>$pending->await()))->isEqualTo($max),'cached value can be read without suspending');
$iterator=$stream->getIterator();$iterator->rewind();check($iterator->current()===$a,'rejected initial pull leaves cursor usable');
try {work('read',new HookBox(fn()=>$iterator->next()));throw new \RuntimeException('resumed a cursor on a synchronous stack');}
catch (\LogicException $e) {check(str_contains($e->getMessage(),'Cannot suspend'),'resumed cursor closes without blocking the member');}
$stream->close();
$job=work('relay',$a,function($v) use($a,$b,$max) {
    check($v===$a,'incoming Zend identity');
    $num=work('project',$v,fn($w)=>$w===$a?$max:null);
    check($num->await()->isEqualTo($max),'reentrant callback with exact UInt32');$num->awaitCleanup();
    return work('select',$max,fn($n)=>$n->isEqualTo($max)?$b:null)->await();
},function($v) use($b) {check($v===$b,'replacement keeps subclass');++$v->n;return $v;});
check($job->await()===$b && $job->await()===$b && $b->n===10,'repeat await shares result');$job->awaitCleanup();
$value=work('either',$a)->await();check($value instanceof Err && $value->value===$a,'returned Except.error is data');
try {work('checked',$a);throw new \LogicException('factory returned an awaitable');}
catch (StartFailure $e) {check($e->origin==='Workshop.checked' && $e->payload===$a,'typed EIO fails before delivery');}
// A callback-capable factory runs off the owner. Its failure arrives through await(),
// but retains the factory channel; it must not become a worker or PHP callback error.
$started=false;$refused=work('prepare',$a,function($v) use(&$started,$max) {$started=true;return $max;},true);
check($refused instanceof Job,'callback-capable factory does not block Zend');
try {$refused->await();throw new \LogicException('refused factory succeeded');}
catch (StartFailure $e) {check(!$started && $e->origin==='Workshop.prepare' && str_contains($e->payload,'factory refused'),'IO factory error');}
$refused->awaitCleanup();
$err=new \UnexpectedValueException('original nested callback error');
$job=work('faulty',$a,fn($v)=>work('project',$v,fn($v)=>throw $err)->await());
for ($i=0;$i<2;++$i) {
    try {$job->await();throw new \LogicException('lost callback failure');}
    catch (\UnexpectedValueException $e) {check($err===$e,'nested callback exception identity');}
}
$job->awaitCleanup();$job=work('faulty',$a,fn($v)=>$max);
try {$job->await();throw new \LogicException('worker succeeded');}
catch (WorkerFailure $e) {check($e->origin==='Workshop.faulty' && str_contains($e->payload,'worker failed'),'worker IO error');}
$job->awaitCleanup();
$cursor=work('open_cursor',$a);$visits=0;
try {foreach ($cursor as $item) {check($item===$a && ++$visits===1,'one Zend object yielded');}throw new \LogicException('missing cursor failure');}
catch (WorkerFailure $e) {check($e->origin==='Workshop.openCursor' && $e->payload===$a,'typed cursor failure');}
$cursor->close();
try {foreach(work('open_broken',$a) as $unused) {} throw new \LogicException('missing cursor IO error');}
catch (WorkerFailure $e) {check(str_contains($e->payload,'cursor failed'),'cursor IO error');}
foreach (['break','abandon'] as $mode) {
    $box=new Box(10);$weak=\WeakReference::create($box);$stream=work('open_cursor',$box);unset($box);
    check($weak->get()!==null,'live iterator roots input: '.$mode);
    if ($mode==='break') {foreach ($stream as $v) {break;}unset($v);} else {unset($stream);}
    gc_collect_cycles();check($weak->get()===null,'released iterator root: '.$mode);
}
try {work('open_cursor',new \stdClass());throw new \LogicException('admitted wrong class');}
catch (\TypeError $e) {check(true,'reject invalid argument before entry');}
$cancel=null;$cancel=work('project',$a,function($v) use(&$cancel,$max) {check($cancel->cancel(),'cancel during callback');return $max;});
try {$cancel->await();throw new \LogicException('late reply won');}
catch (TaskCancelled $e) {check(true,'late reply ignored');}$cancel->awaitCleanup();
echo json_encode(['php'=>PHP_VERSION,'checks'=>$checks],JSON_THROW_ON_ERROR);
