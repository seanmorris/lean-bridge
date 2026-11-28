<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';

$checks=0;
function check(bool $v,string $why): void {
    global $checks;
    if (!$v) throw new RuntimeException($why);
    $checks++;
}
function refuses(string $type,Closure $call): Throwable {
    try { $call(); } catch (Throwable $err) {
        check($err instanceof $type, "expected $type, got ".$err::class.": ".$err->getMessage());
        return $err;
    }
    throw new RuntimeException("expected $type");
}
function fds(): int { return count(scandir('/proc/self/fd')); }
function snapshot(FFI $observer): array {
    $s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s));
    return [$s->runtime_state,$s->runtime_init_runs,$s->component_init_runs,$s->live_identities];
}
$peerFirst=$argv[1]==='peer-first';
if ($peerFirst) { LeanCounter\issue(0)->close(); LeanDepot\make(0,'warm')->close(); }
else { LeanDepot\make(0,'warm')->close(); LeanCounter\issue(0)->close(); }
$foreign=LeanForeignPeer\issue();
check(LeanForeignPeer\label($foreign)==='foreign','incompatible package works with its own native value');
refuses(TypeError::class,fn()=>LeanDepot\count($foreign));
refuses(TypeError::class,fn()=>LeanCounter\bump($foreign));
$foreign->close();
$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out); void lean_bridge_native_runtime_retire(void);');
$baseline=fds();
check(snapshot($observer)===[2,1,3,0],'one broker, three initialized components, no leases');
$t=$peerFirst?LeanCounter\issue(4):LeanDepot\make(4,'primary');
check($t instanceof LeanDepot\Ticket && $t instanceof LeanCounter\Ticket,'source-identical aliases across packages');
check(!($t instanceof LeanForeignPeer\Ticket),'a different definition has a distinct PHP class');
check(fds()===$baseline+1 && snapshot($observer)[3]===1,'one live object descriptor and one owner');
$b=LeanDepot\badge(12);
check(LeanCounter\read_badge($b)===12,'second nominal kind crosses independently');
refuses(TypeError::class,fn()=>LeanDepot\count($b));
refuses(TypeError::class,fn()=>$t->sameResource($b));
refuses(TypeError::class,fn()=>LeanForeignPeer\alias_ticket($t));
refuses(TypeError::class,fn()=>LeanForeignPeer\alias_badge($b));
refuses(Error::class,fn()=>new LeanDepot\Ticket());
refuses(Error::class,fn()=>clone $t);
refuses(LogicException::class,fn()=>serialize($t));
$shell=(new ReflectionClass(LeanDepot\Ticket::class))->newInstanceWithoutConstructor();
refuses(LogicException::class,fn()=>LeanDepot\count($shell));
check(snapshot($observer)[3]===2 && LeanDepot\count($t)===4,'invalid input does not touch state or acquire a lease');
$r=$t->retain(); $alias=LeanDepot\alias($t); $next=LeanCounter\bump($t);
check($r!==$t && $alias!==$next && $r->sameResource($t) && $next->sameResource($alias),'independent wrappers compare native identity');
check(LeanDepot\count($next)===5,'peer mutation is visible');
$distinct=LeanDepot\make(5,'distinct');
check(!$distinct->sameResource($next),'matching values need not be the same object');
$distinct->close(); unset($distinct);
$err=refuses(LeanDepot\ChooseError::class,fn()=>LeanDepot\choose(true,$t));
$errorOwner=$err->payload;
check($err->declaration==='Exchange.choose' && $errorOwner->sameResource($t),'typed error payload owns its independent resource');
$result=LeanDepot\choose(false,$t);
check($result->sameResource($errorOwner),'successful EIO resource is separate from its error');
$t->close(); $t->close();
check($t->isClosed() && !$result->isClosed(),'double-close is harmless and does not close an alias');
refuses(LogicException::class,fn()=>$t->retain());
refuses(LogicException::class,fn()=>LeanDepot\count($t));
refuses(LogicException::class,fn()=>$result->sameResource($t));
$fork=function_exists('pcntl_fork');
if ($fork) {
    $pid=pcntl_fork(); if ($pid<0) throw new RuntimeException('fork failed');
    if ($pid===0) {
        try { $result->close(); exit(2); } catch (LogicException $e) { exit(str_contains($e->getMessage(),'fork')?0:3); }
    }
    pcntl_waitpid($pid,$status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'forked child cannot close parent owner');
}
LeanDepot\add($result,6); check(LeanDepot\count($errorOwner)===11,'remaining aliases survive closure and fork');
$weak=WeakReference::create($r); unset($r); gc_collect_cycles();
check($weak->get()===null,'native bookkeeping does not keep a discarded wrapper alive');
$alias->close(); $next->close(); $b->close(); $result->close(); unset($err);
check(snapshot($observer)[3]===1 && fds()===$baseline+1,'only the EIO payload still owns the descriptor');
unset($errorOwner); gc_collect_cycles();
check(snapshot($observer)[3]===0 && fds()===$baseline,'dropping final owner closes the Lean descriptor');
$kept=LeanCounter\issue(1); $last=$kept->retain(); $observer->lean_bridge_native_runtime_retire();
refuses(LeanCounter\LeanBridgeError::class,fn()=>$kept->retain());
refuses(LeanDepot\LeanBridgeError::class,fn()=>LeanDepot\count($kept));
$kept->close(); unset($last);
check(snapshot($observer)===[3,1,3,0] && fds()===$baseline,'retired runtime releases handles without reinitializing');
echo json_encode(['php'=>PHP_VERSION,'order'=>$argv[1],'checks'=>$checks,'fork'=>$fork,'final'=>snapshot($observer)],JSON_THROW_ON_ERROR),"\n";
