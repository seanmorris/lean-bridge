<?php
declare(strict_types=1);
require $argv[1];

use function LeanWorkshop\withHosts;
use LeanBridge\NativeHostV2\References;

class Meter {
    public ?Closure $onRead=null;
    public function __construct(public int $level) {}
    public function read(): int { if ($this->onRead) ($this->onRead)(); return $this->level; }
    public function identity(): self { return $this; }
}
final class WatchedMeter extends Meter {
    public function __construct(private readonly Throwable $onDrop) { parent::__construct(8); }
    public function __destruct() { throw $this->onDrop; }
}
function verify(bool $condition,string $message): void {
    if (!$condition) throw new LogicException($message);
}
function rejection(Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { return $e; }
    throw new LogicException('Expected a failure');
}
function captured($binding,int $number): array {
    $meter=$binding->make($number);
    return [$binding->reader($meter),WeakReference::create($meter)];
}

$a=withHosts(['Box'=>Meter::class]); $b=withHosts(['Box'=>Meter::class]);
[$reader,$capture]=captured($a,40); [$sibling,$other]=captured($b,17);
if (($argv[2]??'')==='retire') {
    // Test-only fault injector: retire the already-loaded broker during the
    // call. No pointer, FFI import or observer is part of the public client.
    $native=FFI::cdef('void lean_bridge_native_runtime_retire(void);');
    $capture->get()->onRead=static fn()=>$native->lean_bridge_native_runtime_retire();
    foreach ([$reader,$sibling] as $f) {
        $error=rejection(fn()=>$f(0));
        verify($error instanceof RuntimeException && str_contains($error->getMessage(),'status 10'),'runtime accepted a retired call');
    }
    $reader->close(); $reader->close(); gc_collect_cycles();
    verify($capture->get()===null && $other->get()!==null,'retired cleanup crossed binding ownership');
    $b->close(); $a->close(); gc_collect_cycles();
    verify($other->get()===null && References::count()===0,'retired host table leaked');
    echo "retired function captures released independently\n";
    return;
}

$x=$a->make(3); $y=$a->make(12); $remember=$a->remember($x);
verify($remember($y)===$x && $reader(2)===42,'returned the wrong application object or incorrect value');
$identity=$a->identity_reader($x);$x->level=8;
verify($identity(0)===$x && $identity(1)->level===8,'round-trip through captured PHP member copied the object');
$identity->close();
verify(rejection(fn()=>clone $remember) instanceof Error,'cloned a native lease');
verify(rejection(fn()=>serialize($remember)) instanceof Exception,'serialized a native lease');
verify(rejection(fn()=>$remember(new stdClass())) instanceof TypeError,'wrong nominal argument was accepted');
$original=new DomainException('from PHP');
$y->onRead=static fn()=>throw $original;
verify(rejection(fn()=>$a->remember($y))===$original,'factory replaced the original Throwable');
verify(rejection(fn()=>$remember($y))===$original,'invocation replaced the original Throwable');
$y->onRead=static fn()=>Fiber::suspend('in returned function');
$victim=withHosts(['Box'=>Meter::class]); [$revoke,$held]=captured($victim,6);
[$garbage,$gone]=captured($b,9);
$fiber=new Fiber(fn()=>$remember($y));
verify($fiber->start()==='in returned function','returned function never entered PHP member');
unset($garbage,$victim); gc_collect_cycles();
verify($gone->get()!==null && $held->get()!==null,'foreign finalizer entered a suspended native frame');
foreach ([fn()=>$reader(1),fn()=>$reader->close()] as $foreign) {
    verify(rejection($foreign) instanceof LogicException,'suspended frame admitted a foreign fiber');
}
$fiber->resume(); verify($fiber->getReturn()===$x && $reader(1)===41,'fiber rejection mutated a live function');
gc_collect_cycles();verify($gone->get()===null && $held->get()===null,'abandoned captures not released on owner resume');
verify(rejection(fn()=>$revoke(0)) instanceof LogicException,'queued owner close left a stale function');$revoke->close();
if (function_exists('pcntl_fork')) {
    $child=pcntl_fork(); verify($child!==-1,'fork failed');
    if ($child===0) {
        $call=rejection(fn()=>$reader(1));$drop=rejection(fn()=>$reader->close());
        exit($call instanceof LogicException && $drop instanceof LogicException ? 0 : 42);
    }
    pcntl_waitpid($child,$status);
    verify(pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'inherited function survived fork');
}
$y->onRead=static function() use ($remember,$reader,$y,$a) {
    verify($reader(5)===45,'nested call read the wrong capture');
    $remember->close();
    verify(rejection(fn()=>$remember($y)) instanceof LogicException,'self-closed function accepted another call');
    verify(rejection(fn()=>$a->close()) instanceof RuntimeException,'active binding was closed');
};
verify($remember($y)===$x,'in-flight call did not finish after self-close'); $y->onRead=null;
// A PHP destructor can throw after the factory has already returned a native
// ticket. The exception wins, but that unpublished function must not leak.
$onDrop=new DomainException('after successful factory');$toDrop=$a->reader(new WatchedMeter($onDrop));
$unpublished=$a->make(92);$lost=WeakReference::create($unpublished);
$unpublished->onRead=static fn()=>$toDrop->close();
verify(rejection(fn()=>$a->remember($unpublished))===$onDrop,'cleanup replaced the original exception');
unset($unpublished);gc_collect_cycles();verify($lost->get()===null,'unpublished factory ticket retained its capture');
[$unused,$released]=captured($a,9); unset($unused); gc_collect_cycles();
verify($released->get()===null && $capture->get()!==null,'abandoned function retained its capture');
$temporary=withHosts(['Box'=>Meter::class]); [$orphan,$orphaned]=captured($temporary,8);
unset($temporary); gc_collect_cycles();
verify($orphaned->get()===null && rejection(fn()=>$orphan(0)) instanceof LogicException,'function kept an abandoned binding alive');
$orphan->close();
$active=withHosts(['Box'=>Meter::class]);$originalOwner=WeakReference::create($active);
$v=$active->make(27);$heldCall=WeakReference::create($v);$inFlight=$active->remember($v);unset($v);
$y->onRead=static function() use (&$active) { $active=null;gc_collect_cycles(); };
$answer=$inFlight($y);verify($answer===$heldCall->get(),'abandoning an active binding lost the result');
unset($answer);$y->onRead=null;gc_collect_cycles();
verify($originalOwner->get()===null && $heldCall->get()===null,'finished call retained an abandoned owner');
verify(rejection(fn()=>$inFlight($y)) instanceof LogicException,'finished call reattached a stale function');$inFlight->close();
$a->close(); gc_collect_cycles(); $reopened=withHosts(['Box'=>Meter::class]);
verify($capture->get()===null && $sibling(2)===19,'binding close revoked its sibling');
verify(rejection(fn()=>$reader(2)) instanceof LogicException,'stale function attached to a reopened binding');
$reader->close(); $sibling->close(); $reopened->close(); $b->close();
verify($other->get()===null && References::count()===0,'host table did not return to baseline');
echo "PHP function identity, original exception, self-close and teardown passed\n";
