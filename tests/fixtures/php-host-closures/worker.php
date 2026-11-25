<?php
declare(strict_types=1);
require $argv[1];
use function LeanWorkshop\withHosts;
use LeanBridge\NativeHostV2\References;

final class Meter {
    public ?Closure $hook=null;
    public function __construct(public int $level) {}
    public function read(): int { if ($this->hook) ($this->hook)(); return $this->level; }
    public function identity(): self { return $this; }
}
function check(bool $ok,string $label): void { if (!$ok) throw new LogicException($label); }
function reject(Closure $f): Throwable {
    try { $f(); } catch (Throwable $e) { return $e; }
    throw new RuntimeException('expected rejection');
}
$a=withHosts(['Box'=>Meter::class]);$b=withHosts(['Box'=>Meter::class]);
$x=$a->make(5);check($a->echo_box($x)->await()===$x,'future replaced application object');
$file=$a->file_reader();
check(reject(fn()=>$file('does-not-exist')) instanceof LeanWorkshop\IOError,'missing file did not raise IO error');
foreach (['first','edited'] as $text) { file_put_contents('input',$text); check($file('input')===$text,'stale contents'); }
$both=$b->remember($x);$stale=$a->remember($x);
$expected=new DomainException('nested application exception');
$x->hook=static fn()=>throw $expected;
check(reject(fn()=>$b->relay($x,$both(...))->await())===$expected,'worker replaced original Throwable');
$x->hook=null;
$skipped=0;$completed=0;
$skip=$a->relay($x,function($v) use($stale,&$skipped) { ++$skipped;return $stale($v); });
$live=$b->relay($x,function($v) use($both,&$completed) { ++$completed;return $both($v); });
$a->close();
check(reject(fn()=>$skip->await()) instanceof LogicException,'revoked future completed');
check(reject(fn()=>$stale($x)) instanceof LogicException,'revoked function remained usable');
check($live->await()===$x && $completed===1 && $skipped===0,'wrong binding cancelled');
$b->close();$both->close();$stale->close();$file->close();
check(References::count()===0,'worker kept managed references');
echo "file reads and cancellation stayed binding-local\n";
