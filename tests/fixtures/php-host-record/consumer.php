<?php
declare(strict_types=1);
require $argv[1];

use Brick\Math\BigInteger;
use LeanWorkshop\Panel;
use function LeanWorkshop\withHosts;

final class Meter {
    public int $reads=0;
    public ?Throwable $fault=null;
    public function __construct(public int $level) {}
    public function read(): int { ++$this->reads; if ($this->fault) throw $this->fault; return $this->level; }
    public function identity(): self { return $this; }
}
function check(bool $ok,string $what): void { if (!$ok) throw new LogicException($what); }
function rejection(Closure $body): Throwable {
    try { $body(); } catch (Throwable $e) { return $e; }
    throw new LogicException('expected rejection');
}
$binding=withHosts(['Box'=>Meter::class]);
$a=new Meter(4); $b=new Meter(10); $serial=BigInteger::of('123456789012345678901234567890');
$input=new Panel(primary_meter: $a, caption: '温度', limit: 3, serial: $serial, backup_meter: $b);
$out=$binding->swap($input);
check($out->primary_meter===$b && $out->backup_meter===$a && $out->caption==='温度!' && $out->limit===7
    && (string)$out->serial==='123456789012345678901234567891','wrong projected field');
check($binding->combined($input,$out)===18,'two borrowed records');
$before=$a->reads;
foreach ([[new Panel($a,'bad',1,$serial,new stdClass()),TypeError::class],[new Panel($a,'bad',-1,$serial,$b),ValueError::class]] as [$invalid,$expected]) {
    check(rejection(fn()=>$binding->combined($input,$invalid)) instanceof $expected,'wrong input rejection');
    check($a->reads===$before,'first record was read before the second was validated');
    $invalid->close();
}
$a->fault=new DomainException('original'); check(rejection(fn()=>$binding->swap($input))===$a->fault,'lost original exception');
$a->fault=null; check($binding->combined($input,$out)===18,'could not recover');
check(rejection(function() use ($out) { $out->limit=9; }) instanceof LogicException,'writable record');
check(rejection(fn()=>serialize($out)) instanceof LogicException,'serializable record');
$copy=clone $out; $out->close(); $out->close();
check(rejection(fn()=>$out->caption) instanceof LogicException && $copy->backup_meter===$a,'independent cloned lease');
$input->close(); $copy->close();
$budgetMeter=new Meter(12); $weakBudget=WeakReference::create($budgetMeter);
// Each string fits separately. After exporting the first string and meter,
// doubling the same 8 MiB + 1 bytes must fail inside native result lowering.
$overflow=rejection(fn()=>$binding->banner($budgetMeter,str_repeat('p',8*1024*1024+1)));
check($overflow instanceof RuntimeException && str_contains($overflow->getMessage(),'status 12'),'record-wide native budget');
unset($overflow,$budgetMeter); gc_collect_cycles(); check($weakBudget->get()===null,'partial result held its meter');
$small=$binding->banner($a,'small');
check($small->meter===$a && $small->left_caption==='small' && $small->right_caption==='small','small banner after failure');
$small->close();
$first=new Meter(6); $last=new Meter(9);
$seenFirst=WeakReference::create($first); $seenLast=WeakReference::create($last);
$borrowed=new Panel($first,'select',0,$serial,$last);
check(rejection(fn()=>$binding->choose_meter(new stdClass())) instanceof TypeError,'factory accepted a foreign record');
$choose=$binding->choose_meter($borrowed); $borrowed->close(); unset($first,$last);
check($seenFirst->get()!==null && $choose(0)===$seenFirst->get() && $choose(1)===$seenLast->get(),'closure lost captured record fields');
$choose->close(); $choose->close(); gc_collect_cycles();
check($seenFirst->get()===null && $seenLast->get()===null && rejection(fn()=>$choose(0)) instanceof LogicException,'callable did not release both fields');
$only=new Meter(41); $weak=WeakReference::create($only);
$alias=$binding->mirror($only); unset($only); $binding->close();
check($alias->primary_meter===$alias->backup_meter && $weak->get()===$alias->primary_meter,'identity outside binding');
$alias->close(); gc_collect_cycles(); check($weak->get()===null,'last record did not release its object');
check(rejection(fn()=>$alias->__construct($a,'x',1,$serial,$b)) instanceof LogicException,'reopened a closed record');
echo "PHP panel: object identity, strings and large Nat, two-record prevalidation, partial-output cleanup, original exception, independent clone, captured fields and last release\n";
