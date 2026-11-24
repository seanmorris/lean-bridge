<?php
declare(strict_types=1);
require $argv[1];

use function LeanWorkshop\withHosts;
use LeanBridge\NativeHostV1\References;

class Meter {
    public function __construct(public int $level) {}
    public function identity(): mixed {return $this;}
    public function read(): mixed {return $this->level;}
}
final class Broken extends Meter {
    public \Throwable $exception;
    public function read(): int {throw $this->exception;}
}
final class Nested extends Meter {
    public \Closure $callback;
    public function read(): int {return ($this->callback)();}
}
final class InvalidReply extends Meter {
    public function identity(): mixed {return new \stdClass();}
    public function read(): mixed {return '42';}
}
$checks=0;
function check(bool $ok,string $why): void {global $checks;if (!$ok) throw new \LogicException($why);++$checks;}
function failure(\Closure $f): \Throwable {
    try {$f();} catch (\Throwable $e) {return $e;}
    throw new \LogicException('Expected an exception');
}
$binding=withHosts(['Box'=>Meter::class]); $box=new Meter(42);
check($binding->identity($box)===$box,'cold application object round trip');
$other=$binding->make(9);
check($other instanceof Meter && $other!==$box && $other->level===9,'Lean called real PHP constructor');
check($binding->update($other,73)===73 && $other->level===73,'Lean called setter then getter');
check($binding->read($box)===42,'real application method');
$bad=new Broken(1); $bad->exception=new \Error('original');
check(failure(fn()=>$binding->read($bad))===$bad->exception,'unchanged IO error restores original Throwable');
$mapped=failure(fn()=>$binding->mapped($bad));
check($mapped instanceof LeanWorkshop\MappedError && $mapped->payload==='host read failed','Lean mapped original error to EIO String');
$r=$binding->choose($box,true);
check($r instanceof LeanWorkshop\Ok && $r->value===$box,'nominal payload in returned Ok');
$r=$binding->choose($box,false);
check($r instanceof LeanWorkshop\Err && $r->value===17,'returned Err is not thrown');
$e=failure(fn()=>$binding->fail_with($box));
check($e instanceof LeanWorkshop\FailWithError && $e->payload===$box,'thrown nominal EIO payload');
check(failure(fn()=>$binding->read(new \stdClass())) instanceof \TypeError,'reject foreign class before Lean');
check(failure(fn()=>$binding->make('1')) instanceof \TypeError,'reject numeric coercion before Lean');
$wrong=new InvalidReply(1);
check(failure(fn()=>$binding->identity($wrong)) instanceof \TypeError,'wrong nominal reply is a boundary error');
check(failure(fn()=>$binding->read($wrong)) instanceof \TypeError,'wrong scalar reply is a boundary error');
check(failure(fn()=>$binding->mapped($wrong)) instanceof \TypeError,'Lean EIO mapping cannot hide an invalid PHP result');
check($binding->read($box)===42,'invalid application result does not poison native runtime');
$nested=new Nested(0); $nested->callback=fn()=>$binding->read($other)+1;
check($binding->read($nested)===74,'nested Lean-PHP-Lean call');
$nested->callback=fn()=>$binding->read($bad);
check(failure(fn()=>$binding->read($nested))===$bad->exception,'original exception through nested call');
$nested->callback=function() use($binding) { return failure(fn()=>$binding->close()) instanceof \RuntimeException ? 8 : -1; };
check($binding->read($nested)===8 && $binding->read($box)===42,'self disposal refused; binding remains usable');

// Suspend the real PHP callback, leaving both the Lean and FFI frames live.
// Another Fiber must not enter (or retire) the process-wide native registry.
$nested->callback=static fn()=>\Fiber::suspend('in PHP member');
$fiber=new \Fiber(fn()=>$binding->read($nested));
check($fiber->start()==='in PHP member','PHP member suspended inside Lean call');
foreach ([fn()=>$binding->read($box),fn()=>$binding->close(),fn()=>withHosts(['Box'=>Meter::class])] as $foreign) {
    $e=failure($foreign);
    check($e instanceof \LogicException && str_contains($e->getMessage(),'another fiber'),'foreign Fiber refused at owner gate');
}
$fiber->resume(31);
check($fiber->isTerminated() && $fiber->getReturn()===31 && $binding->read($box)===42,'original owner resumes and unwinds cleanly');

check(failure(fn()=>clone $binding) instanceof \Error,'cannot clone an owner');
check(failure(fn()=>serialize($binding)) instanceof \LogicException,'cannot serialize an owner');
$empty=(new \ReflectionClass($binding))->newInstanceWithoutConstructor();
check(failure(fn()=>$empty->read($box)) instanceof \LogicException,'constructor bypass does not create an active binding');
check(failure(fn()=>$empty->__unserialize([])) instanceof \LogicException,'cannot restore a binding');
$ephemeral=$binding->make(14); $weak=\WeakReference::create($ephemeral);
check($binding->identity($ephemeral)===$ephemeral,'weak canonical object is unchanged');
unset($ephemeral);
check($weak->get()===null,'registry does not pin discarded weak canonical objects');

$fork=function_exists('pcntl_fork');
if ($fork) {
    $pid=pcntl_fork(); if ($pid<0) throw new \RuntimeException('fork failed');
    if ($pid===0) {
        foreach ([fn()=>$binding->read($box),fn()=>$binding->close()] as $inherited) {
            $e=failure($inherited);
            if (!$e instanceof \LogicException || !str_contains($e->getMessage(),'Inherited')) exit(2);
        }
        exit(0);
    }
    check(pcntl_waitpid($pid,$status)===$pid && pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'child refused inherited read and close');
}
check($binding->read($box)===42,'original binding remains usable after owner checks');
$binding->close(); $binding->close();
check(failure(fn()=>$binding->read($box)) instanceof \LogicException,'closed binding refuses calls');
check(References::count()===0,'weak binding, class, object and call tokens all released');
$reopen=withHosts(['Box'=>Meter::class]); check($reopen->identity($box)===$box,'new binding starts clean'); $reopen->close();
check(References::count()===0,'zero tokens after second binding');
echo json_encode(['php'=>PHP_VERSION,'checks'=>$checks,'fork'=>$fork],JSON_THROW_ON_ERROR),"\n";
