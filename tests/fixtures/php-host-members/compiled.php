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
$binding->close(); $binding->close();
check(failure(fn()=>$binding->read($box)) instanceof \LogicException,'closed binding refuses calls');
check(References::count()===0,'weak binding, class, object and call tokens all released');
$reopen=withHosts(['Box'=>Meter::class]); check($reopen->identity($box)===$box,'new binding starts clean'); $reopen->close();
check(References::count()===0,'zero tokens after second binding');
echo json_encode(['php'=>PHP_VERSION,'checks'=>$checks],JSON_THROW_ON_ERROR),"\n";
