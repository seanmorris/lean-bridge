<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use function LeanWorkshop\withHosts;
final class Box {
    public function __construct(public BigInteger $level, private ?Closure $onRead=null) {}
    public static function fromValue(BigInteger $v): self {return new self($v);}
    public function identity(): self {return $this;}
    public function read(): mixed {return $this->onRead ? ($this->onRead)() : $this->level;}
}
function check(bool $ok,string $label): void {if (!$ok) throw new LogicException($label);}
function problem(string $type,callable $fn): Throwable {
    try {$fn();} catch (Throwable $e) {if ($e instanceof $type) return $e;throw $e;}
    throw new RuntimeException('Expected '.$type);
}
$classes=['Box'=>Box::class];$a=withHosts($classes);$b=LeanSidekick\withHosts($classes);
check(!class_exists('LeanWorkshop\\Awaitable',false),'sync package must not expose tasks');
$one=BigInteger::one();$original=$a->make_box(BigInteger::of(41));$other=$b->from_class($one);
$f=$a->remember($original);$reader=$a->reader($original);$alias=$b->identity_reader($other);
check($f($other)===$original && $alias($one)===$other,'independent packages return their own object');
$b->set_level($original,BigInteger::of(42));check($reader($one)->isEqualTo(43),'shared mutable PHP instance');
$err=new UnexpectedValueException('original');$bad=new Box($one,fn()=>throw $err);
check(problem(UnexpectedValueException::class,fn()=>$a->remember($bad))===$err,'factory exception identity');
check(problem(UnexpectedValueException::class,fn()=>$f($bad))===$err,'invocation exception identity');
problem(TypeError::class,fn()=>$f(new stdClass()));
check($a->recover_read($bad)->isEqualTo(99),'Lean can catch an application error');
problem(TypeError::class,fn()=>$a->recover_read(new Box($one,fn()=>new stdClass())));
check($a->recover_read($other)->isEqualTo(1),'boundary rejection did not poison the runtime');
check($a->either($original)->value===$original,'returned Except remains a value');
check(problem(LeanWorkshop\CheckedError::class,fn()=>$a->checked($original))->payload===$original,'EIO carries its owned error');
$weak=WeakReference::create($original);unset($original);gc_collect_cycles();check($weak->get()!==null,'captured original retained');
$hook=new Box($one,function() use ($a,$f,$reader,$other,$one) {
    problem(LogicException::class,fn()=>$a->close());
    $f->close();problem(LogicException::class,fn()=>$f($other));
    check($reader($one)->isEqualTo(43),'sibling reentrant invocation');return $one;
});
check($f($hook)===$weak->get(),'active invocation finishes on close');$f->close();$reader->close();
gc_collect_cycles();check($weak->get()===null,'last capture released');
$stale=$a->remember($other);$a->close();problem(LogicException::class,fn()=>$stale($other));
check($alias($one)===$other,'closing the first binding does not close its peer');$alias->close();$b->close();

// A retained callable must not keep its binding alive. Use the same component
// twice so the peer cannot survive merely because its code lives in a different module.
$left=withHosts($classes);$right=withHosts($classes);
$held=new Box($one);$watch=WeakReference::create($held);$escaped=$left->remember($held);
$survivor=$right->remember($other);unset($held,$left);gc_collect_cycles();
check($watch->get()===null,'abandoned binding released its capture');
problem(LogicException::class,fn()=>$escaped($other));
check($survivor(new Box($one))===$other,'another binding of the same component survived');
$escaped->close();$survivor->close();$right->close();
echo 'Standalone Zend: synchronous identity, failures, reentry and cleanup passed';
