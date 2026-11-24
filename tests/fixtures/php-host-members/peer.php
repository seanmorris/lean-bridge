<?php
declare(strict_types=1);
require $argv[1];
class Meter {
    public function __construct(public int $level) {}
    public function identity(): static {return $this;}
    public function read(): int {return $this->level;}
}
class DifferentMeter extends Meter {}
class NestedMeter extends Meter {
    public \Closure $handler;
    public function read(): int {return ($this->handler)();}
}
function check(bool $yes): void {if (!$yes) throw new \RuntimeException('cross-component PHP host invariant');}
$first=$argv[2]==='peer'?'LeanWorkshopPeer\\withHosts':'LeanWorkshop\\withHosts';
$second=$argv[2]==='peer'?'LeanWorkshop\\withHosts':'LeanWorkshopPeer\\withHosts';
$a=$first(['Box'=>Meter::class]); $baseline=LeanBridge\NativeHostV1\References::count();
try { $second(['Box'=>DifferentMeter::class]); throw new \LogicException('incompatible class admitted'); }
catch (\RuntimeException $e) {check(str_contains($e->getMessage(),'status 5'));}
check(LeanBridge\NativeHostV1\References::count()===$baseline);
$b=$second(['Box'=>Meter::class]);
$m=$a->make(11); check($b->identity($m)===$m);
check($b->update($m,17)===17 && $a->read($m)===17);
$n=new NestedMeter(0); $n->handler=fn()=>$b->identity($m)->level;
check($a->read($n)===17);
$thrown=new \Error('nested peer exception'); $n->handler=fn()=>throw $thrown;
try {$b->read($n); throw new \LogicException('expected original');} catch (\Error $e) {check($e===$thrown);}
$a->close(); check($b->identity($m)===$m);
$b->close(); check(LeanBridge\NativeHostV1\References::count()===0);
echo "two components; rollback, object identity, mutation, nested calls, independent close; zero tokens\n";
