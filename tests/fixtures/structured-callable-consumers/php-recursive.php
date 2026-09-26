<?php
declare(strict_types=0);
require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanStructured\{Payload,PacketEmpty,PacketPayload,PacketCounts,TreeLeaf,TreeBranch,Some,Ok,Err,Bytes,LeanClosure};

$request=json_decode(file_get_contents(__DIR__.'/request.json'),true,512,JSON_THROW_ON_ERROR);
$checks=0; $rejections=0;
function check(bool $condition, string $message=''): void {
    global $checks; ++$checks;
    if (!$condition) throw new RuntimeException('Installed PHP callable assertion '.$checks.': '.$message);
}
function reject(string $class, Closure $operation): Throwable {
    global $rejections;
    try { $operation(); } catch(Throwable $error) {
        check($error instanceof $class,$error::class.': '.$error->getMessage()); ++$rejections; return $error;
    }
    throw new RuntimeException('Expected '.$class);
}
function equal(mixed $first,mixed $second): bool {
    if(get_debug_type($first)!==get_debug_type($second)) return false;
    if($first instanceof Big) return $first->isEqualTo($second);
    if($first instanceof Bytes) return $first->toString()===$second->toString();
    if(is_float($first)) return (is_nan($first)&&is_nan($second)) || pack('d',$first)===pack('d',$second);
    if(is_object($first)) return equal(get_object_vars($first),get_object_vars($second));
    if(is_array($first)) {
        if(array_keys($first)!==array_keys($second)) return false;
        foreach($first as $key=>$value) if(!equal($value,$second[$key])) return false;
        return true;
    }
    return $first===$second;
}
function values(int $seed): array {
    $big=Big::of(2)->power(130+$seed)->plus($seed);
    $payload=new Payload("text\0🌱".$seed,[null,new Some('')],$big,new Some(new Ok([Big::of('18446744073709551615'),null])));
    $tree=new TreeLeaf($big); for($depth=0;$depth<24;++$depth) $tree=new TreeBranch([$tree]);
    return [
        $seed%2 ? [] : [null,new Some("row\0🌱".$seed)],
        $seed%2 ? [] : [new Ok([4294967295,"value\0".$seed]),new Err('error')],
        match($seed%3) { 0=>null,1=>new Some(null),2=>new Some(new Some(null)) },
        $seed%2 ? new Ok(new Some(4294967295)) : new Err(["error\0".$seed]),
        ["tuple\0".$seed,[Bytes::fromString("\x00\xff"),$big]],
        $payload,
        match($seed%3) { 0=>new PacketEmpty(),1=>new PacketPayload('packet',[new Some('row')]),2=>new PacketCounts($big,$big->negated()) },
        $payload,
        $seed%2 ? new TreeBranch([]) : $tree
    ];
}
function exported(string $name): string { return 'LeanStructured\\'.$name; }

$tree=new TreeLeaf(Big::of(7));
reject(TypeError::class,fn()=>LeanStructured\call_recursive(new stdClass(),fn($value)=>$value));
foreach([false,static function($value){yield $value;},static function(&$value){return $value;},static function &($value){return $value;}] as $bad)
    reject(TypeError::class,fn()=>LeanStructured\call_recursive($tree,$bad));
reject(ArgumentCountError::class,fn()=>LeanStructured\call_recursive($tree));
reject(ArgumentCountError::class,fn()=>LeanStructured\call_recursive($tree,fn($value)=>$value,null));
reject(TypeError::class,fn()=>LeanStructured\make_recursive(new stdClass()));
reject(Error::class,fn()=>new LeanClosure());
check(!str_contains(file_get_contents('/proc/self/maps'),'/libleanshared.so'),'invalid calls loaded Lean');

$shapes=['array','list','option','result','tuple','record','variant','alias','recursive'];
$returnTypes=['array','array','?LeanStructured\\Some','LeanStructured\\Ok|LeanStructured\\Err','array','LeanStructured\\Payload','LeanStructured\\Packet','LeanStructured\\Payload','LeanStructured\\Tree'];
foreach($shapes as $index=>$shape) foreach(['call_','twice_','make_'] as $prefix) {
    $fn=new ReflectionFunction(exported($prefix.$shape));
    $arity=$prefix==='make_'?1:2;
    check($fn->isUserDefined()&&!$fn->isVariadic());
    check($fn->getNumberOfParameters()===$arity && $fn->getNumberOfRequiredParameters()===$arity);
    check((string)$fn->getReturnType()===($prefix==='make_'?LeanClosure::class:$returnTypes[$index]),'return '.$prefix.$shape.' '.(string)$fn->getReturnType());
    foreach($fn->getParameters() as $parameter) check((string)$parameter->getType()==='mixed'&&!$parameter->isPassedByReference());
}
for($seed=0;$seed<6;++$seed) {
    $inputs=values($seed); $outputs=values($seed+1);
    foreach($shapes as $index=>$shape) {
        $input=$inputs[$index]; $other=$outputs[$index]; $seen=[];
        $callback=static function($value) use (&$seen,$other): mixed { $seen[]=$value; return $other; };
        $copy=exported('call_'.$shape)($input,$callback);
        check(equal($copy,$other)); check(count($seen)===1&&equal($seen[0],$input));
        if(is_object($other)) check($copy!==$other);
        $seen=[];
        check(equal(exported('twice_'.$shape)($input,$callback),$other));
        check(count($seen)===2&&equal($seen[0],$input)&&equal($seen[1],$other));
        $failure=new Error('Exact exception '.$shape);
        $caught=reject(Error::class,fn()=>exported('call_'.$shape)($input,static function() use ($failure): never { throw $failure; }));
        check($caught===$failure);
        reject(TypeError::class,fn()=>exported('call_'.$shape)($input,fn()=>new stdClass()));
        $lease=exported('make_'.$shape)($input);
        check($lease instanceof LeanClosure && !$lease->isClosed());
        check(equal($lease(true,$other),$input)); check(equal($lease(false,$other),$other));
        reject(ArgumentCountError::class,fn()=>$lease(true));
        reject(TypeError::class,fn()=>$lease(1,$other));
        reject(LogicException::class,fn()=>serialize($lease));
        reject(Error::class,fn()=>clone $lease);
        $lease->close(); $lease->close(); check($lease->isClosed());
        reject(LogicException::class,fn()=>$lease(true,$other));
        check(equal(exported('call_'.$shape)($input,fn($value)=>$value),$input));
    }
    $payload=$inputs[5];
    foreach(['alias','plain'] as $alias) {
        $expected=[new Some($payload),null,new Some($payload)]; $seen=[];
        $result=exported('call_nested_'.$alias)($payload,static function($value) use (&$seen): array { $seen=$value; return $value; });
        check(equal($seen,$expected)); check($result===$payload->text.'<none>'.$payload->text);
        $lease=exported('make_nested_'.$alias)($payload);
        check(equal($lease([]),$expected)); $lease->close();
    }
}
$recursive=null;
$recursive=static function($value,int $depth) use (&$recursive): mixed {
    return $depth===0 ? $value : LeanStructured\call_recursive($value,static fn($inner)=>$recursive($inner,$depth-1));
};
check(equal($recursive($tree,12),$tree));
reject(OverflowException::class,fn()=>$recursive($tree,80));
check(equal($recursive($tree,12),$tree));
$fiber=new Fiber(fn()=>LeanStructured\call_recursive($tree,fn($value)=>$value));
reject(LogicException::class,fn()=>$fiber->start());
$marker=new stdClass(); $weak=WeakReference::create($marker);
$callback=static function($value) use ($marker) { return $value; };
LeanStructured\call_recursive($tree,$callback); unset($callback,$marker); gc_collect_cycles();
check($weak->get()===null,'cached stub retained host callback');
$primitiveChecks=0;
if($request['mixed']) {
    $before=$checks;
    $cases=[
        'unit'=>[null,null], 'bool'=>[false,true], 'uint8'=>[0,255], 'uint16'=>[0,65535], 'uint32'=>[0,4294967295],
        'uint64'=>[Big::of(0),Big::of('18446744073709551615')], 'int8'=>[-128,127], 'int16'=>[-32768,32767],
        'int32'=>[-2147483648,2147483647], 'int64'=>[PHP_INT_MIN,PHP_INT_MAX],
        'nat'=>[Big::of(0),Big::of(2)->power(4096)], 'int'=>[Big::of(2)->power(4096)->negated(),Big::of(2)->power(4096)],
        'float32'=>[-0.0,1.0/3], 'float'=>[-0.0,1.0/3], 'char'=>["\0","🌿"], 'string'=>['',"a\0λ🌿"],
        'bytes'=>[Bytes::fromString(''),Bytes::fromString("\0\xff")], 'usize'=>[Big::of(0),Big::of('18446744073709551615')], 'isize'=>[PHP_INT_MIN,PHP_INT_MAX]
    ];
    check(count($cases)===19); check(LeanStructured\word_bits()===64);
    foreach($cases as $kind=>[$first,$last]) {
        $normalize=$kind==='float32' ? static fn($value)=>unpack('g',pack('g',$value))[1] : static fn($value)=>$value;
        $seen=[];
        $callback=static function($value) use (&$seen,$last): mixed { $seen[]=$value; return $last; };
        check(equal(exported('call_'.$kind)($first,$callback),$normalize($last)));
        check(count($seen)===1&&equal($seen[0],$normalize($first))); $seen=[];
        check(equal(exported('twice_'.$kind)($first,$callback),$normalize($last)));
        check(count($seen)===2&&equal($seen[0],$normalize($first))&&equal($seen[1],$normalize($last)));
        $lease=exported('make_'.$kind)($first);
        check(equal($lease(true,$last),$normalize($first))); check(equal($lease(false,$last),$normalize($last))); $lease->close();
    }
    $seen=[];
    check(LeanStructured\wide_unit(static function(...$values) use (&$seen): mixed { $seen=$values; return null; })===null);
    check($seen===range(1,16)); $wide=LeanStructured\make_wide_unit(null);
    check($wide(...range(1,16))===null); $wide->close(); $primitiveChecks=$checks-$before;
}
$libraries=[];
foreach(explode("\n",file_get_contents('/proc/self/maps')) as $line)
    if(preg_match('~(/[^ ]+/native/linux-x64/[^ ]+)$~',$line,$match)) $libraries[basename($match[1])]=hash_file('sha256',$match[1]);
ksort($libraries); check(count($libraries)===4,'local native assets');
echo json_encode(['checks'=>$checks,'rejections'=>$rejections,'primitiveChecks'=>$primitiveChecks,'shapes'=>$shapes,'seeds'=>6,
    'compiledLean'=>true,'installedPackage'=>true,'publicApiOnly'=>true,'actualPhpBits'=>PHP_INT_SIZE*8,'nativeLibraries'=>$libraries],JSON_THROW_ON_ERROR),"\n";
