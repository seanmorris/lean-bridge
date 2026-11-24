<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use function LeanWorkshop\withHosts;
use function LeanSidekick\withHosts as withPeer;

class AppBox {
    public function __construct(public BigInteger $level) {}
    public function identity(): self {return $this;}
    public function read(): mixed {return $this->level;}
    public static function fromValue(BigInteger $v): self {return new ChildBox($v);}
}
class ChildBox extends AppBox {}
final class HookBox extends AppBox {
    public function __construct(private readonly Closure $fn) {parent::__construct(BigInteger::zero());}
    public function read(): mixed {return ($this->fn)();}
}
function check(bool $ok,string $why): void {if (!$ok) throw new LogicException($why);}
function problem(string $type,callable $fn): Throwable {
    try {$fn();} catch (Throwable $e) {if ($e instanceof $type) return $e;throw $e;}
    throw new RuntimeException('Expected '.$type);
}
$table=['Box'=>AppBox::class];$api=withHosts($table);$same=withHosts($table);$peer=withPeer($table);
problem(TypeError::class,fn()=>withPeer(['Box'=>ChildBox::class]));
$max=BigInteger::of('4294967295');
$a=$api->make_box($max);$b=$peer->from_class(BigInteger::of(7));
$temporary=withHosts($table)->project($a,fn($v)=>$max);
check($temporary->await()->isEqualTo($max),'task anchors a temporary binding');$temporary->awaitCleanup();
$items=0;foreach (withHosts($table)->open_cursor($a) as $v) {check($v===$a,'temporary cursor identity');$items++;break;}
check($items===1,'cursor anchors its temporary binding');unset($v);
$reentrant=$api->project($a,function($v) use($api,$max) {
    problem(LogicException::class,fn()=>$api->close());return $max;
});
check($reentrant->await()->isEqualTo($max),'reject self-close without poisoning the binding');$reentrant->awaitCleanup();
check($a::class===AppBox::class && $b instanceof ChildBox,'PHP constructors');
check($peer->same_box($a)===$a && $api->read($a)->isEqualTo($max),'original cross-package instance');
$peer->set_level($a,BigInteger::of(19));check($api->get_level($a)->isEqualTo(19),'cross-package property');
$job=$api->relay($a,function($a) use($peer,$b,$max) {
    check($peer->project($a,fn($w)=>$w===$a?$max:null)->await()->isEqualTo($max),'nested peer task');
    return $peer->select($max,fn($n)=>$n->isEqualTo($max)?$b:null)->await();
},fn($v)=>$v);
check($job->await()===$b && $job->await()===$b,'two bindings retain subclass identity');$job->awaitCleanup();
$e=new UnexpectedValueException('original PHP exception');$thrower=new HookBox(fn()=>throw $e);
check(problem(UnexpectedValueException::class,fn()=>$api->read(new HookBox(fn()=>$peer->read($thrower))))===$e,'nested member throwable');
check($api->recover_read($thrower)->isEqualTo(99),'Lean catches application error');
problem(TypeError::class,fn()=>$api->recover_read(new HookBox(fn()=>new stdClass())));
check(problem(UnexpectedValueException::class,fn()=>$api->project($a,fn($v)=>throw $e)->await())===$e,'callback throwable');
$v=$peer->either($a)->await();check($v instanceof LeanSidekick\Err && $v->value===$a,'returned Except');
check(problem(LeanWorkshop\CheckedError::class,fn()=>$api->checked($b))->payload===$b,'typed start error');
check(str_contains(problem(LeanWorkshop\IOError::class,fn()=>$api->prepare($a,fn($v)=>$max,true)->await())->payload,'factory refused'),'refused factory');
check(str_contains(problem(LeanWorkshop\TaskIOError::class,fn()=>$api->faulty($a,fn($v)=>$max)->await())->payload,'worker failed'),'worker error');
check(problem(LeanSidekick\OpenCursorStepError::class,function() use($peer,$a) {
    foreach ($peer->open_cursor($a) as $v) check($v===$a,'cursor identity');
})->payload===$a,'typed cursor failure');
$held=new AppBox($max);$weak=WeakReference::create($held);$stream=$api->open_cursor($held);unset($held);
foreach ($stream as $v) {break;}unset($v);gc_collect_cycles();check($weak->get()===null,'early break releases Zend roots');
$pending=$peer->project($a,fn($v)=>$max);
problem(LogicException::class,fn()=>$api->read(new HookBox(fn()=>$pending->await())));
check($pending->await()->isEqualTo($max),'member wait guard preserves peer future');$pending->awaitCleanup();
$taskInput=new AppBox($max);$cursorInput=new AppBox($max);
$taskRoot=WeakReference::create($taskInput);$cursorRoot=WeakReference::create($cursorInput);
$stopped=$api->project($taskInput,fn($v)=>$max);$unpulled=$api->open_cursor($cursorInput);
$survivor=$same->project($a,fn($v)=>$max);unset($taskInput,$cursorInput);
$api->close();$api->close();problem(LogicException::class,fn()=>$api->read($a));
gc_collect_cycles();check($taskRoot->get()===null && $cursorRoot->get()===null,'close releases Zend roots before the consumer observes either delivery');
problem(LeanWorkshop\TaskCancelled::class,fn()=>$stopped->await());$stopped->awaitCleanup();
check($survivor->await()->isEqualTo($max) && $peer->same_box($a)===$a,'closing one binding does not cancel another');$survivor->awaitCleanup();
$peer->close();check($same->read($a)->isEqualTo(19),'other component can close first');$same->close();
$new=withHosts(['Box'=>ChildBox::class]);problem(TypeError::class,fn()=>$new->read($a));
check($new->same_box($b)===$b,'new class binding after last close');$new->close();
echo 'PHP Zend API: installed class bindings, typed errors, scoped cancellation and cursors passed';
