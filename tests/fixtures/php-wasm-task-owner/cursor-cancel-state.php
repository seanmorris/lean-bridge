<?php
declare(strict_types=1);
// Exercise the shipped Zend state machine. Fibers stand in for vrzno_await;
// this control does not claim execution of a Wasm guest or a Lean worker.
require __DIR__.'/../../../src/backends/php/php-wasm-task-pump.php';
require __DIR__.'/../../../src/backends/php/php-wasm-task-delivery.php';
use __LB_PUBLIC__\{PullStream,TaskCancelled};

function check(bool $ok,string $why): void {if (!$ok) throw new LogicException($why);}
function vrzno_await(Closure $resume): mixed {return $resume();}
final class Monitor {
    public function __construct(private string $point) {}
    public function result(): Closure {return fn()=>Fiber::suspend($this->point);}
}
final class TestOwner {
    public int $closes=0,$pulls=0;
    public function pull(): Monitor {++$this->pulls;return new Monitor('read');}
    public function drain(): Monitor {++$this->closes;return new Monitor('cleanup');}
    public function dispose(): void {throw new LogicException('closing twice');}
}
final class BufferedLease {
    public int $discards=0;
    public function form(): string {return 'value';}
    public function discard(): void {++$this->discards;}
}
$make=Closure::bind(static fn($owner,$decode)=>new PullStream($owner,$decode),null,PullStream::class);
foreach (['cancelled','value','lease','fault'] as $kind) {
    $owner=new TestOwner(); $fault=new RuntimeException('preserve terminal fault');
    $decode=static function($packet) use($fault) {
        if ($packet==='cancelled') throw new TaskCancelled();
        if ($packet==='fault') throw $fault;
        if ($packet instanceof BufferedLease) throw new LogicException('claimed a cancelled lease');
        return $packet;
    };
    $cursor=$make($owner,$decode);$seen=[];
    $reader=new Fiber(static function() use($cursor,&$seen) {
        try {foreach ($cursor as $item) $seen[]=$item;}
        catch (Throwable $e) {return $e;}
        throw new LogicException('lost pending observation');
    });
    check($reader->start()==='read','start one pull');
    check($cursor->cancel() && !$cursor->cancel(),'nonblocking, idempotent cancel');
    try {$cursor->close();throw new RuntimeException('reentrant close');}
    catch (LogicException $e) {check(str_contains($e->getMessage(),'own pull'),'wrong guard');}
    $packet=$kind==='lease' ? new BufferedLease() : $kind;
    $reader->resume($packet);
    check($reader->isTerminated() && $seen===[],'reader must finish before native drain');
    $error=$reader->getReturn();
    check($kind==='fault' ? $error===$fault : $error instanceof TaskCancelled,'terminal error');
    if ($kind==='lease') check($packet->discards===1,'buffered owned input discarded exactly once');
    $closer=new Fiber(fn()=>$cursor->close());
    check($closer->start()==='cleanup','wait for actual drain');
    $closer->resume('["end"]');$closer->getReturn();$cursor->close();
    check($owner->closes===1 && $owner->pulls===1,'exactly one pull and close');
}
echo "Zend cursor: cancellation, buffered item disposal, fault precedence and one drain passed\n";
