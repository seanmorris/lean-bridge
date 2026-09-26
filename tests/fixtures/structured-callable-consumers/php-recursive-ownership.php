<?php
declare(strict_types=1);
namespace LeanPhpRecursiveProbe\Internal;
define('PHP_RECURSIVE_PROBE_BOOTSTRAP_ONLY',true);
define('PHP_RECURSIVE_OWNERSHIP_PROBE',true);
$mutant=($argv[2]??'baseline')==='reply-scope';
if($mutant) define('PHP_RECURSIVE_REPLY_MUTANT',true);
require __DIR__.'/php-recursive-host-faults.php';

$forward=\FFI::cdef('uint32_t php_recursive_forward(void *,const void *,void *); uint32_t php_recursive_twice(void *,const void *,void *);',$argv[3]);
$runtime=(new \ReflectionProperty(Native::class,'runtime'))->getValue();
$borrow=new \ReflectionMethod(CallableRuntime::class,'borrow');
$contexts=new \ReflectionProperty(CallableRuntime::class,'contexts');
$schema=GraphRuntime::schema();
function span(?\FFI\CData $pointer,int $count,int $width): bool {
    if($count===0) return true;
    if($pointer===null || $count<0 || $width<1 || $count>intdiv(16*1024*1024,$width)) return false;
    $schema=GraphRuntime::schema();$address=$schema->address($schema->ffi->cast('lb_php_graph_byte_pointer',$pointer));$bytes=$count*$width;
    foreach(Faults::$storage as [$weak,$start,$size]) if($weak->get()!==null && $address>=$start && $bytes<=$size && $address-$start<=$size-$bytes) return true;
    return false;
}
function owned(int $type,\FFI\CData $pointer,int $depth=0): bool {
    $schema=GraphRuntime::schema();$node=$schema->nodes[$type];
    if($depth>128 || !span($pointer,1,$node['size'])) return false;
    if($node['kind']==='primitive') {
        if(!$node['aggregate']) return true;
        $data=$schema->readPointer($pointer+16);$count=$schema->ffi->cast('size_t*',$pointer+24)[0];
        return span($data,$count,in_array($node['scalar'],['int','nat'],true)?4:1);
    }
    if($node['element']!==null) {
        $child=$schema->nodes[$node['element']];$count=$schema->ffi->cast('size_t*',$pointer+24)[0];$data=$schema->readPointer($pointer+16);
        if(!span($data,$count,$child['size'])) return false;
        for($index=0;$index<$count;++$index) if(!owned($node['element'],$data+$index*$child['size'],$depth+1)) return false;
        return true;
    }
    $tag=$node['kind']==='variant'?$schema->ffi->cast('uint32_t*',$pointer+16)[0]:(in_array($node['kind'],['option','result'],true)?$pointer[16]:0);
    $branch=$node['branches'][$tag]??null;if($branch===null) return false;
    foreach($branch['fields'] as $field) {
        $at=$pointer+$field['offset'];$child=$field['pointer']?$schema->readPointer($at):$at;
        if($child===null || !owned($field['type'],$child,$depth+1)) return false;
    }
    return true;
}
$errors=[];$valid=0;$expired=0;
foreach(cases(2) as $shape=>[$value,$other]) {
    $fn=array_values(array_filter(CallableTypes::CATALOG['functions'],fn($fn)=>$fn['name']==='call_'.$shape))[0];
    $type=$fn['parameters'][0]['type'];$signature=$fn['parameters'][1]['callback'];
    Faults::$storage=[];
    [$input,$roots]=CallableTransfers::encode([$type],[$value],$type);
    $outputScope=new GraphScope($schema);$output=$outputScope->allocate($schema->nodes[$type]['size']);
    $replyScope=new GraphScope($schema);$frame=new NativeCallableFrame($replyScope);$invoked=0;
    $callback=static function($input) use (&$invoked,$value) {++$invoked;return $value;};
    $descriptor=$borrow->invoke($runtime,$signature,$callback,$frame);
    try {
        ensure($forward->php_recursive_forward(\FFI::addr($descriptor),$roots[0],$output)===0);
        ensure($frame->failure===null && $invoked===1);
        // Check every root and child span against live owners before reading it.
        if(!owned($type,$output)) {
            ensure($mutant,'reply owner expired in baseline');$errors[]=$shape;
        } else { ensure(CallableTransfers::decode($type,$output,$outputScope)==$value);++$valid; }
    } finally {
        $frame->active=false;$active=$contexts->getValue($runtime);
        foreach($frame->ids as $id) unset($active[$id]);$contexts->setValue($runtime,$active);$frame->ids=[];
        $replyScope->close();
    }
    foreach([null,PHP_INT_MAX] as $context) {
        ensure($forward->php_recursive_forward(\FFI::addr($descriptor),$roots[0],$output)===6);++$expired;
        $descriptor->context=$context===null?null:$schema->ffi->cast('void*',$context);
    }
    ensure($forward->php_recursive_forward(\FFI::addr($descriptor),$roots[0],$output)===6);++$expired;
    ensure($invoked===1);$input->close();$outputScope->close();
    unset($input,$outputScope,$replyScope,$frame,$callback,$descriptor,$roots,$output);gc_collect_cycles();
    foreach(Faults::$storage as [$weak]) ensure($weak->get()===null,'ownership probe retained buffer');
    ensure($contexts->getValue($runtime)===[]);
}
ensure($valid===($mutant?1:9));
ensure($errors===($mutant?['array','list','result','tuple','record','variant','alias','recursive']:[]));
ensure(live()===0);
echo json_encode(['checks'=>Faults::$checks,'valid'=>$valid,'expiredContexts'=>$expired,'errors'=>$errors,'checkedBeforeDecode'=>true,'liveIdentities'=>live()],JSON_THROW_ON_ERROR),"\n";
