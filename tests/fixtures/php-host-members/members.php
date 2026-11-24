<?php
declare(strict_types=1);
use __LB_PUBLIC__\Internal\HostMembers;
require $argv[1];
$model=json_decode(file_get_contents($argv[2]),true,64,JSON_THROW_ON_ERROR);
class Meter {
    public function __construct(public int $level) {}
    public function read(): int {return $this->level;}
    public function identity(): mixed {return $this;}
    public static function doubled(int $n): static {return new static($n*2);}
}
class BrokenMeter extends Meter {
    public \Throwable $failure;
    public function read(): int {throw $this->failure;}
    public function identity(): mixed {return new \stdClass();}
}
class MagicMeter extends Meter {
    public int $fallbacks=0;
    public function __get(string $k): mixed {$this->fallbacks++;return 9;}
    public function __set(string $k,mixed $v): void {$this->fallbacks++;}
}
$n=0;
function check(bool $ok,string $label): void {global $n;if (!$ok) throw new \RuntimeException($label);$n++;}
function refuses(\Closure $fn,string $class): void {
    try {$fn();} catch (\Throwable $e) {check($e instanceof $class,'unexpected '.get_class($e));return;}
    throw new \LogicException('missing rejection');
}
$m=new HostMembers($model,['Box'=>Meter::class]);$s=[];
foreach ($model['members'] as $i=>$spec) $s[$spec['op'].':'.$spec['name']]=$i;
$invoke=static fn(string $key,...$args)=>$m->invoke($s[$key],$args);
[$ok,$box]=$invoke('constructor:create',7);check($ok && $box instanceof Meter,'real constructor');
check($invoke('get:level',$box)===[true,7],'read property');
check($invoke('set:level',$box,19)===[true,null] && $box->level===19,'write property');
check($invoke('method:read',$box)===[true,19],'call method');
check($invoke('method:identity',$box)===[true,$box],'object identity');
[$ok,$other]=$invoke('static-method:doubled',4);check($ok && $other->level===8 && $other!==$box,'static method');
$bad=new BrokenMeter(3);$bad->failure=new \Error('original application Throwable');
check($invoke('method:read',$bad)===[false,$bad->failure],'original application Throwable, not a copy');
refuses(fn()=>$invoke('method:identity',$bad),\TypeError::class);
refuses(fn()=>$invoke('method:read',new \stdClass()),\TypeError::class);
$magic=new MagicMeter(5);unset($magic->level);
refuses(fn()=>$invoke('get:level',$magic),\TypeError::class);
refuses(fn()=>$invoke('set:level',$magic,1),\TypeError::class);
check($magic->fallbacks===0,'unset properties must not call undeclared magic members');
refuses(fn()=>$m->invoke(-1,[]),\UnexpectedValueException::class);
refuses(fn()=>$m->invoke($s['method:read'],['receiver'=>$box]),\UnexpectedValueException::class);
refuses(fn()=>new HostMembers($model,[]),\TypeError::class);
refuses(fn()=>new HostMembers($model,['Box'=>Meter::class,'extra'=>Meter::class]),\TypeError::class);
class Hidden {
    private int $level=1;
    private function read(): int {return 0;}
    public function __call(string $n,array $args): int {return 0;}
}
refuses(fn()=>new HostMembers($model,['Box'=>Hidden::class]),\TypeError::class);
class RefParam {public function __construct(int &$n) {}}
$one=$model;$one['members']=[$model['members'][$s['constructor:create']]];
refuses(fn()=>new HostMembers($one,['Box'=>RefParam::class]),\TypeError::class);
check($invoke('method:read',$box)===[true,19],'failed calls leave unrelated objects usable');
refuses(fn()=>serialize($m),\LogicException::class);
if (PHP_VERSION_ID>=80400) require __DIR__.'/hooks.php';
echo json_encode(['php'=>PHP_VERSION,'checks'=>$n],JSON_THROW_ON_ERROR),"\n";
