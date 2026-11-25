/** @file Run inside the moved application with no build tool or source project on its path. */
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import {PhpNode} from "php-wasm/PhpNode";
import {closeTaskRuntime,waitTaskRuntimeIdle,taskRuntimeStats} from "@lean-bridge/runtime";

const [mode,...names]=process.argv.slice(2),descriptors=await Promise.all(names.map(async n=>(await import(n)).default));
// Keep one interpreter parked with a live callback while another uses the
// same compiled component with an unrelated application class.
const exerciseRealms=async descriptor=>{
	let ready,resume;
	const opened=new Promise(resolve=>{ready=resolve;}),hold=new Promise(resolve=>{resume=resolve;});
	const realm=async(cls,offset,gate)=>{
		const php=new PhpNode({version: "8.4",autoTransaction: false,sharedLibs: [descriptor],shared: {gate}});
		let out="",err="";
		php.addEventListener("output",e=>{out+=e.detail.join("");});php.addEventListener("error",e=>{err+=e.detail.join("");});
		await php.binary;
		const program=String.raw`<?php
require '${descriptor.autoload}';
use Brick\Math\BigInteger;
class ${cls} {
    public function __construct(public BigInteger $level) {}
    public function identity(): self {return $this;}
    public function read(): mixed {return $this->level->plus(${offset});}
    public static function fromValue(BigInteger $n): self {return new self($n);}
}
$api=LeanWorkshop\withHosts(['Box'=>${cls}::class]);
$box=$api->make_box(BigInteger::of(5));
$f=${process.env.CHECK_RETURNED_FUNCTIONS==="1"?"$api->remember($box)":"null"};
$pending=$api->project($box,fn($v)=>$v===$box?$api->read($v):throw new LogicException('wrong interpreter'));
vrzno_await((vrzno_shared('gate'))());
if ($f!==null) {if ($f(new ${cls}(BigInteger::zero()))!==$box) throw new LogicException('wrong captured interpreter object');$f->close();}
echo $pending->await();$pending->awaitCleanup();$api->close();`;
		assert.equal(await php.run(program),0,err||out);assert.equal(err,"");assert.equal(out,String(5+offset));
	};
	const first=realm("FirstBox",1,()=>{ready();return hold;});
	try
	{
		await Promise.race([opened,first.then(()=>{throw new Error("First interpreter exited before rendezvous");})]);
		await realm("SecondBox",10,()=>Promise.resolve(true));
	} finally
	{resume(true);await first;}
};
try
{
	const php=new PhpNode({version: "8.4",autoTransaction: false,shared: {testIdle: ()=>waitTaskRuntimeIdle().then(()=>true)},sharedLibs: descriptors.map(d=>mode==="composer"?d.extensions:d)});
	let stdout="",stderr="";php.addEventListener("output",e=>{stdout+=e.detail.join("");});php.addEventListener("error",e=>{stderr+=e.detail.join("");});
	await php.binary;
	const mount=async dir=>{
		await php.mkdir("/"+dir);
		for(const entry of await readdir(dir,{withFileTypes: true}))
		{
			const path=dir+"/"+entry.name;
			if(entry.isDirectory()) await mount(path);else
			{assert.ok(entry.isFile());await php.writeFile("/"+path,await readFile(path));}
		}
	};
	if(mode==="composer") await mount("vendor");
	await php.writeFile("/test.php",await readFile("installed.php"));
	const boot=mode==="composer"?["/vendor/autoload.php"]:descriptors.map(d=>d.autoload);
	const code=await php.run("<?php "+[...boot,"/test.php"].map(p=>"require '"+p+"';").join(" "));
	assert.equal(code,0,stderr || stdout); assert.equal(stderr,"");assert.match(stdout,/^PHP (?:task API: typed await, cancel, release, errors and pull cleanup|callback API: reentry, exception identity and cancellation|lease API: cross-package identity, error ownership and disposal|Zend API: installed class bindings, typed errors, scoped cancellation and cursors) passed$/u);
	if(mode==="embedded" && stdout.startsWith("PHP Zend API:")) await exerciseRealms(descriptors[0]);
	await waitTaskRuntimeIdle(); const stats=taskRuntimeStats();
	for(const k of ["frames","allocations","pending","nativeOwners","notifications",...stats.hostPins===undefined?[]:["hostPins","hostErrors"]]) assert.equal(stats[k],0,k);
	console.log(mode+": "+stdout+"; zero live owners");
} finally
{await closeTaskRuntime();}
