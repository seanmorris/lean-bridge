<?php
declare(strict_types=1);
// The producer can use a single thread. Give the runtime multiple Lean workers for the races.
putenv('LEAN_NUM_THREADS=4');
require __DIR__.'/vendor/autoload.php';
use Amp\Future;
use Amp\TimeoutCancellation;
use LeanBudget as B;

function check(bool $ok, string $why): void {
    if (!$ok) throw new RuntimeException($why);
}
function result(Future $f): mixed { return $f->await(new TimeoutCancellation(30)); }
function caught(string $type, Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) {
        check($e::class === $type, "expected $type; got ".$e::class.': '.$e->getMessage()); return $e;
    }
    throw new RuntimeException("expected $type");
}
function denied(string $decl, Closure $call): Throwable {
    $e=caught(B\CallbackAlreadyInvoked::class,$call);
    check($e->declaration===$decl && $e->getMessage()==='callback-already-invoked','wrong policy exception');
    return $e;
}
function tracked(int &$calls): array {
    $owner=new stdClass();
    return [WeakReference::create($owner),new B\RetainedCallback(static function(int $n) use ($owner,&$calls): int {
        ++$calls; $owner->last=$n; return $n+1;
    })];
}

$calls=0; $unbounded=0;
[$weak,$f]=tracked($calls);
$many=static function(int $n) use (&$unbounded): int { ++$unbounded; return $n+1; };
denied('Budget.probe',fn()=>result(B\probe(1,$f,$many)));
check([$calls,$unbounded]===[1,2],'allowance attached to wrong slot');
check(result(B\pair(40,$f,$f))===42,'same callable registered twice');
$a=B\single(3,$f); $b=B\single(41,$f);
check(result($b)===42 && result($a)===4 && $calls===5,'independent concurrent tasks');
$original=new RuntimeException('callback-already-invoked'); $failed=0;
$boom=static function(int $n) use ($original,&$failed): never { ++$failed; throw $original; };
denied('Budget.retry',fn()=>result(B\retry(1,$boom)));
check($failed===1,'caught failure did not spend the permit');
check(caught(RuntimeException::class,fn()=>result(B\single(1,$boom)))===$original,'lost original exception');
$older=denied('Racing.duringStart',fn()=>result(B\during_start(1,$f)));
check(caught(B\CallbackAlreadyInvoked::class,fn()=>result(B\single(1,static fn(int $n)=>throw $older)))===$older,'replaced original policy exception');
$start=caught(B\IOError::class,fn()=>result(B\start(0,$f)));
$end=caught(B\TaskIOError::class,fn()=>result(B\replace(1,$f)));
check($start->declaration==='FactoryFault.start' && $end->declaration==='Racing.replace','wrong IO phase');
foreach ([$start,$end] as $io) check(str_contains($io->getMessage(),'callback-already-invoked'),'wrong IO message');
$before=$calls; $typed=caught(B\CheckedError::class,fn()=>result(B\checked(0,$f)));
check($typed->declaration==='TypedBudget.checked' && $typed->payload===73 && $calls===$before,'typed startup denial');
denied('TypedBudget.checked',fn()=>result(B\checked(1,$f)));
check($calls===$before+1,'typed factory admitted more than one call');
for ($i=0;$i<16;++$i) {
    $before=$calls;
    denied('Racing.race',fn()=>result(B\race($i,$f)));
    check($calls===$before+1,'both workers reached PHP');
}
check($weak->get()!==null,'lost retained capture early'); $f->close(); gc_collect_cycles();
check($weak->get()===null,'retained capture leaked');
// Test-only: observe the broker already loaded by Composer, without loading another copy.
$observer=FFI::cdef('typedef struct { uint32_t abi,state,inits,component_inits,attached,live; uint64_t instance,domain; } snapshot;
void lean_bridge_native_snapshot_read(snapshot *out);');
$s=$observer->new('snapshot'); $observer->lean_bridge_native_snapshot_read(FFI::addr($s));
check([$s->abi,$s->inits,$s->live]===[1,1,0],'broker did not return to baseline');
echo json_encode(['php'=>PHP_VERSION,'races'=>16,'live'=>$s->live],JSON_THROW_ON_ERROR),"\n";
