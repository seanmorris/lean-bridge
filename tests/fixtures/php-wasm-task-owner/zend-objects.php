<?php
declare(strict_types=1);
namespace Probe;
use LeanBridge\Internal\PhpWasmObjectsV1\Domain;
use Probe\Internal\Port;

class Box { public function __construct(public int $n) {} }
class SubBox extends Box {}
class FinalBox extends Box {
    public function __construct(private \Closure $final) {parent::__construct(0);}
    public function __destruct() {($this->final)();}
}
final class BoxTask extends Awaitable {public function await(): Box {return $this->take();}}
final class NumberTask extends Awaitable {public function await(): \Brick\Math\BigInteger {return $this->take();}}
class LeanBridgeError extends \RuntimeException {}
$checks=0;
function check(bool $ok,string $what): void {global $checks;if (!$ok) throw new \LogicException($what);++$checks;}
$kind=(vrzno_shared('objectKind'))();
$domain=new Domain([$kind=>Box::class],\Closure::fromCallable(vrzno_shared('objectMint')));
function work(string $op,Box $input,mixed ...$callbacks): BoxTask {
    global $kind,$domain;
    $args=[$input,...$callbacks]; $types=[$kind];$spec=[];
    foreach ($callbacks as $i=>$f) {$types[]='callback';$spec[]=[$i+1,$kind,$kind];}
    return Port::call($op,$args,$types,'task',BoxTask::class,$op,$kind,null,null,$spec,$domain);
}
$a=new Box(17); $b=new SubBox(30);
$s=$domain->open();$t=$domain->open();
$cap=$s->pin($kind,$a);$other=$t->pin($kind,$a);
check((vrzno_shared('sameCap'))($cap,$other),'Zend wrappers changed JS identity');
try {$t->pin($kind,new \stdClass());throw new \LogicException('Wrong object class admitted');} catch (\TypeError $e) {++$checks;}
$s->close();$s->close();
try {$s->resolve($kind,$cap->key());throw new \RuntimeException('Stale scope resolved');} catch (\LogicException $e) {++$checks;}
check($t->resolve($kind,$cap->key())===$a,'Independent scope invalidated');$t->close();
$visits=0;
$job=work('relay_box',$a,function($v) use($a,$b,&$visits) {
    check($v===$a,'Worker supplied a copy');++$visits;
    $inner=work('peer_map_box',$v,function($nested) use($a,$b) {check($nested===$a,'Second component changed identity');return $b;});
    return $inner->await();
},function($v) use($b,&$visits) {check($v===$b,'Second callback lost replacement');++$visits;++$v->n;return $v;});
check($job->await()===$b && $job->await()===$b && $b->n===31 && $visits===2,'Repeated await or two-hop identity failed');
$job->awaitCleanup();
$max=\Brick\Math\BigInteger::of('4294967295');
$scalar=Port::call('project_box',[$a,fn($v)=>$v===$a?$max:null],[$kind,'callback'],'task',NumberTask::class,
    'project_box','uint32',null,null,[[1,$kind,'uint32']],$domain);
check($scalar->await()->isEqualTo($max),'Zend object to exact UInt32 callback reply failed');$scalar->awaitCleanup();
$nominal=Port::call('peer_select_box',[$max,fn($n)=>$n->isEqualTo($max)?$b:null],['uint32','callback'],'task',BoxTask::class,
    'peer_select_box',$kind,null,null,[[1,'uint32',$kind]],$domain);
check($nominal->await()===$b,'Exact UInt32 to Zend object callback reply failed');$nominal->awaitCleanup();
$bad=new \UnexpectedValueException('PHP callback rejected');
$f=work('map_box',$a,fn($v)=>work('peer_map_box',$v,fn($w)=>throw $bad)->await());
try {$f->await();throw new \LogicException('Lost expected exception');} catch (\UnexpectedValueException $e) {check($e===$bad,'PHP exception copied');}
$f->awaitCleanup();
$f=work('map_box',$a,fn($v)=>new \stdClass());
try {$f->await();throw new \LogicException('Invalid callback result delivered');} catch (\TypeError $e) {++$checks;}
$f->awaitCleanup();
$pending=null;
$pending=work('map_box',$a,function($v) use(&$pending) {check($pending->cancel(),'Cancellation lost');return new \stdClass();});
try {$pending->await();throw new \LogicException('Cancelled callback delivered');} catch (TaskCancelled $e) {++$checks;}
$pending->awaitCleanup();
check(vrzno_await((vrzno_shared('closePeer'))())===true,'Peer did not release its binding');
$held=new Box(55); $weak=\WeakReference::create($held); $delivered=new Box(66);
$last=work('map_box',$held,fn($v)=>$delivered);unset($held);gc_collect_cycles();
check($weak->get()!==null,'Input released while its worker could still call back');
check($last->await()===$delivered,'Wrong final object');gc_collect_cycles();
check($weak->get()===null,'Completed owner retained its input');$last->awaitCleanup();
$cleanup=new \DomainException('Zend finalizer failed');
$primary=new \UnexpectedValueException('Body failed first');
$seen=[];
foreach ([false,true] as $fail) {
    $temp=new FinalBox(function() use(&$seen,$a,$b,$cleanup) {
        $seen[]=work('map_box',$a,fn($v)=>$b)->await();throw $cleanup;
    });
    $last=work('map_box',$temp,$fail?fn($v)=>throw $primary:fn($v)=>$b);
    unset($temp);
    for ($i=0;$i<2;++$i) {
        try {$last->await();throw new \LogicException('Lost expected failure');}
        catch (\Throwable $e) {check($e===($fail?$primary:$cleanup),'Wrong failure after object cleanup');}
    }
    $last->awaitCleanup();
}
check($seen===[$b,$b],'Finalizers did not reenter exactly once');
$output=null;$input=new FinalBox(fn()=>throw $cleanup);
$undelivered=work('map_box',$input,function($v) use(&$output) {
    $result=new Box(71);$output=\WeakReference::create($result);return $result;
});
unset($input);
try {$undelivered->await();throw new \LogicException('Expected finalizer failure');}
catch (\DomainException $e) {check($e===$cleanup,'Wrong cleanup error on replaced result');}
gc_collect_cycles();check($output!==null && $output->get()===null,'Rejected awaitable retained its undeliverable result');
$undelivered->awaitCleanup();
echo json_encode(['php'=>PHP_VERSION,'checks'=>$checks],JSON_THROW_ON_ERROR);
