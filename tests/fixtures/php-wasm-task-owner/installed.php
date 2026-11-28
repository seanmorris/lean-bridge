<?php
declare(strict_types=1);
use Brick\Math\BigInteger as B;
use function LeanJobs\{checked, closes, exact, hold, io_start, release, series, terminal, text};
function check(bool $ok,string $label): void { if (!$ok) throw new LogicException($label); }
function rejects(string $class,Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { if ($e instanceof $class) return $e; throw $e; }
    throw new LogicException("Missing $class");
}
$large=B::of('4294967295'); $exact=B::of('-1208925819614629174706215');
check(exact($exact)->await()->isEqualTo($exact),'exact integer');
check(text("λ\0🌿")->await()==="λ\0🌿",'UTF-8 with NUL');
$p=hold(); check($p instanceof LeanJobs\HoldTask,'typed task');
rejects(TypeError::class,fn()=>release(42));
rejects(ValueError::class,fn()=>release(B::of('4294967296')));
release($large); $v=$p->await();
check($v->isEqualTo($large) && $p->await()===$v && !$p->cancel(),'late observe, same output object');
$p=hold(); check($p->cancel() && !$p->cancel(),'PHP initiated cancellation');
release(B::of(10));
$e=rejects(LeanJobs\TaskCancelled::class,fn()=>$p->await());
check(rejects(LeanJobs\TaskCancelled::class,fn()=>$p->await())===$e,'cached cancellation');
$p=hold(); unset($p); release(B::of(8));
$err=rejects(LeanJobs\CheckedError::class,fn()=>checked(true,false,$large));
check($err->declaration==='Jobs.checked' && $err->payload->isEqualTo($large),'factory EIO');
$bad=checked(false,true,$large)->await(); $good=checked(false,false,B::of(2))->await();
check($bad instanceof LeanJobs\Err && $bad->value->isEqualTo($large),'returned Err');
check($good instanceof LeanJobs\Ok && $good->value->isEqualTo(9),'returned Ok');
check(rejects(LeanJobs\IOError::class,fn()=>io_start(true))->payload==='factory failed','factory IO');
check(rejects(LeanJobs\TaskIOError::class,fn()=>terminal(true)->await())->payload==='worker failed','terminal IO');
check(terminal(false)->await()->isEqualTo(97),'reuse after failures');
$before=closes(); $items=[];
foreach (series(B::of(3)) as $item) $items[]=(string)$item;
check($items===['0','1','2'] && closes()->isEqualTo($before->plus(1)),'exhaustion and finalizer');
$stream=series(B::of(30)); foreach ($stream as $item) { break; }
check(closes()->isEqualTo($before->plus(2)),'early exit'); $stream->close();
$step=rejects(LeanJobs\SeriesStepError::class,static function(){foreach(series(B::of(413)) as $item){}});
check($step->declaration==='Jobs.next' && $step->payload===413,'typed pull error');
$fresh=series(B::of(2)); unset($fresh);
check(closes()->isEqualTo($before->plus(4)),'never-requested cursor');
echo 'PHP task API: typed await, cancel, release, errors and pull cleanup passed';
