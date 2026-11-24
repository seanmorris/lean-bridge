<?php
declare(strict_types=1);
// Exercise the compiled private owner/worker boundary directly, before Composer packaging.
use __LB_PUBLIC__\Internal\{HostFrame,HostMembers,HostTaskObjects};
use LeanBridge\NativeHostV2\References;
[$script,$root,$assets]=$argv;
require "$root/support.php";
foreach (['host-refs','host-words','io-codec','host-members','host-frame','host-task-objects'] as $file) require "$assets/$file.php";
$model=json_decode(file_get_contents("$root/kernel.json"),true,128,JSON_THROW_ON_ERROR);
$task=$model['task']; $port=$task['port']; $prefix=$model['prefix'];
$defs='typedef int (*php_host_dispatch)(uint64_t,int32_t,const uint64_t*,size_t,uint64_t*,uint32_t*); typedef struct { php_host_dispatch fn; } php_host_gate; '.
    "int {$prefix}_call(uint64_t,php_host_dispatch,int,const uint64_t*,size_t,uint64_t*,uint8_t*,uint32_t*); void {$prefix}_clear(uint64_t*);";
$ffi=FFI::cdef($defs.$port['definitions'],"$root/".$model['component']);
final class Box {
    public function __construct(public int $level) {}
    public function read(): int { return $this->level; }
    public function identity(): self { return $this; }
}
$members=new HostMembers($model['hosts'],['Box'=>Box::class]);
$objects=new HostTaskObjects($ffi,$prefix,$port['dispose'],$members);
$count=0;
function check(bool $ok,string $reason): void { global $count; if (!$ok) throw new RuntimeException($reason); ++$count; }
function callOwner(int $op,array $args=[],array $types=[],string|int $result='unit'): mixed {
    global $ffi,$members,$prefix;
    References::enter(); $failed=true;
    try { [, $v]=HostFrame::call($ffi,$prefix,$members,$op,$args,$types,$result); $failed=false; return $v; }
    finally { References::leave($failed); }
}
function eventually(callable $fn): int {
    $deadline=hrtime(true)+10_000_000_000;
    do { $s=$fn(); if ($s!==1) return $s; usleep(1000); } while (hrtime(true)<$deadline);
    throw new RuntimeException('Timed out waiting for the compiled Lean worker');
}
// Real byte-buffer ABI. Retain the argument storage for the duration of the foreign call.
function inputs(array $values): array {
    global $ffi;
    $a=$ffi->new('lbphp_buffer['.max(1,count($values)).']'); $keep=[];
    foreach ($values as $i=>$v) {
        if ($v===null) continue;
        $b=$ffi->new('uint8_t['.strlen($v).']'); FFI::memcpy($b,$v,strlen($v)); $keep[]=$b;
        $a[$i]->data=FFI::addr($b[0]); $a[$i]->length=strlen($v);
    }
    return [$a,$keep];
}
function unpackPort($out): mixed {
    global $ffi,$objects,$port;
    try {
        if ($out->lease[3]===3) return $objects->resolve(0,FFI::string($ffi->cast('char *',FFI::addr($out->lease[0])),16));
        return $out->length ? FFI::string($ffi->cast('char *',$out->data),$out->length) : '';
    } finally { $dispose=$port['dispose']; $ffi->$dispose(FFI::addr($out)); }
}
function startTask(string $name,array $args,int $expected=0): array {
    global $ffi,$task,$port;
    $i=array_search($name,array_column($task['methods'],'name'),true);
    if ($i===false) throw new RuntimeException("Missing task $name");
    $m=$task['methods'][$i]; $fn=$port['stem'].'_'.$i; $h=$ffi->new('uint64_t[2]'); $t=$ffi->new('uint8_t[1]');
    $out=$ffi->new('lbphp_buffer'); [$in,$keep]=inputs($args);
    $s=$ffi->$fn($in,count($args),FFI::addr($out),$t,1,$h);
    check($s===$expected,"$name start: $s, expected $expected"); return [$m,$fn,$h,unpackPort($out)];
}
function takeTask(array $job,int $expected=0,?int $tag=null): mixed {
    global $ffi;
    [$m,$fn,$h]=$job; $take=$fn.'_take'; $out=$ffi->new('lbphp_buffer'); $t=$ffi->new('uint8_t[1]');
    $s=eventually(fn()=>$ffi->$take($h,FFI::addr($out),$t,1));
    check($s===$expected,$m['name']." take: $s, expected $expected");
    if ($tag!==null) check($t[0]===$tag,'Wrong returned Except tag');
    return unpackPort($out);
}
function callback(array $job,int $slot,mixed $expected,object|int $reply): void {
    global $ffi,$objects;
    [$m,$fn,$h]=$job; $next=$m['names']['next']; $which=$ffi->new('uint32_t[1]');
    check(eventually(fn()=>$ffi->$next($h,$which))===0 && $which[0]===$slot,'Wrong callback slot');
    $arg=$fn.'_arg'; $out=$ffi->new('lbphp_buffer');
    check($ffi->$arg($h,$slot,FFI::addr($out))===0,'Cannot read callback argument');
    check(unpackPort($out)===$expected,'Callback did not receive the exact object or scalar');
    if ($expected instanceof Box) check(callOwner(0,[$expected],[0],'uint32')===$expected->level,'Synchronous reentry from owner callback failed');
    if ($reply instanceof Throwable) {
        $fail=$fn.'_fail'; $msg=$reply->getMessage(); $id=$ffi->new('uint32_t[1]');
        check($ffi->$fail($h,$msg,strlen($msg),$id)===0 && $id[0]===1,'Callback rejection lost its origin'); return;
    }
    $lease=is_object($reply)?$objects->pin(0,$reply):null;
    try {
        [$in,$keep]=inputs([$lease??pack('P',$reply)]);
        $put=$fn.'_reply'; check($ffi->$put($h,$slot,$in)===0,'Worker rejected callback reply');
        if ($lease!==null) $objects->admit(0,$lease);
    } finally { if ($lease!==null) $objects->drop(0,$lease); }
}
callOwner(-2);
$a=new Box(23); $b=new Box(41);
$lease=$objects->pin(0,$a);
check($objects->resolve(0,$lease)===$a,'Initial pin lost object identity');
check(callOwner(0,[$a],[0],'uint32')===23,'Synchronous companion lost owner dispatch');
$relay=startTask('relay',[$lease,null,null]); $objects->admit(0,$lease);
callback($relay,1,$a,$b); callback($relay,2,$b,$a);
check(takeTask($relay)===$a,'Task completion lost object identity');
$project=startTask('project',[$lease,null]); callback($project,1,$a,65);
check(takeTask($project)===pack('P',65),'Scalar callback reply changed');
$select=startTask('select',[pack('P',37),null]); callback($select,1,pack('P',37),$b);
check(takeTask($select)===$b,'Scalar-to-object callback lost identity');
$bad=startTask('project',[$lease,null]); callback($bad,1,$a,new RuntimeException('owner failed'));
check(takeTask($bad,14)===pack('P',1),'Propagated PHP callback ticket changed');
$faulty=startTask('faulty',[$lease,null]); callback($faulty,1,$a,1);
check(str_contains(takeTask($faulty,4),'worker failed'),'Terminal Lean IO failure became a PHP callback failure');
check(str_contains(takeTask(startTask('prepare',[$lease,null,pack('P',1)]),13),'factory refused'),'Factory IO error was not distinguishable from worker IO');
check(takeTask(startTask('either',[$lease]),0,0)===$a,'Returned Except payload lost identity');
check(startTask('checked',[$lease],3)[3]===$a,'Typed factory error lost identity');
$cursor=startTask('open_cursor',[$lease]); $pull=$cursor[0]['names']['pull'];
check($ffi->$pull($cursor[2])===0 && takeTask($cursor)===$a,'Cursor yield lost identity');
check($ffi->$pull($cursor[2])===0 && takeTask($cursor,3)===$a,'Typed cursor error lost identity');
$broken=startTask('open_broken',[$lease]); $pull=$broken[0]['names']['pull'];
check($ffi->$pull($broken[2])===0 && str_contains(takeTask($broken,4),'cursor failed'),'Cursor IO error was reported as a typed object failure');
$pending=startTask('relay',[$lease,null,null]); [$m,$fn,$h]=$pending;
$next=$m['names']['next']; $slot=$ffi->new('uint32_t[1]');
check(eventually(fn()=>$ffi->$next($h,$slot))===0 && $slot[0]===1,'Cancellation test did not reach an outstanding object request');
$close=$m['names']['close']; check($ffi->$close($h)===0,'Could not close the pending task');
[$late,$backing]=inputs([$lease]); $reply=$fn.'_reply';
check($ffi->$reply($h,1,$late)===6,'Closed callback accepted a late object reply');
try { $objects->pin(0,new stdClass()); throw new LogicException('Wrong class admitted'); }
catch (TypeError $e) { check(str_contains($e->getMessage(),'Box'),'Wrong-class diagnostic did not identify the expected class'); }
$orphan=$objects->pin(0,$b);
$objects->drop(0,$lease);
try { $objects->resolve(0,$lease); throw new LogicException('Stale lease admitted'); }
catch (RuntimeException $e) { check(str_contains($e->getMessage(),'status 6'),'Wrong stale-lease failure'); }
callOwner(-1);
check(References::count()===0,'Closed worker left PHP reference tokens behind');
callOwner(-2);
try { $objects->resolve(0,$orphan); throw new LogicException('Retired binding revived a worker lease'); }
catch (RuntimeException $e) { check(str_contains($e->getMessage(),'status 6'),'Wrong retired-binding failure'); }
$objects->drop(0,$orphan); callOwner(-1);
check(References::count()===0,'Reopened binding leaked PHP reference tokens');
echo json_encode(['php'=>PHP_VERSION,'checks'=>$count,'livePhpReferences'=>References::count()],JSON_THROW_ON_ERROR)."\n";
