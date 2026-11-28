<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

use Amp\{CancelledException, DeferredCancellation, Future, TimeoutCancellation};
use LeanCounter as C;
use LeanDepot as D;
use LeanForeignPeer as Foreign;
use Revolt\EventLoop;

$checks=0;
function check(bool $ok,string $what): void {
    global $checks;
    if (!$ok) throw new RuntimeException($what);
    ++$checks;
}
function rejects(string $class,Closure $f): Throwable {
    try { $f(); } catch (Throwable $e) {
        check($e instanceof $class,'expected '.$class.', got '.$e::class.': '.$e->getMessage()); return $e;
    }
    throw new RuntimeException('expected '.$class);
}
function waitFor(Closure $predicate): void {
    $timeout=new TimeoutCancellation(5);
    while (!$predicate()) Amp\delay(.001,cancellation:$timeout);
}
function take(Future $f): mixed { return $f->await(new TimeoutCancellation(5)); }
function snapshot(): array {
    global $audit;
    $s=$audit->new('snapshot'); $audit->lean_bridge_native_snapshot_read(FFI::addr($s));
    return [$s->runtime_state,$s->runtime_init_runs,$s->component_init_runs,$s->live_identities];
}
function nullFiles(): int {
    $count=0; foreach (glob('/proc/self/fd/*') as $fd) if (@readlink($fd)==='/dev/null') ++$count; return $count;
}
function baseline(string $why): void {
    global $fds,$nulls;
    waitFor(fn()=>snapshot()[3]===0 && nullFiles()===$nulls && count(scandir('/proc/self/fd'))===$fds);
    check(true,$why);
}

$peerFirst=$argv[1]==='peer-first';
if ($peerFirst) { C\issue(0)->close(); D\make(0,'warm')->close(); }
else { D\make(0,'warm')->close(); C\issue(0)->close(); }
Foreign\issue()->close();
$audit=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out); void lean_bridge_native_runtime_retire(void);');
check(snapshot()===[2,1,3,0],'three compatible runtime loads, one initialization, no owners');
// Drive one actual pending notification before measuring the process baseline.
D\reset(); $warm=C\issue(0); $work=D\pending($warm,true); $warm->close();
EventLoop::delay(.005,static function(): void { D\release(); }); take($work)->close();
waitFor(fn()=>snapshot()[3]===0);
$fds=count(scandir('/proc/self/fd')); $nulls=nullFiles();

$foreign=Foreign\issue(); $wrong=D\badge(23); $dead=C\issue(3); $dead->close(); D\reset();
check(C\read_badge($wrong)===23,'real second kind is usable by the independent package');
foreach ([$foreign,$wrong] as $v) {
    rejects(TypeError::class,fn()=>D\pending($v,true)); rejects(TypeError::class,fn()=>D\tickets($v,false));
}
rejects(LogicException::class,fn()=>D\pending($dead,true));
check(D\state()===0 && snapshot()[3]===2,'rejected arguments start no worker or cursor');
$foreign->close(); $wrong->close(); baseline('invalid inputs released');

$ticket=C\issue(40); $pending=D\pending($ticket,true); waitFor(fn()=>D\state()===1);
check(!$pending->isComplete() && snapshot()[3]===3,'borrow plus task and notification lease');
$ticket->close();
check(snapshot()[3]===2 && nullFiles()===$nulls+1,'worker alone still owns the Lean object and descriptor');
D\release(); $returned=take($pending);
check($returned instanceof C\Ticket && $returned instanceof D\Ticket && take($pending)===$returned,'same settled wrapper across waiters, recognized by both packages');
check(D\count($returned)===41 && snapshot()[3]===1,'mutation survived last caller close, one new return lease');
$alias=C\bump($returned);
check($alias!==$returned && $alias->sameResource($returned) && D\count($alias)===42,'independent peer mutates the returned identity');
$returned->close(); check(!$alias->isClosed(),'distinct leases share identity, not disposal');
$alias->close(); baseline('successful task left no descriptor or owner');

$source=C\issue(5); $failed=rejects(D\CheckedError::class,fn()=>D\checked(true,$source));
check($failed->declaration==='Depot.checked' && $failed->payload!==$source && $failed->payload->sameResource($source),'factory failure returns an independent owned error payload');
$fromFuture=take(D\checked(false,$source));
check($fromFuture!==$source && $fromFuture->sameResource($failed->payload),'success and failure carry the original object');
$source->close(); $failed->payload->close(); check(D\count($fromFuture)===5,'only the task lease remains');
rejects(TypeError::class,fn()=>Foreign\alias_ticket($fromFuture));
$again=take(D\revisit($fromFuture,false));
check($again!==$fromFuture && $again->sameResource($fromFuture),'terminal IO success carries a fresh lease');
$terminal=D\revisit($fromFuture,true);
$err=rejects(D\TaskIOError::class,fn()=>take($terminal));
check($err->declaration==='AsyncExchange.revisit' && str_contains($err->getMessage(),'ticket unavailable'),'terminal failure is not a borrowed resource or factory error');
check(rejects(D\TaskIOError::class,fn()=>take($terminal))===$err,'one stable failure after two waits');
$again->close(); $fromFuture->close(); baseline('both error phases released their native state');

$original=C\issue(8); $closed=D\closes(); $cursor=D\tickets($original,true); $original->close();
check(snapshot()[3]===1 && nullFiles()===$nulls+1,'only the unpulled Lean cursor holds the ticket');
$gen=$cursor->getIterator(); $first=$gen->current();
check($first instanceof C\Ticket && D\count($first)===8,'first item crosses the package boundary');
$bumped=C\bump($first); check($bumped->sameResource($first),'yielded item borrows into the independent package'); $bumped->close();
$step=rejects(D\TicketsStepError::class,fn()=>$gen->next());
check($step->declaration==='Depot.next' && $step->payload!==$first && $step->payload->sameResource($first),'typed pull error owns the same object independently');
check(D\closes()===$closed+1 && snapshot()[3]===2,'failed cursor closed once; item and typed error both still live');
$first->close(); check(D\count($step->payload)===9,'sole error lease remains usable'); $step->payload->close();
$cursor->close(); baseline('typed step error cleanup');
$original=D\make(1,'break'); $closed=D\closes();
foreach (D\tickets($original,false) as $item) { $original->close(); break; }
check(D\closes()===$closed+1 && D\count($item)===1,'early break closes cursor without invalidating a yielded owner');
$item->close(); baseline('early break');
$original=C\issue(20); $closed=D\closes(); $rows=iterator_to_array(D\tickets($original,false));
check(count($rows)===1 && $rows[0]->sameResource($original) && D\closes()===$closed+1,'natural exhaustion and independently owned item');
$rows[0]->close(); $original->close(); baseline('natural end');

foreach ([true,false] as $cooperative) {
    D\reset(); $source=C\issue(50); $stop=new DeferredCancellation(); $work=D\pending($source,$cooperative,$stop->getCancellation());
    $source->close(); waitFor(fn()=>D\state()===1); $stop->cancel();
    $cancelled=rejects(CancelledException::class,fn()=>take($work));
    if (!$cooperative) {
        check(nullFiles()===$nulls+1,'a non-cooperative worker still holds the resource after host cancellation');
        D\release();
    }
    waitFor(fn()=>D\state()===($cooperative?2:3));
    check(rejects(CancelledException::class,fn()=>take($work))===$cancelled,'late resource cannot replace cancellation');
    baseline('cancelled work releases the descriptor after Lean finishes');
}
D\reset(); $source=C\issue(61); $work=D\pending($source,true); $source->close();
$cancelWait=new DeferredCancellation(); EventLoop::queue(static fn()=>$cancelWait->cancel());
rejects(CancelledException::class,fn()=>$work->await($cancelWait->getCancellation()));
check(!$work->isComplete() && nullFiles()===$nulls+1,'cancelling a waiter does not release a running borrow');
D\release(); $out=take($work); check(D\count($out)===62,'second waiter can use the result'); $out->close();
baseline('cancelled waiter');

D\reset(); $private=C\issue(72); $unobserved=D\pending($private,true); $private->close();
$weak=WeakReference::create($unobserved); unset($unobserved);
waitFor(fn()=>D\state()===1);
check(nullFiles()===$nulls+1,'eager unobserved Amp operation still holds a live Lean value');
D\release();
waitFor(static function() use ($weak): bool { gc_collect_cycles(); return D\state()===3 && $weak->get()===null; });
baseline('discarded future releases its unclaimed successful resource');

D\reset(); $ticket=D\make(71,'retire-probe'); $pending=D\pending($ticket,true); $cursor=D\tickets($ticket,false); $ticket->close();
waitFor(fn()=>D\state()===1);
check(nullFiles()===$nulls+1 && !is_file('retired-close-ran.txt'),'worker and cursor hold one underlying file');
EventLoop::delay(.005,static function() use ($audit): void { $audit->lean_bridge_native_runtime_retire(); });
rejects(D\LeanBridgeError::class,fn()=>take($pending)); $cursor->close();
baseline('retirement permits cleanup of worker and cursor');
check(!is_file('retired-close-ran.txt') && snapshot()===[3,1,3,0],'retired close did not execute a fresh Lean filesystem effect');
rejects(C\LeanBridgeError::class,fn()=>C\issue(9));
echo json_encode(['php'=>PHP_VERSION,'order'=>$argv[1],'checks'=>$checks,'final'=>snapshot(),'descriptorDelta'=>nullFiles()-$nulls],JSON_THROW_ON_ERROR),"\n";
