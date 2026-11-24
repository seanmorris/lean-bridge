<?php
declare(strict_types=1);
use Brick\Math\BigInteger;

final class FaultBox {
    public function __construct(public BigInteger $level) {}
    public function identity(): self {return $this;}
    public function read(): mixed {return $this->level;}
    public static function fromValue(BigInteger $value): self {return new self($value);}
}
function refused(string $type,Closure $call): Throwable {
    try {$call();} catch (Throwable $e) {if ($e instanceof $type) return $e;throw $e;}
    throw new LogicException('Expected '.$type);
}
$classes=['Box'=>FaultBox::class];$api=LeanWorkshop\withHosts($classes);$peer=LeanSidekick\withHosts($classes);
$box=$api->make_box(BigInteger::of(3));$pending=null;$weak=null;$fatal=new Error('PHP engine trap');
$origin=$api->project($box,function($v) use($peer,&$pending,&$weak,$fatal) {
    $held=new FaultBox($v->level);$weak=WeakReference::create($held);
    $pending=$peer->project($held,fn($x)=>$x->level);
    throw $fatal;
});
if (refused(Error::class,fn()=>$origin->await())!==$fatal) throw new LogicException('Replaced original PHP trap');
refused(LeanSidekick\LeanBridgeError::class,fn()=>$peer->read($box));
refused(LeanSidekick\LeanBridgeError::class,fn()=>$peer->close());
gc_collect_cycles();if ($weak->get()!==null) throw new LogicException('Peer retained its input after faulted close');
refused(LeanSidekick\LeanBridgeError::class,fn()=>$pending->await());
refused(LeanWorkshop\LeanBridgeError::class,fn()=>$origin->awaitCleanup());
refused(LeanWorkshop\LeanBridgeError::class,fn()=>$api->close());
echo 'callback trap preserved; peer refused; new work refused';
