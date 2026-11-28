<?php
declare(strict_types=1);
require $argv[1];

use LeanBridge\NativeHostV2\References;

class Meter {
    public static ?Closure $construct=null, $reading=null;
    public function __construct(public int $level) {
        if (self::$construct) (self::$construct)($level);
    }
    public function read(): int { return self::$reading ? (self::$reading)($this->level) : $this->level; }
    public function identity(): static { return $this; }
    public function child(): Key { return new Key(); }
    public function childOf(Meter $parent): Key { return $parent->child(); }
}
class Key { public function identity(): static { return $this; } }
function check(bool $ok,string $label): void { if (!$ok) throw new LogicException($label); }
function failure(Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { return $e; }
    throw new LogicException('Expected failure');
}
$classes=['Box'=>Meter::class,'Key'=>Key::class];
$order=$argv[2]; check(in_array($order,['peer','workshop'],true),'unknown order');
if ($order==='peer') $peer=LeanWorkshopPeer\withHosts($classes);
$base=LeanWorkshop\withHosts(['Box'=>Meter::class]);
if ($order==='workshop') $peer=LeanWorkshopPeer\withHosts($classes);
$meter=new Meter(23);
$validation=failure(fn()=>$peer->transient(-1));
check($validation instanceof ValueError || $validation instanceof TypeError,'invalid argument did not fail at the boundary');
$original=new DomainException('ordinary PHP error');
Meter::$reading=static function(int $level) use($original,$peer): int {
    if ($level===23) return $peer->transient(7);
    throw $original;
};
check(failure(fn()=>$base->read($meter))===$original,'lost original nested exception');
$mapped=failure(fn()=>$peer->mapped_transient(7));
check($mapped instanceof LeanWorkshopPeer\MappedTransientError && $mapped->payload==='transient failed','lost mapped failure');
Meter::$reading=null;
$io=failure(fn()=>$peer->io_fail(7));
check($io instanceof LeanWorkshopPeer\IOError && str_contains($io->payload,'peer IO failed'),'lost IO failure');
check($base->read($meter)===23,'recoverable faults retired the base');

// Simulate exhaustion at the exact allocation that publishes a newly created
// PHP object to Lean. No tokens are issued at the ceiling. Restore the counter
// before trying either package again: a second allocation failure cannot
// masquerade as retirement. The probe does not call the runtime's retire API.
$next=new ReflectionProperty(References::class,'next');
$saved=null; $inner=null; $constructs=0; $reads=0;
Meter::$construct=static function(int $value) use($next,&$saved,&$constructs): void {
    if ($value!==73) return;
    ++$constructs; $saved=$next->getValue(); $next->setValue(null, PHP_INT_MAX);
};
Meter::$reading=static function(int $level) use($peer,$next,&$saved,&$inner,&$reads): int {
    ++$reads;
    if ($level!==23) throw new LogicException('unpublished object reached read');
    try { $inner=failure(fn()=>$peer->mapped_transient(73)); }
    finally { if ($saved!==null) $next->setValue(null,$saved); }
    return 41; // The outer PHP method caught its peer's failure.
};
$outer=failure(fn()=>$base->read($meter));
check($inner instanceof OverflowException && $inner->getMessage()==='Native host references exhausted','wrong exhaustion channel');
check($saved!==null && $next->getValue()===$saved,'limit was not restored');
$retired=static fn(Throwable $e): bool=>$e instanceof RuntimeException && str_contains($e->getMessage(),'status 10');
check($retired($outer) && $reads===1 && $constructs===1,'outer call survived caught terminal fault');
check($retired(failure(fn()=>$base->read($meter))) && $retired(failure(fn()=>$peer->read($meter))),'peer or base remained usable');
check($reads===1 && $constructs===1,'retired call entered a host method');
Meter::$construct=Meter::$reading=null;
$base->close(); $peer->close(); check(References::count()===0,'host token leaked');
echo json_encode(['php'=>PHP_VERSION,'order'=>$order,'original'=>true,'mapped'=>true,'replacementIO'=>true,
    'trigger'=>'reference-token exhaustion','afterReset'=>'both unavailable','reads'=>$reads,'constructs'=>$constructs,
    'finalTokens'=>References::count()],JSON_THROW_ON_ERROR),"\n";
