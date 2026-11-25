<?php
declare(strict_types=1);
require __DIR__ . '/installed/vendor/autoload.php';
use LeanDials as D;

function check(bool $ok,string $why): void { if (!$ok) throw new LogicException($why); }
function fails(string $class,Closure $f): Throwable {
    try { $f(); } catch (Throwable $e) { if ($e instanceof $class) return $e; throw $e; }
    throw new LogicException("Did not raise $class");
}
check(D\counts()===0,'initial counters');
if ($argv[1]==='shutdown') {
    $live=D\sequence(3);
    $it=$live->getIterator(); $it->rewind();
    check($it->current()===0 && D\counts()===10100,'one item before process exit');
    // No close or unset. The parent checks the compiled finalizer's file.
    exit(0);
}
$c=D\sequence(3); check($c instanceof IteratorAggregate && D\counts()===10000,'lazy demand');
fails(Error::class,fn()=>clone $c); fails(LogicException::class,fn()=>serialize($c));
foreach ($c as $item) {
    check($item===0 && D\counts()===10100,'first pull');
    fails(LogicException::class,fn()=>iterator_to_array($c));
    break;
}
check(D\counts()===10101 && iterator_to_array($c)===[],'early break');
$c->close();
check(iterator_to_array(D\sequence(2))===[0,1] && D\counts()===20402,'normal exhaustion');
$e=fails(D\CheckedError::class,fn()=>D\checked(0));
check($e->declaration==='Dials.checked' && $e->payload==='factory','typed open');
$c=D\checked(1);
$e=fails(D\CheckedStepError::class,function() use($c) {
    foreach($c as $item) check($item===0,'typed step item');
});
check($e->declaration==='Dials.checkedNext' && $e->payload==='step' && D\counts()===30603,'typed step');
$seen=0;
$e=fails(D\IOError::class,function() use(&$seen) {
    foreach(D\units(1) as $item) {check($item===null,'unit item'); ++$seen;}
});
check($e->declaration==='Dials.nextUnit' && $e->payload==='unit step' && $seen===1 && D\counts()===40804,'IO step');
check(iterator_to_array(D\units(4))===[null,null] && D\counts()===51105,'unit vs exhaustion');
$original=new UnexpectedValueException('caller failure');
$e=fails(UnexpectedValueException::class,function() use($original) { foreach (D\sequence(3) as $_) throw $original; });
check($e===$original && D\counts()===61206,'caller exception closes once');
$c=D\sequence(4);
$it=$c->getIterator(); $it->rewind(); check($it->current()===0,'open suspended iterator');
if (function_exists('pcntl_fork')) {
    file_put_contents('state','parent still owns cursor');
    $pid=pcntl_fork(); check($pid!==-1,'fork');
    if ($pid===0) {
        fails(RuntimeException::class,fn()=>$c->close());
        fails(RuntimeException::class,fn()=>$it->next());
        exit(0);
    }
    check(pcntl_waitpid($pid,$status)===$pid && pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'child cannot enter parent runtime');
    check(file_get_contents('state')==='parent still owns cursor','child shutdown must not finalize a parent cursor');
}
$it->next(); check($it->current()===1,'parent resumes');
$c->close(); $it->next();
check(!$it->valid() && D\counts()===71407,'closed suspended generator');
