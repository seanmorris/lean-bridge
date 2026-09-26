<?php
declare(strict_types=1);
require $argv[1].'/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanStructured\{TreeLeaf,TreeBranch,LeanBridgeError,LeanClosure};
use function LeanStructured\{call_recursive,twice_recursive,make_recursive};

$checks=0;
function check(bool $value,string $label=''): void {
    global $checks;++$checks;if(!$value)throw new RuntimeException('PHP recursive lifetime '.$checks.': '.$label);
}
function reject(string $type,Closure $operation,?int $code=null): Throwable {
    try{$operation();}catch(Throwable $error){check($error instanceof $type,$error::class.': '.$error->getMessage());if($code!==null)check($error->getCode()===$code);return $error;}
    throw new RuntimeException('Expected '.$type);
}
$tree=new TreeBranch([new TreeLeaf(Big::of(2)->power(200)),new TreeBranch([])]);
check(call_recursive($tree,fn($value)=>$value)->equals($tree));
$broker=FFI::cdef('typedef struct { uint32_t abi_version,runtime_state,runtime_init_runs,component_init_runs,attached_components,live_identities; uint64_t runtime_instance_id,identity_domain_id; } Snapshot; void lean_bridge_native_snapshot_read(Snapshot *);',$argv[1].'/vendor/lean-bridge/structured/native/linux-x64/liblean_bridge_native.so');
function live(): int {global $broker;$snapshot=$broker->new('Snapshot');$broker->lean_bridge_native_snapshot_read(FFI::addr($snapshot));return $snapshot->live_identities;}
check(live()===0);
$lease=make_recursive($tree);check(live()===1);
reject(LogicException::class,fn()=>(new Fiber(fn()=>$lease(true,$tree)))->start());
reject(LogicException::class,fn()=>(new Fiber(fn()=>make_recursive($tree)))->start());
check($lease(true,$tree)->equals($tree));
reject(ArgumentCountError::class,fn()=>$lease(...['first'=>true,'second'=>$tree]));
reject(ArgumentCountError::class,fn()=>$lease(true,$tree,$tree));
$closedByFiber=new Fiber(fn()=>$lease->close());$closedByFiber->start();
check($lease->isClosed()&&live()===0);reject(LogicException::class,fn()=>$lease(true,$tree));
foreach([new RuntimeException('exact exception',42,new Exception('cause')),new Error('exact error',43)] as $marker) {
    $trace=$marker->getTrace();$previous=$marker->getPrevious();$count=0;
    $caught=reject(Throwable::class,static function()use($tree,$marker,&$count){return twice_recursive($tree,static function($value)use(&$count,$marker){++$count;throw $marker;});});
    check($caught===$marker&&$caught->getTrace()===$trace&&$caught->getPrevious()===$previous,'exact Throwable and cause');
    check($count===1,'first failure stops later callbacks');
    check(call_recursive($tree,fn($value)=>$value)->equals($tree));check(live()===0);
}
unset($caught,$marker,$previous);
$nested=null;
// A by-reference recursive binding also exercises nested callback frame scopes.
$nested=static function(int $depth)use(&$nested,$tree){return $depth===0?$tree:call_recursive($tree,static fn($value)=>$nested($depth-1));};
check($nested(12)->equals($tree));reject(OverflowException::class,fn()=>$nested(80));check($nested(3)->equals($tree));check(live()===0);
$discarded=make_recursive($tree);$weak=WeakReference::create($discarded);unset($discarded);gc_collect_cycles();check($weak->get()===null&&live()===0);

// Save a stale private token only to verify that the native generation check
// rejects it after the public owner closes and its slot has been reused.
$old=make_recursive($tree);
$internal=(new ReflectionProperty(LeanClosure::class,'lease'))->getValue($old);
$token=(new ReflectionProperty($internal,'token'))->getValue($internal);
$invoke=(new ReflectionProperty($internal,'invoke'))->getValue($internal);
$old->close();$fresh=make_recursive($tree);
reject(LeanBridgeError::class,fn()=>$invoke($token,[true,$tree]),1);
check($fresh(true,$tree)->equals($tree)&&live()===1);$fresh->close();unset($old,$fresh,$internal,$invoke);check(live()===0);

$held=[];
try {
    for($index=0;$index<4096;++$index)$held[]=make_recursive($tree);
    check(live()===4096);reject(LeanBridgeError::class,fn()=>make_recursive($tree),3);
    check($held[0](true,$tree)->equals($tree)&&$held[4095](true,$tree)->equals($tree));
}finally{foreach($held as $item)$item->close();}
unset($held,$item);gc_collect_cycles();check(live()===0);
for($index=0;$index<8192;++$index){$lease=make_recursive($tree);check($lease(true,$tree)->equals($tree));$lease->close();}
unset($lease);check(live()===0);

check(function_exists('pcntl_fork'),'actual fork unavailable');
$lease=make_recursive($tree);$pid=pcntl_fork();check($pid!==-1);
if($pid===0){
    $rejected=0;
    foreach([fn()=>make_recursive($tree),fn()=>$lease(true,$tree),fn()=>$lease->close(),fn()=>$lease->isClosed()]as$operation){
        try{$operation();exit(71);}catch(RuntimeException $error){if(!str_contains($error->getMessage(),'fresh PHP process after fork'))exit(72);++$rejected;}
    }
    exit($rejected===4?0:73);
}
pcntl_waitpid($pid,$status);check(pcntl_wifexited($status)&&pcntl_wexitstatus($status)===0,'fork child rejected every operation');
check(live()===1&&$lease(true,$tree)->equals($tree));$lease->close();check(live()===0);
echo json_encode(['checks'=>$checks,'capacity'=>4096,'recovered'=>8192,'liveIdentities'=>live(),'actualFork'=>true,'simulatedFork'=>false,'staleGenerationRejected'=>true,'gcCleanup'=>true,'fiberInvocationRejected'=>true,'fiberCloseAllowed'=>true],JSON_THROW_ON_ERROR),"\n";
