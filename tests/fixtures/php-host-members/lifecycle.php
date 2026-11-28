<?php
declare(strict_types=1);
require $argv[1];

use LeanBridge\NativeHostV2\References;
final class Events {
    public static ?Closure $dispose=null, $read=null;
    public static array $drops=[];
    public static function drop(string $what): void {
        $trace=array_column(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS),'class');
        self::$drops[]=[$what,in_array(FFI::class,$trace,true)];
        if (self::$dispose) (self::$dispose)($what);
    }
}
class Meter {
    public ?Key $shared=null;
    public function __construct(public int $level) {}
    public function read(): int {return Events::$read ? (Events::$read)($this->level) : $this->level;}
    public function identity(): static {return $this;}
    public function child(): Key {return new Key();}
    public function childOf(Meter $parent): Key {return $this->shared ?? $parent->child();}
    public function __destruct() {Events::drop('meter:'.$this->level);}
}
final class Key {
    public function identity(): static {return $this;}
    public function __destruct() {Events::drop('key');}
}
$checks=0;
function check(bool $ok,string $why): void {global $checks; if (!$ok) throw new LogicException($why); ++$checks;}
function failure(Closure $call): Throwable {
    try {$call();} catch (Throwable $e) {return $e;}
    throw new LogicException('Expected a failure');
}
function drops(): array {return array_column(Events::$drops,0);}

$box=['Box'=>Meter::class]; $classes=$box+['Key'=>Key::class];
if ($argv[2]==='peer') { $peer=LeanWorkshopPeer\withHosts($classes); $base=LeanWorkshop\withHosts($box); }
else { $base=LeanWorkshop\withHosts($box); $peer=LeanWorkshopPeer\withHosts($classes); }
$steady=new Meter(1);
$states=[]; $inside=false; $inDestructor=false;
Events::$dispose=static function(string $what) use ($base,$peer,$steady,&$inside,&$states,&$inDestructor): void {
    if ($what==='meter:10') {
        $inDestructor=true;
        try {$states[]=[$inside,$base->identity($steady)===$steady,$peer->transient(9)];}
        finally {$inDestructor=false;}
    } elseif ($what==='meter:9') $states[]=$inDestructor;
};
Events::$read=static function(int $value) use ($peer,&$inside): int {
    if ($value!==1) return $value;
    $inside=true;
    try { $x=$peer->transient(10); check(!in_array('meter:10',drops(),true),'nested peer destroyed a value on outer native stack'); return $x; }
    finally {$inside=false;}
};
check($base->read($steady)===10,'cross-package nested call');
check($states===[[false,true,9],false],'destructor safely reentered both components without recursively draining');
check(drops()===['meter:10','meter:9'],'both nested temporaries released exactly once');

$cleanup=new Error('cleanup'); $primary=new Error('original member');
Events::$dispose=static function(string $what) use ($cleanup): void {throw $cleanup;};
Events::$read=static function(int $value) use ($primary): int {
    if ($value===12 || $value===13) throw $primary;
    return $value;
};
check(failure(fn()=>$peer->transient(11))===$cleanup,'successful call exposes original destructor exception');
check(failure(fn()=>$peer->transient(12))===$primary,'destructor must not replace original member exception');
$mapped=failure(fn()=>$peer->mapped_transient(13));
check($mapped instanceof LeanWorkshopPeer\MappedTransientError && $mapped->payload==='transient failed','declared EIO payload survives failing destructor');
$io=failure(fn()=>$peer->io_fail(14));
check($io instanceof LeanWorkshopPeer\IOError && str_contains($io->payload,'peer IO failed'),'Lean IO error survives failing destructor');
check(drops()===['meter:10','meter:9','meter:11','meter:12','meter:13','meter:14'],'all temporaries finalized once');
check($peer->read($steady)===1 && $base->read($steady)===1,'neither runtime was poisoned by destructor');

Events::$dispose=null; Events::$read=null;
$parent=new Meter(20); $key=$peer->watch($parent);
$other=LeanWorkshopPeer\withHosts($classes);
check($key instanceof Key && $peer->keep_key($key)===$key && $other->keep_key($key)===$key,'both bindings expose the original canonical object');
$resolver=new Meter(21); $parameter=new Meter(22); $resolver->shared=$key;
check($peer->watch_from($resolver,$parameter)===$key,'parameter borrow reuses the same canonical result');
$anchored=References::count();
check($peer->watch_from($resolver,$parameter)===$key && References::count()===$anchored,'duplicate anchor does not add a token');
$weakResolver=WeakReference::create($resolver); $weakParameter=WeakReference::create($parameter);
unset($resolver,$parameter);
check($weakResolver->get()===null && $weakParameter->get() instanceof Meter,'parameter borrow keeps the named argument, not the receiver');
$weakParent=WeakReference::create($parent); $weakKey=WeakReference::create($key);
unset($parent,$key);
$other->close();
check($weakParent->get() instanceof Meter,'borrow retains original receiver');
check($weakKey->get() instanceof Key,'strong key survives the last application reference and a non-final binding close');
check(!in_array('meter:20',drops(),true) && !in_array('key',drops(),true),'neither discharged before close');
$closeStates=[]; $errors=['key'=>new Error('key cleanup'),'meter:20'=>new Error('receiver cleanup'),'meter:22'=>new Error('parameter cleanup')];
Events::$dispose=static function(string $what) use($peer,$base,$steady,$errors,&$closeStates): void {
    $error=failure(fn()=>$peer->read($steady));
    $closeStates[$what]=[$error instanceof LogicException && str_contains($error->getMessage(),'closed'),$base->identity($steady)===$steady];
    throw $errors[$what];
};
$closeError=failure(fn()=>$peer->close());
check($closeError===$errors[array_key_first($closeStates)],'close returns first cleanup failure after commit and drains the rest');
ksort($closeStates);
check($closeStates===['key'=>[true,true],'meter:20'=>[true,true],'meter:22'=>[true,true]],'all finalizers saw committed close and independently usable peer');
check($weakKey->get()===null && $weakParent->get()===null,'strong object and borrowed receiver both released');
$counts=array_count_values(drops());
check($counts['key']===1 && $counts['meter:20']===1,'key and anchor finalized exactly once');
check($weakParameter->get()===null && $counts['meter:22']===1 && $counts['meter:21']===1,'parameter anchor and unanchored receiver finalized exactly once');
check(!in_array(true,array_column(Events::$drops,1),true),'no registry finalizer ran inside an FFI call');
$peer->close(); check($base->identity($steady)===$steady,'repeated close leaves base usable');
Events::$dispose=null; $base->close();
check(References::count()===0,'all private native host tokens released');

// Test-only fault injection into the broker already loaded by the public APIs.
// Retire it from a nested member, then let the outer member catch the error.
$base=LeanWorkshop\withHosts($box); $peer=LeanWorkshopPeer\withHosts($classes);
$owner=new Meter(30); $held=$peer->watch($owner); $heldWeak=WeakReference::create($held);
$ownerWeak=WeakReference::create($owner); unset($held,$owner);
$observer=FFI::cdef('void lean_bridge_native_runtime_retire(void);');
$inner=null; $entered=0;
Events::$read=static function(int $value) use ($peer,$observer,&$inner,&$entered): int {
    ++$entered;
    if ($value===31) { $observer->lean_bridge_native_runtime_retire(); return 31; }
    try { $peer->read(new Meter(31)); } catch (Throwable $e) { $inner=$e; }
    return 99;
};
$retirementChecks=0;
$require=static function(bool $ok,string $why) use (&$retirementChecks): void {
    if (!$ok) throw new LogicException($why);
    ++$retirementChecks;
};
$retired=static fn(?Throwable $e)=>$e instanceof RuntimeException && str_contains($e->getMessage(),'status 10');
$outer=failure(fn()=>$base->read($steady));
$require($retired($inner) && $retired($outer),'caught peer retirement must still fail the outer call');
$require($entered===2,'both nested members ran once');
$require($retired(failure(fn()=>$base->read($steady))) && $retired(failure(fn()=>$peer->read($steady))),'both packages reject further reads');
$require($entered===2,'retired calls never enter the PHP method');
$require($retired(failure(fn()=>LeanWorkshopPeer\withHosts($classes))),'cannot reopen a retired runtime');
Events::$read=null; $base->close(); $peer->close();
$require($heldWeak->get()===null && $ownerWeak->get()===null && References::count()===0,'retirement permits final strong and borrowed cleanup');
echo json_encode(['php'=>PHP_VERSION,'checks'=>$checks,'retirementChecks'=>$retirementChecks,'finalTokens'=>References::count(),'drops'=>drops()],JSON_THROW_ON_ERROR),"\n";
