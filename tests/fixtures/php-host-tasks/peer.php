<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\DeferredFuture;
use LeanBridge\NativeHostV2\References;

final class Box {
    public function __construct(public int $level) {}
    public function read(): int { return $this->level; }
    public function identity(): self { return $this; }
}
final class OtherBox {
    public function __construct(public int $level) {}
    public function read(): int {return $this->level;}
    public function identity(): self {return $this;}
}
$checks=0;
function check(bool $value,string $message): void {
    global $checks;if (!$value) throw new LogicException($message);++$checks;
}
$order=$argv[1]; $classes=['Box'=>Box::class];
if ($order==='workshop') {
    $a=LeanWorkshop\withHosts($classes);$b=LeanWorkshopPeer\withHosts($classes);
} else {
    $b=LeanWorkshopPeer\withHosts($classes);$a=LeanWorkshop\withHosts($classes);
}
try {LeanWorkshopPeer\withHosts(['Box'=>OtherBox::class]);throw new LogicException('Incompatible PHP class table accepted');}
catch (RuntimeException $e) {check(str_contains($e->getMessage(),'status 5'),'Wrong incompatible binding failure');}
$left=new Box(11); $right=new Box(42);
$size=9*1024*1024;
check($b->count_bytes($left,LeanWorkshopPeer\Bytes::fromString(str_repeat('x',$size)))->await()===$size,'Copied bytes were charged twice');
try { $b->count_bytes($left,LeanWorkshopPeer\Bytes::fromString(str_repeat('x',16*1024*1024+1))); throw new LogicException('Oversized bytes accepted'); }
catch (ValueError $e) {check(str_contains($e->getMessage(),'limit'),'Wrong copied-payload budget error');}
$r=$a->relay($left,function($v) use($b,$left,$right) {
    check($v===$left,'First package changed the input');
    return $b->relay($v,function($n) use($left,$right) {
        check($n===$left,'Second package changed the input');return $right;
    },fn($n)=>$n)->await();
},function($v) use($b,$right) {
    check($v===$right && $b->read($v)===42,'Nested result failed owner reentry');return $v;
})->await();
check($r===$right,'Two independently linked workers changed the object');
$bad=new UnexpectedValueException('peer failed');
try {
    $a->project($left,fn($v)=>$b->project($v,fn($n)=>throw $bad)->await())->await();
    throw new LogicException('Cross-package exception lost');
} catch (UnexpectedValueException $e) {check($e===$bad,'Exception origin lost between workers');}
$onPeer=$b->open_cursor($right);
$entered=new DeferredFuture(); $settle=new DeferredFuture();
$pending=$a->project($left,function($v) use($entered,$settle) {
    $entered->complete();$settle->getFuture()->await();return $v->level;
});
$entered->getFuture()->await(); $a->close();
try {$pending->await();throw new RuntimeException('Producer close did not settle its future');}
catch (LogicException $e) {check(str_contains($e->getMessage(),'closed'),'Wrong close reason');}
$settle->complete(); Amp\delay(0.002);
try {
    $yielded=[];foreach ($onPeer as $v) $yielded[]=$v;
    throw new LogicException('Peer typed error lost');
} catch (LeanWorkshopPeer\OpenCursorStepError $e) {
    check($yielded===[$right] && $e->payload===$right,'Closing producer invalidated peer cursor');
}
check($b->project($left,fn($v)=>$v->level)->await()===11,'Surviving component stopped');
// Only the surviving worker cursor retains this weak-canonical object.
$held=new Box(91);$weak=WeakReference::create($held);
$holding=$b->open_cursor($held);unset($held);gc_collect_cycles();
check($weak->get()!==null,'Active peer cursor lost the object');
$holding->close();gc_collect_cycles();
check($weak->get()===null,'Closed peer cursor retained a weak-canonical object');
$b->close();gc_collect_cycles();
check(References::count()===0,'Cross-package PHP reference leak');
echo json_encode(['php'=>PHP_VERSION,'order'=>$order,'checks'=>$checks,'livePhpReferences'=>References::count()],JSON_THROW_ON_ERROR)."\n";
