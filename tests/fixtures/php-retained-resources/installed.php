<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\{CancelledException, DeferredCancellation, DeferredFuture, Future, TimeoutCancellation};
use LeanCounter as C;
use LeanDepot as D;
use LeanForeignPeer as F;
use Revolt\EventLoop;

$checks=0;
function check(bool $ok,string $why): void {
    global $checks;
    if (!$ok) throw new RuntimeException($why);
    ++$checks;
}
function rejects(string $type,Closure $run): Throwable {
    try { $run(); } catch (Throwable $e) {
        check($e instanceof $type,'expected '.$type.', got '.$e::class.': '.$e->getMessage()); return $e;
    }
    throw new RuntimeException('expected '.$type);
}
function value(Future $f): mixed { return $f->await(new TimeoutCancellation(15)); }
function snap(): array {
    global $broker;
    $s=$broker->new('snapshot'); $broker->lean_bridge_native_snapshot_read(FFI::addr($s));
    return [$s->runtime_state,$s->runtime_init_runs,$s->component_init_runs,$s->live_identities];
}
function filesHeld(): int {
    $n=0; foreach (glob('/proc/self/fd/*') as $f) if (@readlink($f)==='/dev/null') ++$n;
    return $n;
}
function clean(string $why): void {
    global $files,$fds;
    $deadline=new TimeoutCancellation(15);
    while (snap()[3] || filesHeld()!==$files || count(scandir('/proc/self/fd'))!==$fds) Amp\delay(.001,cancellation:$deadline);
    check(true,$why);
}
if ($argv[1]==='peer-first') { C\issue(0)->close(); D\make(0,'warm')->close(); }
else { D\make(0,'warm')->close(); C\issue(0)->close(); }
F\issue()->close();
$broker=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
check(snap()===[2,1,3,0],'one native runtime initialized three independent packages');
$warm=C\issue(1); value(D\revisit($warm,static fn($v)=>$v))->close(); $warm->close();
$files=filesHeld(); $fds=count(scandir('/proc/self/fd'));
clean('warm run released its ticket');

$calls=0; $arg=static function($v) use (&$calls) { ++$calls; return $v; };
$foreign=F\issue(); $badge=D\badge(4); $expired=C\issue(17); $expired->close();
foreach ([$foreign,$badge] as $wrong) {
    rejects(TypeError::class,fn()=>D\revisit($wrong,$arg)); rejects(TypeError::class,fn()=>D\lend($wrong,$arg));
}
rejects(LogicException::class,fn()=>D\revisit($expired,$arg));
$valid=C\issue(11); rejects(TypeError::class,fn()=>D\revisit($valid,static function(&$v){ return $v; }));
check(!$calls && D\count($valid)===11 && C\read_badge($badge)===4,'invalid resource or callable never enters user code');
$valid->close(); $foreign->close(); $badge->close(); clean('wrong kinds and closed inputs leave no owners');

$ticket=C\issue(40); $called=0;
$pending=D\revisit($ticket,static function(int $n) use ($ticket,&$called,$files): int {
    ++$called; check($n===40 && D\count($ticket)===40,'callback reenters the owning component');
    $ticket->close();
    check($ticket->isClosed() && filesHeld()===$files+1,'Lean alone keeps the real descriptor after caller close');
    return $n+2;
});
$updated=value($pending);
check($called===1 && $updated instanceof D\Ticket && $updated instanceof C\Ticket && $updated!==$ticket,'independent result recognized by both packages');
check(value($pending)===$updated && D\count($updated)===42,'same completed future and original state');
$alias=C\bump($updated);
check($alias->sameResource($updated) && D\count($alias)===43,'peer sees the same mutated resource');
$updated->close(); check(!$alias->isClosed() && filesHeld()===$files+1,'closing returned lease does not close retained peer lease');
$alias->close(); clean('success released exactly one underlying file');

foreach ([true,false,'caught'] as $mode) {
    $ticket=C\issue(21); $fault=new DomainException('local');
    $task=D\lend($ticket,static function(int $v) use ($ticket,$mode,$fault): bool {
        check($v===21,'factory saw intact resource'); $ticket->close();
        if ($mode==='caught') throw $fault;
        return $mode;
    });
    if ($mode===true) $out=value($task);
    else {
        $e=rejects(D\LendError::class,fn()=>value($task));
        check($e!==$fault && $e->declaration==='LeaseFactory.lend' && rejects(D\LendError::class,fn()=>value($task))===$e,'typed factory failure remains distinct from its caught PHP failure');
        $out=$e->payload;
    }
    check($out instanceof C\Ticket && !$out->isClosed() && $ticket->isClosed() && D\count($out)===21,'factory commits an owned ticket to result or error');
    $alias=C\bump($out); check($alias->sameResource($out) && D\count($alias)===22,'independent package accepts resource payload');
    $out->close(); $alias->close(); clean('success or typed EIO payload released once');
}

$ticket=C\issue(19); $fault=new DomainException('sentinel');
$bad=D\revisit($ticket,static function($n) use ($ticket,$fault){ $ticket->close(); throw $fault; });
check(rejects(DomainException::class,fn()=>value($bad))===$fault,'terminal callback failure restores original PHP exception, not a ticket');
clean('propagated exception released loan');
$ticket=C\issue(13); $bad=D\revisit($ticket,static function($n) use ($ticket){ $ticket->close(); return '13'; });
rejects(TypeError::class,fn()=>value($bad)); clean('invalid reply released loan without retiring runtime');

$ticket=C\issue(20); $cancel=new DeferredCancellation(); $entered=new DeferredFuture(); $resume=new DeferredFuture();
$calls=0; $done=new DeferredFuture();
$task=D\revisit($ticket,static function($n) use ($entered,$resume,$ticket,$done,&$calls) {
    ++$calls; $ticket->close(); $entered->complete(); value($resume->getFuture()); $done->complete(); return $n+9;
},$cancel->getCancellation());
value($entered->getFuture()); check(!$task->isComplete() && filesHeld()===$files+1,'suspended PHP callback still has a Lean borrow');
$cancel->cancel(); $why=rejects(CancelledException::class,fn()=>value($task));
$resume->complete(); value($done->getFuture());
check($calls===1 && rejects(CancelledException::class,fn()=>value($task))===$why,'late reply cannot settle or allocate a new ticket');
clean('cancellation during suspended callback released file and native handles');

$ticket=C\issue(12); $called=0; $registration=null;
$registration=new D\RetainedCallback(static function(int $n) use ($ticket,&$registration,&$called): int {
    ++$called; $registration->close(); $ticket->close(); return $n+1;
});
$result=value(D\revisit($ticket,$registration));
check($registration->isClosed() && D\count($result)===13 && $called===1,'revoking callback and closing ticket allows active invocation to finish');
rejects(D\CallbackClosed::class,fn()=>value(D\revisit($result,$registration)));
check(D\count($result)===13 && $called===1,'subsequent invocation rejected, independent ticket intact');
$result->close(); clean('revoked registration carries no native lease');

$ticket=C\issue(16); $ready=new DeferredFuture(); $go=new DeferredFuture(); $done=new DeferredFuture();
$waiting=D\revisit($ticket,static function($n) use ($ticket,$ready,$go,$done){ $ticket->close(); $ready->complete(); value($go->getFuture()); $done->complete(); return $n; });
value($ready->getFuture());
$other=C\issue(23); $trap=new Error('retire test');
$failed=D\revisit($other,static function($n) use ($other,$trap) { $other->close(); throw $trap; });
check(rejects(Error::class,fn()=>value($failed))===$trap,'unexpected Error retires shared broker');
rejects(D\LeanBridgeError::class,fn()=>value($waiting)); $go->complete(); value($done->getFuture());
rejects(C\LeanBridgeError::class,fn()=>C\issue(7));
clean('retirement released both peer-owned files and ignored suspended reply');
echo json_encode(['order'=>$argv[1],'php'=>PHP_VERSION,'checks'=>$checks,'final'=>snap(),'descriptorDelta'=>filesHeld()-$files],JSON_THROW_ON_ERROR),"\n";
