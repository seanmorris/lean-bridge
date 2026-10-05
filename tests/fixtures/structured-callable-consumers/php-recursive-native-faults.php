<?php
declare(strict_types=1);
namespace LeanPhpRecursiveProbe\Internal;
define('PHP_RECURSIVE_PROBE_BOOTSTRAP_ONLY',true);
require __DIR__.'/php-recursive-host-faults.php';

$ffi=\FFI::cdef('void fixture_fault_reset(uint64_t); uint64_t fixture_fault_live(void); uint64_t fixture_fault_attempts(void); uint64_t fixture_fault_retired(void); uint64_t fixture_fault_poisoned(void); void fixture_fault_mode(uint32_t); size_t graph_fixture_layout_count(void); size_t graph_fixture_layout(size_t);',$root.'/native/linux-x64/libstructured.so');
$schema=GraphRuntime::schema();
function check(bool $condition,string $message=''): void { ensure($condition,$message); }
eval('namespace LeanPhpRecursiveProbe\\Internal;'.file_get_contents(dirname($argv[1]).'/layout.php'));
$layoutChecks=(int)$ffi->graph_fixture_layout_count();

function exerciseNative(\Closure $operation,mixed $expected,int $target=0): int {
    global $ffi;
    $baseline=live();$nativeBaseline=$ffi->fixture_fault_live();
    $ffi->fixture_fault_reset($target);Faults::$owners=Faults::$scopes=Faults::$frames=[];
    Faults::$count=0;Faults::$target=0;Faults::$marker=new \RuntimeException('unused host marker');
    Faults::$active=true;$failed=false;
    try { ensure($operation()==$expected,'native fault result'); }
    catch(\LeanPhpRecursiveProbe\LeanBridgeError $error) { ensure($error->getCode()===3,$error->getMessage());$failed=true; }
    finally { Faults::$active=false; }
    $attempts=$ffi->fixture_fault_attempts();$ffi->fixture_fault_reset(0);
    unset($error);gc_collect_cycles();
    ensure($failed===($target!==0),'missing native allocation failure');
    foreach([...Faults::$owners,...Faults::$scopes,...Faults::$frames] as $weak) ensure($weak->get()===null,'native fault retained host owner');
    ensure(live()===$baseline,'native identity leak');ensure($ffi->fixture_fault_live()===$nativeBaseline,'native arena leak');
    $runtime=(new \ReflectionProperty(Native::class,'runtime'))->getValue();
    ensure((new \ReflectionProperty(CallableRuntime::class,'contexts'))->getValue($runtime)===[]);
    ensure((new \ReflectionProperty(CallableRuntime::class,'depth'))->getValue($runtime)===0);
    return $attempts;
}
$mode=$argv[2]??'faults';
if($mode==='faults') {
    $baseline=live();$reports=[];$failures=0;
    for($seed=0;$seed<4;++$seed) foreach(cases($seed) as $shape=>[$value,$other]) {
        $held=call('make_'.$shape,[$other]);$paths=[];
        try {
            $operations=[
                'callback'=>fn()=>call('call_'.$shape,[$value,fn($item)=>$other]),
                'repeated'=>fn()=>call('twice_'.$shape,[$value,fn($item)=>$other]),
                'create'=>function() use($shape,$other) {$lease=call('make_'.$shape,[$other]);try{return $other;}finally{$lease->close();}},
                'create-call'=>function() use($shape,$value,$other) {$lease=call('make_'.$shape,[$other]);try{return $lease(true,$value);}finally{$lease->close();}},
                'held-call'=>fn()=>$held(true,$value)
            ];
            foreach($operations as $path=>$operation) {
                $count=exerciseNative($operation,$other);
                // Inline results and creation into Lean-managed storage can
                // require no C arena allocation. Inject every measured attempt.
                ensure(is_int($count) && $count>=0);$paths[$path]=$count;
                for($target=1;$target<=$count;++$target) {
                    exerciseNative($operation,$other,$target);++$failures;
                    ensure(call('call_'.$shape,[$value,fn($item)=>$other])==$other,'native failure recovery');
                }
                ensure(exerciseNative($operation,$other)===$count);
            }
        } finally { $held->close(); }
        unset($held,$operation,$operations);gc_collect_cycles();ensure(live()===$baseline);
        ensure($shape==='option' || array_sum($paths)>0,'pointer-bearing shape never allocated');
        $reports[]=['seed'=>$seed,'shape'=>$shape,'paths'=>$paths];
    }
    ensure($ffi->fixture_fault_live()===0);ensure($ffi->fixture_fault_retired()===0);
    echo json_encode(['checks'=>Faults::$checks,'faults'=>$failures,'clears'=>Faults::$clears,'layoutChecks'=>$layoutChecks,'shapes'=>$reports,
        'liveIdentities'=>live(),'liveNativeAllocations'=>$ffi->fixture_fault_live(),'retirements'=>$ffi->fixture_fault_retired()],JSON_THROW_ON_ERROR),"\n";
} else {
    $number=(int)$mode;ensure($number>=1&&$number<=5);
    $tree=new \LeanPhpRecursiveProbe\TreeBranch([new \LeanPhpRecursiveProbe\TreeLeaf(\Brick\Math\BigInteger::of(7))]);
    $held=call('make_recursive',[$tree]);$before=Faults::$clears;
    $ffi->fixture_fault_mode($number);$caught=null;
    try { $number===5 ? call('make_recursive',[$tree]) : call('call_recursive',[$tree,fn($value)=>$value]); }
    catch(\LeanPhpRecursiveProbe\LeanBridgeError $error) { $caught=$error; }
    ensure($caught!==null && $caught->getCode()===($number===3?5:4),'public malformed-result status');
    ensure(Faults::$clears===$before+($number===5?0:1),'exact root cleanup');
    ensure($ffi->fixture_fault_poisoned()===1);ensure($ffi->fixture_fault_live()===0);
    ensure($ffi->fixture_fault_retired()===($number===3?0:1),'malformed_output_retires_runtime');
    foreach([fn()=>call('make_recursive',[$tree]),fn()=>$held(true,$tree)] as $operation) {
        try {$operation();throw new \RuntimeException('Retired runtime accepted a call');}
        catch(\LeanPhpRecursiveProbe\LeanBridgeError $error) {ensure($error->getCode()===5);}
    }
    unset($operation,$caught,$error);$held->close();ensure(live()===0);ensure($tree->equals($tree));
    echo json_encode(['mode'=>$number,'checks'=>Faults::$checks,'layoutChecks'=>$layoutChecks,'poisoned'=>$ffi->fixture_fault_poisoned(),
        'liveIdentities'=>live(),'liveNativeAllocations'=>$ffi->fixture_fault_live(),'retirements'=>$ffi->fixture_fault_retired()],JSON_THROW_ON_ERROR),"\n";
}
