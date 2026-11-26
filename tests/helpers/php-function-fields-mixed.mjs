/** @file Exercise two mixed callback records through generated PHP and compiled Lean. */
import assert from "node:assert/strict";
import {mkdtemp, readFile, realpath, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import test from "node:test";
import {generateOwnedCPackage} from "../../src/backends/c/owned-package.mjs";
import {generateOwnedPhpCalls} from "../../src/backends/php/owned-calls.mjs";
import {generateOwnedPhpPackage} from "../../src/backends/php/owned-package.mjs";
import {ownedPhpAdapterSources} from "../../src/build/owned-php-artifacts.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {compileOwnedAggregateFixture} from "./owned-aggregate-native.mjs";
import {mixedFunctionFieldsIr} from "./owned-aggregate-fixture.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("native PHP validates both mixed input records before FFI, even for a weak caller", async t => {
	const ir=mixedFunctionFieldsIr(), row=ir.types.find(n=>n.name==="Tariff");
	const pkg=generateOwnedPhpPackage(ir), dir=await mkdtemp(join(tmpdir(),"php-input-validation-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	for(const [name,data] of Object.entries(pkg.files)) if(name.endsWith(".php")) await saveLakeFile(dir,name,data);
	assert.deepEqual(pkg.contract.hostInputRecords,[{type: row.id,input: "TariffInput",lifetime: "call",fields: ["quote","rebate"]}]);
	await saveLakeFile(dir,"probe.php",`<?php
use ${pkg.namespace}\\TariffInput;
use function ${pkg.namespace}\\{apply_tariff_with_host_fields,with_recovery};
require __DIR__.'/src/Api.php';
$cb=fn(int $x): int => $x+1;
$row=new TariffInput($cb,$cb,"ok",2); $refusals=0;
foreach ([fn()=>new TariffInput($cb,$cb,123,2), fn()=>new TariffInput($cb,$cb,"ok",'2'),
          fn()=>apply_tariff_with_host_fields($row,new TariffInput($cb,fn($x,$y)=>0,'ok',1)),
          fn()=>apply_tariff_with_host_fields($row,new TariffInput(with_recovery($cb,'bad'),$cb,'ok',1))]
         as $bad) {
    try { $bad(); throw new RuntimeException('invalid input accepted'); } catch (TypeError $e) { ++$refusals; }
}
try { apply_tariff_with_host_fields($row,$row); } catch (RuntimeException $e) {
    if (!str_contains($e->getMessage(),'Build a compiled native PHP release')) throw $e;
    echo "validated $refusals"; exit;
}
throw new RuntimeException('expected the loader on good input');
`);
	assert.equal(await run(process.env.LEAN_BRIDGE_PHP??"/usr/bin/php",["-n","-d","ffi.enable=0","probe.php"],dir,process.env),"validated 4");
});

test("PHP passes two independently borrowed mixed records to compiled Lean", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const fixture = "leased-closure-fields";
	const configuration = JSON.parse(await readFile(new URL("../fixtures/onboarding/leased-closure-fields/lean-bridge.exports.json",import.meta.url)));
	configuration.exports.push("Owned.compareCards");
	configuration.ownedAggregates.closureFields.push("Owned.PriceCard.quote","Owned.PriceCard.rebate");
	const sourceSuffix = `
namespace Owned
structure PriceCard where
  quote : UInt32 → UInt32
  rebate : UInt32 → UInt32
  label : String
  base : UInt32
def compareCards (left right : PriceCard) : UInt32 :=
  left.quote (right.rebate left.base) + right.quote (left.rebate right.base) +
    10 * left.label.utf8ByteSize.toUInt32 + right.label.utf8ByteSize.toUInt32
end Owned
`;
	const bin = await compileOwnedAggregateFixture(t,{fixture,configuration
		, sourceSuffix,witness: "import Owned\n",hostCallbacks: true
		, stepTimeoutMs: 600000,evidenceName: "php-mixed-record-inputs.json"});
	const options = {hostCallbacks: true}, args = {metadata: bin.metadata,sourceIdentity: bin.sourceIdentity,component: bin.model.component};
	const php = generateOwnedPhpCalls(bin.model.bindingIr, options);
	const c = generateOwnedCPackage({...args,...options,valueCopies: Boolean(php.c.copies?.length)});
	const fn = php.hostRecords.functions.find(f=>f.name==="compareCards");
	assert.deepEqual(fn.hostRecordSlots.map(s=>s.index),[0,1]);
	const [view] = fn.hostRecordSlots.map(s=>php.hostRecords.views.get(s.node.id));
	assert.deepEqual(view.fields.filter(f=>f.host).map(f=>f.name),["quote","rebate"]);
	const dir=bin.directory, env=process.env;
	for(const [path,data] of Object.entries(ownedPhpAdapterSources(c,php))) await saveLakeFile(dir,basename(path),data);
	const objects=["Owned.o","Carriers.o","Witness.o"];
	if(bin.callbackSource) objects.push("Callbacks.o");
	const cc=["-std=c11","-O1","-Wall","-Wextra","-Werror","-fPIC","-shared"
		, "-I.","-Iruntime/include",c.values.prefix+"-php.c",...objects
		, "-Lruntime/lib","-llean_bridge_native","-lleanshared","-lgmp"
		, "-Wl,-z,defs","-Wl,-rpath,$ORIGIN/runtime/lib","-o","libprobe.so"];
	await run("cc",cc,dir,env);
	for(const [path,data] of Object.entries(php.files)) await saveLakeFile(dir,path,data);
	await saveLakeFile(dir,"weak.php",`<?php
function weakInput() { return new \\${php.namespace}\\${view.name}(fn($n)=>$n,fn($n)=>$n,123,'2'); }
`);
	await saveLakeFile(dir,"probe.php",`<?php
declare(strict_types=1);
use ${php.namespace}\\Internal\\{Native, OwnedRuntime, OwnedCallTypes};
use ${php.namespace}\\${view.name};
use function ${php.namespace}\\${fn.publicName};
require __DIR__.'/src/Api.php';
require __DIR__.'/weak.php';
try { weakInput(); throw new RuntimeException('accepted coerced scalar'); } catch (TypeError $e) {}
Native::configure(static fn() => new OwnedRuntime(FFI::cdef(OwnedCallTypes::DEFINITIONS, __DIR__.'/libprobe.so')));
$visits = [];
$f = function(string $key, Closure $map) use (&$visits): Closure {
    return function(int $x) use ($key,$map,&$visits): int { $visits[$key][]=$x; return $map($x); };
};
$a = new ${view.name}($f('aq',fn($x)=>$x*2),$f('ar',fn($x)=>$x+1),"A\\0é",2);
$b = new ${view.name}($f('bq',fn($x)=>$x*3),$f('br',fn($x)=>$x+7),"β",5);
$bad = new ${view.name}($b->quote,fn(int $x,int $y)=>0,$b->label,$b->base);
try { ${fn.publicName}($a,$bad); throw new RuntimeException('accepted invalid second input'); }
catch (ArgumentCountError $e) {}
if ($visits !== []) throw new RuntimeException('partial dispatch');
$result = ${fn.publicName}($a,$b);
ksort($visits);
echo json_encode([$result,$visits],JSON_THROW_ON_ERROR);
`);
	for(const path of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(","))
	{
		const interpreter=await realpath(path);
		const [ffi,ext]=JSON.parse(await run(interpreter,["-n","-r",'echo json_encode([extension_loaded("ffi"),ini_get("extension_dir")]);'],dir,env));
		const flags=ffi?[]:["-d","extension="+await realpath(join(ext,"ffi.so"))];
		assert.deepEqual(JSON.parse(await run(interpreter,["-n",...flags,"-d","ffi.enable=1","-d","display_errors=stderr","probe.php"],dir,env)),
			[78,{aq: [9],ar: [5],bq: [6],br: [2]}]);
	}
});
