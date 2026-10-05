<?php
declare(strict_types=1);
namespace LeanPhpRecursiveProbe\Internal;

use Brick\Math\BigInteger as Big;
use LeanPhpRecursiveProbe\{Some,Ok,Err,Bytes,Payload,PacketPayload,PacketCounts,TreeLeaf,TreeBranch};

require $argv[1].'/vendor/autoload.php';
$root=realpath($argv[1].'/vendor/lean-bridge/structured');
if($root===false) throw new \RuntimeException('Missing installed candidate');

final class Faults {
    public static bool $active=false;
    public static int $checks=0,$count=0,$target=0,$failures=0,$clears=0,$closes=0,$drops=0;
    public static array $owners=[],$scopes=[],$frames=[],$storage=[];
    public static ?\Closure $deferred=null;
    public static \Throwable $marker;
    public static function tick(): void {
        if(self::$deferred!==null) { $action=self::$deferred; self::$deferred=null; $action(); }
        if(self::$active && ++self::$count===self::$target) throw self::$marker;
    }
    public static function owner(\FFI\CData $value): void {
        if(self::$active) self::$owners[]=\WeakReference::create($value);
        if(\defined('PHP_RECURSIVE_OWNERSHIP_PROBE')) {
            $schema=GraphRuntime::schema();
            $pointer=$schema->ffi->cast('lb_php_graph_byte_pointer',\FFI::addr($value[0]));
            self::$storage[]=[\WeakReference::create($value),$schema->address($pointer),\FFI::sizeof($value)];
        }
        self::tick();
    }
    public static function scope(object $value): void { if(self::$active) self::$scopes[]=\WeakReference::create($value); }
    public static function frame(object $value): void { if(self::$active) self::$frames[]=\WeakReference::create($value); }
    public static function closed(bool $empty): void { ensure($empty,'scope owners'); ++self::$closes; }
    public static function cleared(GraphScope $scope,\FFI\CData $output,int $size): void {
        ensure($size>=16 && \FFI::string($output,16)===str_repeat("\0",16),'native root owner was not cleared'); ++self::$clears;
    }
}
function ensure(bool $condition,string $message=''): void {
    ++Faults::$checks;
    if(!$condition) throw new \RuntimeException('PHP host fault assertion '.Faults::$checks.': '.$message);
}
function replace(string $source,string $from,string $to,int $expected=1): string {
    $source=str_replace($from,$to,$source,$count); ensure($count===$expected,'instrumentation '.$from.' count '.$count); return $source;
}
// Evaluate renamed, instrumented source in memory. The installed bytes and ZIP
// remain unchanged. Retain the normal verified loader and exact native assets.
foreach(['Api.php','Internal/GraphTypes.php','Internal/Values.php','Internal/GraphNativeTypes.php','Internal/GraphNative.php','Internal/CallableTypes.php','Internal/CallableRuntime.php','Internal/Native.php'] as $file) {
    $source=file_get_contents($root.'/src/'.$file); ensure(str_starts_with($source,'<?php'));
    $source=substr($source,5);
    $source=preg_replace('~^require_once [^\n]*;\n~m','',$source);
    $source=str_replace('LeanStructured','LeanPhpRecursiveProbe',$source);
    $source=str_replace('__DIR__',var_export(dirname($root.'/src/'.$file),true),$source);
    if($file==='Internal/Values.php') $source=replace($source,'$this->bytes -= $count * $width;','$this->bytes -= $count * $width; Faults::tick();');
    if($file==='Internal/GraphNative.php') {
        $source=replace($source,'public static function checkpoint(): void {}','public static function checkpoint(): void { Faults::tick(); }');
        $source=replace($source,'$this->owners[] = $owner;','$this->owners[] = $owner; Faults::owner($owner);');
        $source=replace($source,'$this->storage = new GraphBudget(); $this->native = new GraphBudget();','$this->storage = new GraphBudget(); $this->native = new GraphBudget(); Faults::scope($this);');
        $source=replace($source,'public function close(): void { $this->owners = []; }','public function close(): void { $this->owners = []; Faults::closed($this->owners === []); }');
    }
    if($file==='Internal/CallableRuntime.php') {
        if(\defined('PHP_RECURSIVE_REPLY_MUTANT')) {
            $source=replace($source,'$reply=CallableTransfers::encodeReply($cb[\'result\'][\'type\'],$result,$frame->scope);',
                '$premature=new GraphScope($schema); $reply=CallableTransfers::encodeReply($cb[\'result\'][\'type\'],$result,$premature);');
            $source=replace($source,'\\FFI::memcpy($destination,$reply,$node[\'size\']);',
                '\\FFI::memcpy($destination,$reply,$node[\'size\']); $premature->close(); unset($premature,$reply);');
        }
        if(\defined('PHP_RECURSIVE_RETIRE_MUTANT')) $source=replace($source,
            'if ($this->ffi!==null) $this->ffi->{$this->catalog[\'prefix\'].\'_graph_retire\'}();',
            '/* Deliberate missing-retirement mutation, isolated probe only. */');
        $source=replace($source,'public function __construct(public readonly GraphScope $scope) {}','public function __construct(public readonly GraphScope $scope) { Faults::frame($this); }');
        $source=replace($source,'$frame->ids[]=$id; $this->contexts[$id]=[$signature,$callback,$frame];','$frame->ids[]=$id; $this->contexts[$id]=[$signature,$callback,$frame]; Faults::tick();');
        $source=replace($source,'$lease->adopt($identity); $scope->schema->ffi->cast(\'uint64_t *\',$output)[0]=0;','Faults::tick(); $lease->adopt($identity); $scope->schema->ffi->cast(\'uint64_t *\',$output)[0]=0; Faults::tick();');
        $source=replace($source,'$this->ffi->{$this->catalog[\'prefix\'].\'_php_graph_clear\'}($output);','$this->ffi->{$this->catalog[\'prefix\'].\'_php_graph_clear\'}($output); Faults::cleared($scope,$output,$result[\'size\']);');
        $source=replace($source,'if ($token !== 0) ($this->dispose)($token);','if ($token !== 0) { ($this->dispose)($token); ++Faults::$drops; }');
    }
    if($file==='Internal/Native.php') $source=replace($source,'return (self::$wrap)($value);','Faults::tick(); $wrapped=(self::$wrap)($value); Faults::tick(); return $wrapped;');
    eval($source);
}
unset($source);
// Initializing through the public loader also verifies every native asset. Use
// an inline option so the deliberate reply-scope mutant never reads freed data.
$initial=new Some(null); Native::call('call_option',[$initial,fn($value)=>$value]); unset($initial);
$broker=\FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } Snapshot; void lean_bridge_native_snapshot_read(Snapshot *);',$root.'/native/linux-x64/liblean_bridge_native.so');
function live(): int {
    global $broker;
    $snapshot=$broker->new('Snapshot'); $broker->lean_bridge_native_snapshot_read(\FFI::addr($snapshot)); return $snapshot->live_identities;
}
function call(string $name,array $arguments): mixed { return Native::call($name,$arguments); }
function exercise(\Closure $operation,mixed $expected,int $target=0,string $kind=\RuntimeException::class): int {
    $baseline=live();
    Faults::$owners=Faults::$scopes=Faults::$frames=[];
    Faults::$count=0; Faults::$target=$target; Faults::$marker=new $kind('injected PHP callable failure');
    Faults::$active=true; $failed=false;
    try { ensure($operation()==$expected,'wrong successful result'); }
    catch(\Throwable $error) { ensure($error===Faults::$marker,$error::class.': '.$error->getMessage()); $failed=true; ++Faults::$failures; }
    finally { Faults::$active=false; }
    unset($error); gc_collect_cycles();
    ensure($failed===($target!==0),'missing injected failure');
    foreach([...Faults::$owners,...Faults::$scopes,...Faults::$frames] as $weak) ensure($weak->get()===null,'retained owner/scope/frame');
    $runtime=(new \ReflectionProperty(Native::class,'runtime'))->getValue();
    ensure((new \ReflectionProperty(CallableRuntime::class,'contexts'))->getValue($runtime)===[],'retained context');
    ensure((new \ReflectionProperty(CallableRuntime::class,'depth'))->getValue($runtime)===0,'retained depth');
    ensure(live()===$baseline,'native identity leak');
    return Faults::$count;
}
function cases(int $seed): array {
    $big=Big::of(2)->power(128+$seed)->plus($seed);
    $rows=[null,new Some(''),new Some("copied\0λ".$seed)];
    $record=new Payload("record\0".$seed,$rows,$big,new Some(new Ok([Big::of('18446744073709551615'),null])));
    $other=new Payload('other'.$seed,[new Some('x')],Big::of(42),new Some(new Err('bad')));
    $tree=new TreeLeaf($big);for($depth=0;$depth<$seed+2;++$depth) $tree=new TreeBranch([$tree,new TreeBranch([])]);
    return [
        'array'=>[$rows,[new Some('other'),null]],
        'list'=>[[new Ok([4294967295,'ok']),new Err('bad')],[new Err('other'),new Ok([0,''])]],
        'option'=>[new Some(new Some(null)),new Some(null)],
        'result'=>[new Err(["bad\0",'']),new Ok(new Some(4294967295))],
        'tuple'=>[["tuple\0",[Bytes::fromString("\0\xff"),$big]],['other',[Bytes::fromString("\x80"),Big::of(1)]]],
        'record'=>[$record,$other], 'variant'=>[new PacketPayload('packet',$rows),new PacketCounts($big,$big->negated())],
        'alias'=>[$record,$other], 'recursive'=>[$tree,new TreeBranch([new TreeLeaf(Big::of($seed)),new TreeBranch([])])]
    ];
}
if(\defined('PHP_RECURSIVE_PROBE_BOOTSTRAP_ONLY')) return;
$tree=new TreeLeaf(Big::of(0)); call('call_recursive',[$tree,fn($value)=>$value]);
$baseline=live();$reports=[];
for($seed=0;$seed<4;++$seed) foreach(cases($seed) as $shape=>[$value,$other]) {
    $held=call('make_'.$shape,[$other]); $paths=[];$before=Faults::$failures;
    try {
        $operations=[
            'callback'=>fn()=>call('call_'.$shape,[$value,fn($item)=>$other]),
            'repeated'=>fn()=>call('twice_'.$shape,[$value,fn($item)=>$other]),
            'create'=>function() use($shape,$other) {$lease=call('make_'.$shape,[$other]);try{return $other;}finally{$lease->close();}},
            'create-call'=>function() use($shape,$value,$other) {$lease=call('make_'.$shape,[$other]);try{return $lease(true,$value);}finally{$lease->close();}},
            'held-call'=>fn()=>$held(true,$value)
        ];
        foreach($operations as $path=>$operation) {
            $count=exercise($operation,$other);ensure($count>0);$paths[$path]=$count;
            foreach([\RuntimeException::class,\Error::class] as $kind) for($target=1;$target<=$count;++$target) {
                exercise($operation,$other,$target,$kind);
                ensure(call('call_'.$shape,[$value,fn($item)=>$other])==$other,'recovery');
            }
            ensure(exercise($operation,$other)===$count,'unstable checkpoint count');
        }
    } finally { $held->close(); }
    unset($held,$operations,$operation);gc_collect_cycles();ensure(live()===$baseline,'held identity retained');
    $lease=call('make_'.$shape,[$value]);
    Faults::$deferred=function() use($lease,$baseline) {$lease->close();ensure($lease->isClosed()&&live()===$baseline+1,'early active close');};
    ensure($lease(true,$other)==$value);
    ensure($lease->isClosed()&&live()===$baseline&&Faults::$deferred===null,'deferred disposal');unset($lease);
    $faults=Faults::$failures-$before;ensure($faults===2*array_sum($paths));
    $reports[]=['shape'=>$shape,'seed'=>$seed,'paths'=>$paths,'faults'=>$faults];
}
ensure(live()===$baseline);
echo json_encode(['checks'=>Faults::$checks,'faults'=>Faults::$failures,'clears'=>Faults::$clears,'closes'=>Faults::$closes,'drops'=>Faults::$drops,
    'shapes'=>$reports,'liveIdentities'=>live(),'installedPackageUnchanged'=>true,'inMemoryInstrumentation'=>true],JSON_THROW_ON_ERROR),"\n";
