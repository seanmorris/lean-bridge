<?php
declare(strict_types=1);
require $argv[1];

use LeanBridge\NativeHostV2\References;
use LeanWorkshopPeer\FailWithError;

class Meter {
    public static int $drops = 0;
    public function __construct(public int $level) {}
    public function identity(): static { return $this; }
    public function read(): int { return $this->level; }
    public function child(): Key { return new Key(); }
    public function childOf(Meter $parent): Key { return $parent->child(); }
    public function __destruct() { ++self::$drops; }
}
class Key { public function identity(): static { return $this; } }
function check(bool $ok,string $label): void { if (!$ok) throw new LogicException($label); }

$order=$argv[2]; $classes=['Box'=>Meter::class,'Key'=>Key::class];
check(in_array($order,['peer','workshop'],true),'unexpected order');
if ($order==='peer') $thrower=LeanWorkshopPeer\withHosts($classes);
$survivor=LeanWorkshop\withHosts(['Box'=>Meter::class]);
if ($order==='workshop') $thrower=LeanWorkshopPeer\withHosts($classes);
$meter=new Meter(23); $weak=WeakReference::create($meter);
$data=$thrower->choose($meter,false);
check($data instanceof LeanWorkshopPeer\Err && $data->value===17,'returned Except is data');
try { $thrower->fail_with($meter); throw new LogicException('missing declared error'); }
catch (FailWithError $error) {
    check($error->declaration==='Workshop.failWith' && $error->payload===$meter,'wrong typed error or identity');
}
$thrower->close(); unset($meter,$thrower,$data); gc_collect_cycles();
check($weak->get()!==null && Meter::$drops===0,'lost payload at throwing-binding close');
check($survivor->identity($error->payload)===$weak->get() && $survivor->update($error->payload,42)===42 && $survivor->read($error->payload)===42,'last error owner unusable in independent package');
unset($error); gc_collect_cycles();
check($weak->get()===null && Meter::$drops===1,'surviving binding kept the last owner');
$survivor->close();
check(References::count()===0,'PHP binding tokens still live');
echo json_encode(['php'=>PHP_VERSION,'order'=>$order,'returned'=>17,'updated'=>42,'drops'=>Meter::$drops,'finalTokens'=>References::count()],JSON_THROW_ON_ERROR),"\n";
