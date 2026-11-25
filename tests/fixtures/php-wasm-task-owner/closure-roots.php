<?php
declare(strict_types=1);
use LeanBridge\Internal\PhpWasmObjectsV1\Domain;
require __DIR__.'/../../../src/backends/php/php-wasm-task-objects.php';
final class Meter {
    public ?Closure $onDrop=null;
    public function __destruct() {if ($this->onDrop!==null) ($this->onDrop)();}
}
final class Cap {
    public function __construct(private string $id) {}
    public function key(): string {return $this->id;}
}
function check(bool $ok,string $what): void {if (!$ok) throw new RuntimeException($what);}
$nonce=str_repeat('a',32);$kind='host:'.str_repeat('b',64);$live=[];$next=0;
$mint=static function(string $_) use (&$next,$nonce): Cap {return new Cap('z'.$nonce.':'.++$next);};
$retains=static function(string $_,Cap $c) use (&$live): bool {return isset($live[$c->key()]);};
$factory=new Domain([$kind=>Meter::class],$mint,$nonce,$retains);
$peer=new Domain([$kind=>Meter::class],$mint,$nonce,$retains);
$isolated=new Domain([$kind=>Meter::class],$mint,str_repeat('c',32),$retains);
$scope=$factory->open();$capture=new Meter();$extra=new Meter();
$id=$scope->pin($kind,$capture)->key();$live[$id]=true;$scope->pin($kind,$extra);
$weak=WeakReference::create($capture);$discard=WeakReference::create($extra);unset($capture,$extra);
$scope->close();check($weak->get()!==null && $discard->get()===null,'only the captured object should outlive the call');
$use=$peer->open();check($use->resolve($kind,$id)===$weak->get(),'peer must recover the original PHP object');
try {$isolated->open()->resolve($kind,$id);throw new RuntimeException('foreign interpreter accepted a capture');} catch (UnexpectedValueException) {}
unset($live[$id]);$factory->collect();check($weak->get()!==null,'an active invocation still owns the argument');
$use->close();check($weak->get()===null,'retired capture leaked after the last invocation');
$factory->release();$peer->release();$isolated->release();
$open=static fn()=>new Domain([$kind=>Meter::class],$mint,$nonce,$retains);
$old=$open();$scope=$old->open();$a=new Meter();$b=new Meter();$drops=0;$expected=new LogicException('first destructor');
$a->onDrop=static function() use ($open,$kind,&$live,&$replacement,&$newKey,&$survivor,$expected) {
    $replacement=$open();$s=$replacement->open();$next=new Meter();$survivor=WeakReference::create($next);
    $newKey=$s->pin($kind,$next)->key();$live[$newKey]=true;$s->close();throw $expected;
};
$b->onDrop=static function() use (&$drops) {++$drops;};
foreach ([$a,$b] as $obj) $live[$scope->pin($kind,$obj)->key()]=true;
unset($a,$b,$obj);$scope->close();
try {$old->release();throw new RuntimeException('destructor exception was lost');}
catch (LogicException $error) {check($error===$expected,'wrong destructor exception');}
check($drops===1 && $survivor->get()!==null,'old roots drain without destroying new registry generation');
$again=$replacement->open();check($again->resolve($kind,$newKey)===$survivor->get(),'reentrant binding retains original object');
$again->close();$replacement->release();check($survivor->get()===null,'replacement released its own roots');
echo "PHP retained only the native capture; sibling identity, interpreter isolation and final release passed\n";
