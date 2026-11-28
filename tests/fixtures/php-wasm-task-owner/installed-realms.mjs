/** @file Exercise one installed component in two live, isolated PHP interpreters. */
import assert from "node:assert/strict";
import {PhpNode} from "php-wasm/PhpNode";

/**
 * Keep a captured object alive in the first interpreter while the second runs.
 * The harness rendezvous occurs outside the Lean calls on both profiles.
 *
 * @param descriptor - The installed package supplied to both interpreters.
 * @param threaded - Also leave a real callback task pending at the rendezvous.
 */
export const exerciseRealms=async(descriptor,threaded)=>{
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
$row=null;$rowFn=null;$flipped=null;
__ZEND_RECORD_BEFORE__
$f=${process.env.CHECK_RETURNED_FUNCTIONS==="1"?"$api->remember($box)":"null"};
${threaded?"$pending=$api->project($box,fn($v)=>$v===$box?$api->read($v):throw new LogicException('wrong interpreter'));":""}
vrzno_await((vrzno_shared('gate'))());
__ZEND_RECORD_AFTER__
if ($f!==null) {if ($f(new ${cls}(BigInteger::zero()))!==$box) throw new LogicException('wrong captured interpreter object');$f->close();}
${threaded?"echo $pending->await();$pending->awaitCleanup();":"echo $api->recover_read($box);"}$api->close();`;
		const records=process.env.CHECK_ZEND_RECORDS==="1";
		const before=records?"$row=$api->create_pair($box);$rowFn=$api->choose($row);$flipped=$api->flip($row);$row->close();":"";
		const after=records?"if ($rowFn(true)!==$box || $flipped->lead!==$box || $flipped->sample->toString()!==chr("+String(5+offset)+")) throw new LogicException('record escaped the defining Zend interpreter');$rowFn->close();$flipped->close();":"";
		assert.equal(await php.run(program.replace("__ZEND_RECORD_BEFORE__",before).replace("__ZEND_RECORD_AFTER__",after)),0,err||out);assert.equal(err,"");assert.equal(out,String(5+offset));
	};
	const first=realm("FirstBox",1,()=>{ready();return hold;});
	try
	{
		await Promise.race([opened,first.then(()=>{throw new Error("First interpreter exited before rendezvous");})]);
		await realm("SecondBox",10,()=>Promise.resolve(true));
	} finally
	{resume(true);await first;}
};
