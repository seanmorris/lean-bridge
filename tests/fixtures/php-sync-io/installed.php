<?php
declare(strict_types=1);
require $argv[1].'/autoload.php';
use Brick\Math\BigInteger;
use LeanJournal\Bytes;

function check(bool $ok,string $what): void {
    global $checks;
    if (!$ok) throw new RuntimeException($what);
    $checks++;
}
function rejects(string $type,Closure $f): Throwable {
    try { $f(); } catch (Throwable $e) {
        check($e instanceof $type, "expected ".$type.", got ".$e::class.": ".$e->getMessage());
        return $e;
    }
    throw new RuntimeException('expected '.$type);
}
$checks=0;
if ($argv[2]==='peer-first') check(LeanCompanion\bump(17)===17,'peer initialized first');
check(LeanJournal\count()===0 && LeanJournal\bump(2)===2,'synchronous ordered state');
check(LeanJournal\echo_(7)===7,'PHP keyword escaped');
if ($argv[2]!=='peer-first') check(LeanCompanion\bump(17)===17,'peer initialized second');
check(LeanCompanion\count()===17 && LeanJournal\count()===2,'independent application state');
foreach (['3',3.0,-1,[],4294967296] as $bad) rejects(is_int($bad)?ValueError::class:TypeError::class,fn()=>LeanJournal\bump($bad));
check(LeanJournal\count()===2,'rejected calls caused no IO');
$binary=Bytes::fromString("\0\xff\r\x00x");
$big=BigInteger::of('18446744073709551615'); $huge=BigInteger::of('12089258196146291747061791234567890');
$samples=['unit'=>null,'bool'=>true,'uint8'=>255,'int8'=>-128,'uint16'=>65535,'int16'=>-32768,'uint32'=>4294967295,
    'int32'=>-2147483648,'int64'=>PHP_INT_MIN,'isize'=>PHP_INT_MAX,'uint64'=>$big,'usize'=>$big,
    'nat'=>$huge,'int'=>$huge->negated(),'float32'=>1.5,'float64'=>-INF,'char'=>"🦊",'string'=>"α\0β",'bytes'=>$binary];
foreach ($samples as $name=>$v) {
    $fn='LeanJournal\\rt_'.$name; $out=$fn($v);
    check($v instanceof BigInteger?$out instanceof BigInteger && (string)$out===(string)$v:
        ($v instanceof Bytes?$out instanceof Bytes && $out->toString()===$v->toString():$out===$v),"scalar: ".$name);
}
check(pack('e',LeanJournal\rt_float64(-0.0))===pack('e',-0.0),'negative zero');
check(is_nan(LeanJournal\rt_float32(NAN)),'float32 NaN');
foreach (['int','nat'] as $name) { $fn='LeanJournal\\rt_'.$name; check((string)$fn(BigInteger::of(0))==='0','canonical zero'); }
rejects(ValueError::class,fn()=>LeanJournal\rt_uint64($big->plus(1)));
rejects(ValueError::class,fn()=>LeanJournal\rt_nat(BigInteger::of(-1)));
rejects(TypeError::class,fn()=>LeanJournal\rt_bytes("\0raw"));
rejects(ValueError::class,fn()=>LeanJournal\rt_string("\xff"));
rejects(ValueError::class,fn()=>LeanJournal\rt_char("ab"));
rejects(ArgumentCountError::class,fn()=>LeanJournal\count(42));
foreach ([false,true] as $reject) foreach ([0,1,2] as $tag) {
    $call=fn()=>LeanJournal\nested($reject,$tag,$huge,"α\0β",$binary);
    if ($reject) {
        $failure=rejects(LeanJournal\NestedError::class,$call);
        check($failure->declaration==='ScalarIO.nested','exact typed failure declaration'); $v=$failure->payload;
    } else $v=$call();
    if ($tag===0) check($v instanceof LeanJournal\Ok && $v->value==="α\0β",'outer Ok');
    elseif ($tag===1) check($v instanceof LeanJournal\Err && $v->value instanceof LeanJournal\Ok && (string)$v->value->value===(string)$huge,'nested Ok');
    else check($v instanceof LeanJournal\Err && $v->value instanceof LeanJournal\Err && $v->value->value->equals($binary),'nested Err');
}
$path=$argv[3].'/record-'.getmypid();
$err=rejects(LeanJournal\IOError::class,fn()=>LeanJournal\read($path));
check($err->declaration==='Journal.read' && str_contains($err->getMessage(),basename($path)),'world error keeps its actual message');
check(LeanJournal\store($path,"payload\n")===null && LeanCompanion\read($path)==="payload\n",'peer observes the file written by Lean');
unlink($path);
$forkCheck=function_exists('pcntl_fork');
if ($forkCheck) {
    $pid=pcntl_fork(); if ($pid===-1) throw new RuntimeException('fork failed');
    if ($pid===0) { try { LeanJournal\count(); exit(2); } catch (RuntimeException $e) { exit(str_contains($e->getMessage(),'fork')?0:3); } }
    pcntl_waitpid($pid,$status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status)===0,'foreign process cannot use inherited runtime');
}
check(LeanJournal\bump(1)===3,'runtime usable after boundary and application errors');
// Independent test observer only; no private symbols in the downstream API.
$observer=FFI::cdef('void lean_bridge_native_runtime_retire(void);');
$observer->lean_bridge_native_runtime_retire();
rejects(LeanJournal\LeanBridgeError::class,fn()=>LeanJournal\count());
rejects(LeanCompanion\LeanBridgeError::class,fn()=>LeanCompanion\count());
echo json_encode(['checks'=>$checks,'order'=>$argv[2],'php'=>PHP_VERSION,'retired'=>true,'forkCheck'=>$forkCheck],JSON_THROW_ON_ERROR),"\n";
