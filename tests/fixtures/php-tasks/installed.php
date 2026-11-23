<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\CancelledException;
use Amp\DeferredCancellation;
use Amp\Future;
use Amp\TimeoutCancellation;
use Brick\Math\BigInteger;
use LeanPulse as P;
use Revolt\EventLoop;

$checks=0;
function check(bool $ok,string $label): void {
    global $checks;
    if (!$ok) throw new RuntimeException($label);
    ++$checks;
}
function rejects(string $type,Closure $f): Throwable {
    try { $f(); } catch (Throwable $error) {
        check($error instanceof $type,'expected '.$type.', got '.$error::class.': '.$error->getMessage()); return $error;
    }
    throw new RuntimeException('expected '.$type);
}
function until(Closure $f): void {
    $deadline=new TimeoutCancellation(5);
    while (!$f()) Amp\delay(.002,cancellation:$deadline);
}
function value(Future $future): mixed { return $future->await(new TimeoutCancellation(5)); }
function identities(FFI $observer): int {
    $s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s)); return $s->live_identities;
}
function fds(): int { return count(scandir('/proc/self/fd')); }

$huge=BigInteger::of('123456789123456789123456789');
$big=BigInteger::of('18446744073709551615'); $bin=P\Bytes::fromString("\0\xff\n");
$samples=['unit'=>null,'bool'=>true,'uint8'=>255,'int8'=>-128,'uint16'=>65535,'int16'=>-32768,'uint32'=>4294967295,
    'int32'=>-2147483648,'int64'=>PHP_INT_MIN,'isize'=>PHP_INT_MAX,'uint64'=>$big,'usize'=>$big,'nat'=>$huge,
    'int'=>$huge->negated(),'float32'=>1.25,'float64'=>-INF,'char'=>'🦊','string'=>"a\0β",'bytes'=>$bin];
foreach ($samples as $name=>$input) {
    $fn='LeanPulse\\rt_'.$name; $future=$fn($input);
    check($future instanceof Future,'idiomatic Amp future for '.$name);
    $out=value($future);
    check($input instanceof BigInteger ? $out instanceof BigInteger && (string)$out===(string)$input :
        ($input instanceof P\Bytes ? $out instanceof P\Bytes && $out->equals($input) : $out===$input),'scalar '.$name);
}
rejects(TypeError::class,fn()=>P\late(1,1));
rejects(ValueError::class,fn()=>P\rt_int8(128));
rejects(ValueError::class,fn()=>P\rt_char('more'));
check(value(P\bytes($bin))->equals($bin),'Bytes class and bytes function have distinct PHP namespaces');
$factory=rejects(P\CheckedError::class,fn()=>P\checked(true,false,'start'));
check($factory->declaration==='Pulse.checked' && $factory->payload==='start','typed error thrown before returning a future');
check(value(P\checked(false,true,'data'))->value==='data','returned Except.Err remains data');
$err=rejects(P\IOError::class,fn()=>P\io_task(true));
check($err->declaration==='Pulse.ioTask' && str_contains($err->getMessage(),'IO refusal'),'factory IO error');
check(value(P\io_task(false))===null,'Unit is a real task value');
$task=P\terminal(true,$huge);
$terminal=rejects(P\TaskIOError::class,fn()=>value($task));
check($terminal->declaration==='RubyTasks.terminal' && str_contains($terminal->getMessage(),'terminal'),'failure belongs to the task');
check(rejects(P\TaskIOError::class,fn()=>value($task))===$terminal,'multiple waiters see the same exception object');
check(value(P\terminal(false,$huge))->isEqualTo($huge),'successful terminal IO value');
$typed=rejects(P\WideError::class,fn()=>P\wide(true,$huge->negated(),$bin));
check($typed->payload instanceof P\Err && $typed->payload->value->equals($bin),'typed binary factory payload');
check(value(P\wide(false,$huge,$bin))->value->isEqualTo($huge),'nested success payload');

$observer=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out); void lean_bridge_native_runtime_retire(void);');
P\reset(); $timer=0; $pending=P\late(true,42);
check(!$pending->isComplete(),'real gated task must stay pending');
check(identities($observer)===2,'one native task owner and its worker-notification lease');
EventLoop::delay(.01,static function() use (&$timer) { ++$timer; P\release(); });
check(value($pending)===42 && value($pending)===42 && $timer===1,'nonblocking event loop and repeatable settlement');
check(identities($observer)===0,'settled task released');
$baseline=fds();
P\reset(); $cancel=new DeferredCancellation(); $work=P\late(true,13,$cancel->getCancellation());
until(fn()=>P\state()===1);
$cancel->cancel();
rejects(CancelledException::class,fn()=>value($work));
until(fn()=>P\state()===2 && identities($observer)===0);
check(identities($observer)===0,'operation token cancels the cooperative Lean worker');
rejects(CancelledException::class,fn()=>P\late(true,15,$cancel->getCancellation()));
check(identities($observer)===0,'pre-cancellation never starts');
P\reset(); $work=P\late(false,26); $wait=new DeferredCancellation();
EventLoop::queue(static fn()=>$wait->cancel());
rejects(CancelledException::class,fn()=>$work->await($wait->getCancellation()));
check(identities($observer)===2 && !$work->isComplete(),'wait cancellation leaves shared operation alone');
P\release(); check(value($work)===26,'another waiter receives completion');
P\reset(); $cancel=new DeferredCancellation(); $work=P\late(false,27,$cancel->getCancellation());
until(fn()=>P\state()===1); $cancel->cancel();
$original=rejects(CancelledException::class,fn()=>value($work)); P\release(); until(fn()=>P\state()===3);
check(rejects(CancelledException::class,fn()=>value($work))===$original,'late completion cannot replace cancellation');

$before=P\pulls(); $closed=P\closes(); $cursor=P\series(false,false,'first');
check(P\pulls()===$before && identities($observer)===1,'opening has no implicit pull');
foreach ($cursor as $item) {
    check($item instanceof P\Err && $item->value==='first','first item is a returned Err');
    check(P\pulls()===$before+1,'no prefetch while item is held');
    rejects(LogicException::class,static function() use ($cursor) { foreach ($cursor as $_) {} });
    break;
}
check(P\closes()===$closed+1 && identities($observer)===0,'foreach break closes exactly once');
$cursor->close(); check(P\closes()===$closed+1 && iterator_to_array($cursor)===[],'idempotent close');
$all=iterator_to_array(P\series(false,false,'x'));
check(count($all)===2 && $all[1] instanceof P\Ok && $all[1]->value===73,'natural exhaustion');
$error=rejects(P\SeriesStepError::class,static function() { foreach (P\series(true,false,'x') as $_) {} });
check($error->payload===413 && $error->declaration==='Pulse.next','typed pull failure kept separate');
$closed=P\closes(); $sentinel=new DomainException('outside Lean');
check(rejects(DomainException::class,static function() use ($sentinel) { foreach (P\series(false,false,'x') as $_) throw $sentinel; })===$sentinel,'consumer exception identity');
check(P\closes()===$closed+1,'cleanup after consumer throws');
$closed=P\closes(); $open=P\series(false,false,'unused'); unset($open); gc_collect_cycles();
check(P\closes()===$closed+1,'abandoned unopened enumeration releases its cursor');
$closed=P\closes(); $cancel=new DeferredCancellation(); $cursor=P\series(false,false,'idle',$cancel->getCancellation());
$cancel->cancel();
rejects(CancelledException::class,fn()=>iterator_to_array($cursor));
check(P\closes()===$closed+1 && identities($observer)===0,'token closes an idle cursor even before its first pull');
$fork=function_exists('pcntl_fork');
if ($fork) {
    $cursor=P\series(false,false,'before fork');
    $pid=pcntl_fork();
    if ($pid===-1) throw new RuntimeException('fork failed');
    if ($pid===0) {
        try { $cursor->close(); exit(2); }
        catch (RuntimeException $e) { exit(str_contains($e->getMessage(),'fork')?0:3); }
    }
    pcntl_waitpid($pid,$status);
    check(pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'child refused inherited task owner');
    check(identities($observer)===1 && count(iterator_to_array($cursor))===2,'parent owner unaffected by child shutdown');
}
P\reset(); $cursor=P\series(false,true,'blocked');
$consume=Amp\async(static function() use ($cursor) { return iterator_to_array($cursor); });
until(fn()=>P\state()===1); $cursor->close();
rejects(P\LeanBridgeError::class,fn()=>value($consume)); P\release(); until(fn()=>P\state()===3);
until(fn()=>fds()===$baseline);
check(identities($observer)===0,'no descriptors or owners leaked after cancellation and partial streams');

P\reset(); $pending=P\late(true,61);
EventLoop::delay(.01,static function() use ($observer): void { $observer->lean_bridge_native_runtime_retire(); });
rejects(P\LeanBridgeError::class,fn()=>value($pending));
until(fn()=>identities($observer)===0);
check(identities($observer)===0,'retirement wakes the waiting owner and releases it');
rejects(P\LeanBridgeError::class,fn()=>P\state());
echo json_encode(['checks'=>$checks,'php'=>PHP_VERSION,'fork'=>$fork,'live'=>identities($observer)],JSON_THROW_ON_ERROR),"\n";
