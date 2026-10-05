<?php
declare(strict_types=1);
require __DIR__.'/dependencies/brick-math/autoload.php';
require __DIR__.'/src/Api.php';

use Brick\Math\BigInteger as Big;
use LeanStructured\{TreeLeaf,TreeBranch,LeanClosure,Some,Ok};

readonly class ForeignTree extends \LeanStructured\Tree {}

$checks=0;
$check=static function(bool $value) use (&$checks): void { if(!$value) throw new RuntimeException('Cold generator check '.($checks+1).' failed'); ++$checks; };
$rejects=static function(string $kind,Closure $operation) use ($check): void {
    try { $operation(); throw new RuntimeException('Expected '.$kind); }
    catch(Throwable $error) { $check($error instanceof $kind); }
};
$tree=new TreeLeaf(Big::of(7));
$rejects(TypeError::class,static fn()=>LeanStructured\call_recursive(new stdClass(),static fn($value)=>$value));
$rejects(TypeError::class,static fn()=>LeanStructured\call_recursive($tree,false));
$rejects(TypeError::class,static fn()=>LeanStructured\call_recursive($tree,static function($value){yield $value;}));
$rejects(TypeError::class,static fn()=>LeanStructured\call_recursive($tree,static function(&$value){return $value;}));
$rejects(TypeError::class,static fn()=>LeanStructured\call_recursive($tree,static function &($value){return $value;}));
$rejects(ArgumentCountError::class,static fn()=>LeanStructured\call_recursive($tree));
$rejects(ArgumentCountError::class,static fn()=>LeanStructured\call_recursive($tree,static fn($value)=>$value,null));
$rejects(TypeError::class,static fn()=>LeanStructured\make_recursive(new stdClass()));
$rejects(TypeError::class,static fn()=>LeanStructured\make_recursive(new ForeignTree()));
$rejects(TypeError::class,static fn()=>LeanStructured\make_recursive((new ReflectionClass(TreeLeaf::class))->newInstanceWithoutConstructor()));
$rejects(TypeError::class,static fn()=>LeanStructured\call_array(['gap'=>null],static fn($value)=>$value));
$rejects(TypeError::class,static fn()=>LeanStructured\make_option(new Some(false)));
$rejects(TypeError::class,static fn()=>LeanStructured\make_result(new Some(null)));
$rejects(ValueError::class,static fn()=>LeanStructured\call_array([new Some("\xff")],static fn($value)=>$value));
$rejects(ValueError::class,static fn()=>LeanStructured\call_array([new Some(str_repeat('x',16*1024*1024))],static fn($value)=>$value));
$rejects(ValueError::class,static fn()=>LeanStructured\call_array(array_fill(0,262145,null),static fn($value)=>$value));
$reflection=new ReflectionClass(TreeBranch::class);
$children=$reflection->getProperty('children');$cycle=$reflection->newInstanceWithoutConstructor();$children->setValue($cycle,[$cycle]);
$rejects(ValueError::class,static fn()=>LeanStructured\make_recursive($cycle));
$deep=$tree;
for($depth=0;$depth<129;++$depth){$branch=$reflection->newInstanceWithoutConstructor();$children->setValue($branch,[$deep]);$deep=$branch;}
$rejects(ValueError::class,static fn()=>LeanStructured\make_recursive($deep));
$rejects(ValueError::class,static fn()=>new TreeLeaf(Big::of(str_repeat('9',16385))));
$rejects(Error::class,static fn()=>new LeanClosure());
$constructor=new ReflectionMethod(LeanClosure::class,'__construct');
$check($constructor->isPrivate());
$check((new ReflectionFunction('LeanStructured\\make_recursive'))->getReturnType()->getName()===LeanClosure::class);
$function=new ReflectionFunction('LeanStructured\\call_recursive');
foreach($function->getParameters() as $parameter)$check($parameter->getType()->getName()==='mixed');
$check($function->getReturnType()->getName()==='LeanStructured\\Tree');
$mixed=($argv[1]??'base')==='mixed';
if($mixed) {
    $rejects(TypeError::class,static fn()=>LeanStructured\call_uint32('42',static fn($value)=>$value));
    $rejects(TypeError::class,static fn()=>LeanStructured\call_bool(1,static fn($value)=>$value));
    $rejects(TypeError::class,static fn()=>LeanStructured\wide_unit(false));
    $rejects(TypeError::class,static fn()=>LeanStructured\make_wide_unit(false));
    $check((new ReflectionFunction('LeanStructured\\wide_unit'))->getReturnType()->getName()==='null');
}
$maps=file_get_contents('/proc/self/maps');
$check(is_string($maps) && !str_contains($maps,'/libleanshared.so'));
echo json_encode(['coldChecks'=>$checks,'ffiDisabled'=>!extension_loaded('FFI')||ini_get('ffi.enable')==='0','ffiLoaded'=>extension_loaded('FFI'),'leanLoaded'=>false]),"\n";
