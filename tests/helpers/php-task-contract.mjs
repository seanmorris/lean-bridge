/**
 * Check the published examples, the selected native entries, and the provenance
 * of installed async runs from both author routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generatePhpIOPort } from "../../src/backends/php/io-port.mjs";
import { compilePhpSyncSurface,compilePhpTaskSurface } from "../../src/backends/php/io-surface.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const dir="tests/fixtures/php-tasks", file="docs/evidence/php-task-delivery-20261123.json", env=process.env;
const json=async path=>JSON.parse(await readFile(path,"utf8"));
test("the PHP task producer selects real declarations and the documented consumer runs at installation",async()=>{
	const snippet=async(path,heading)=>(await readFile(path,"utf8")).split(heading+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/php.md","### Await a Lean task or iterate a stream"),await readFile(join(dir,"example.php"),"utf8"));
	const cfg=JSON.parse(await snippet("docs/publish/php.md","### Export tasks and pull streams"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg);
	const source=await readFile("tests/fixtures/c-lean-tasks/Pulse.lean","utf8");
	for(const decl of [...cfg.exports,...cfg.taskExports,...Object.values(cfg.asyncIterators[0])])
		assert.match(source,new RegExp("\\bdef "+decl.split(".")[1]+"\\b","u"));
});
test("native PHP immediate cursors expose a checked byte port without a scheduler",()=>{
	const prefix="lbc_php_"+sha256("example/dials"), t={kind: "primitive",name: "unit"};
	const entry={declaration: "Dials.units",name: "units",parameters: [],result: t,delivery: "iterator",effect: "IO",stepIO: true};
	const wire=generateSyncWire(prefix,[entry]),model={prefix,methods: wire.methods,wire};
	const port=generatePhpIOPort(model),[m]=wire.methods;
	assert.ok(port.symbols.includes(m.names.close) && port.symbols.includes(port.symbols[1]+"_next"));
	assert.ok(!port.symbols.includes(m.names.open) && !port.symbols.includes(m.names.next));
	assert.doesNotMatch(port.definitions,/_poll\(|_take\(|_wait_open\(/u);
	for(const op of ["open","next","close"])
	{
		const invalid=structuredClone(model);
		invalid.methods[0].names[op]="wrong_"+op;
		assert.throws(()=>generatePhpIOPort(invalid),/Invalid checked PHP/u);
	}
});
test("native PHP exports checked task operations but not the raw value, start or take wire",()=>{
	const prefix="lbc_php_"+sha256("lean-bridge/pulse"), t={kind: "primitive",name: "bytes"};
	const entry={declaration: "Pulse.bytes",name: "bytes",parameters: [{name: "v",type: t}],result: t,delivery: "task",effect: "pure"};
	const wire=generateSyncWire(prefix,[entry],{tasks: true}), model={prefix,methods: wire.methods,wire};
	const port=generatePhpIOPort(model), [m]=wire.methods;
	assert.ok(port.symbols.includes(m.names.poll) && port.symbols.includes(m.names.close));
	for(const raw of [m.symbol,m.names.start,m.names.take,wire.clear]) assert.ok(!port.symbols.includes(raw));
	for(const op of ["open","close"]) assert.ok(port.symbols.includes(wire.wait[op]));
	for(const change of [x=>{x.methods[0].names.take="foreign_take";},x=>{x.wire.wait.open="foreign_watch";}])
	{
		const modified=structuredClone(model); change(modified);
		assert.throws(()=>generatePhpIOPort(modified),/Invalid checked PHP/u);
	}
});
test("retained native PHP task observations identify both installed routes and their exact consumer sources",async()=>{
	const pin=await json(file);
	assert.equal(pin.profile,"native-php-task-v1");
	assert.deepEqual(Object.keys(pin.packages).sort(),["ordinary","reviewed"]);
	assert.deepEqual(pin.offlineCLI.archive,pin.packages.ordinary.archive);
	assert.equal(pin.offlineCLI.receiptSha256,pin.packages.ordinary.receiptSha256);
	assert.equal(pin.packages.ordinary.bindingIrSha256,pin.packages.reviewed.bindingIrSha256);
	assert.notEqual(pin.packages.ordinary.receiptSha256,pin.packages.reviewed.receiptSha256);
	const cells=new Set();
	for(const row of pin.reports)
	{
		assert.equal(row.receipt,pin.packages[row.route].receiptSha256); assert.equal(row.live,0);
		assert.ok(row.example && row.shutdown); cells.add([row.route,row.php].join(":"));
	}
	assert.deepEqual([...cells].sort(),["ordinary:8.2.35","ordinary:8.5.10","reviewed:8.2.35","reviewed:8.5.10"]);
	for(const [name,hash] of Object.entries(pin.sources)) assert.equal(sha256(await readFile(join(dir,name))),hash);
});

/**
 * Bind installed observations to archive bytes, compiled selections and a separate CLI rebuild.
 *
 * @param root - Built and separately installed ordinary and reviewed handoffs.
 * @param rebuild - Independent build made with the installed CLI archive.
 */
export const phpTaskEvidence=async(root,rebuild)=>{
	const packages={};
	for(const route of ["ordinary","reviewed"])
	{
		const handoff=join(root,route,"handoff"), api=await json(join(handoff,"binding-ir.json"));
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		await assertJsonSchema("package-set-receipt",receipt);
		const [pkg]=receipt.packages, bindingIrSha256=hashBindingIr(api), evidence=await json(join(handoff,"host-export-evidence.json"));
		assert.equal(pkg.profile,"native-php-task-v1"); assert.equal(pkg.name,"lean-bridge/pulse");
		assert.equal(receipt.profiles[0].bindingIrSha256,bindingIrSha256);
		const input={name: pkg.name,version: pkg.version,api,bindingIrSha256,evidence}, model=compilePhpTaskSurface(input);
		assert.throws(()=>compilePhpSyncSurface(input),/synchronous compiler evidence/u);
		const modes=Object.fromEntries(["task","async-iterator","value"].map(k=>[k,model.methods.filter(m=>(m.delivery??"value")===k).length]));
		assert.deepEqual(modes,{task: 25,"async-iterator": 1,value: 5});
		const altered=structuredClone(input);
		altered.api.declarations.find(d=>d.resultMode==="promise").resultMode="value";
		assert.throws(()=>compilePhpTaskSurface({...altered,bindingIrSha256: hashBindingIr(altered.api)}));
		const port=generatePhpIOPort(model), path=join(handoff,"packages/php-native/composer");
		assert.equal(port.source,await readFile(join(path,"lean-bridge/port.c"),"utf8"));
		assert.equal(port.header,await readFile(join(path,"lean-bridge/php-io-port.h"),"utf8"));
		packages[route]={receiptSha256: result.receiptSha256,bindingIrSha256,archive: pkg.artifacts[0],modes};
	}
	const runs=await json(join(root,"installed-php-tasks-both.json"));
	assert.deepEqual(Object.keys(runs.sources).sort(),["example.php","installed.php","shutdown.php"]);
	for(const [name,hash] of Object.entries(runs.sources)) assert.equal(sha256(await readFile(join(dir,name))),hash);
	const seen=new Set();
	for(const row of runs.reports)
	{
		assert.ok(["8.2.35","8.5.10"].includes(row.php)); assert.equal(row.receipt,packages[row.route].receiptSha256);
		assert.equal(row.fork,row.php==="8.2.35"); assert.equal(row.checks,row.fork ? 92 : 90);
		assert.equal(row.live,0); assert.ok(row.example && row.shutdown); seen.add(row.route+":"+row.php);
	}
	assert.equal(seen.size,4); assert.equal(runs.reports.length,4);
	const cli=await json(join(rebuild,"reproduction.json"));
	const independent=await readVerifiedPackageSetReceipt({receiptPath: join(rebuild,"handoff/package-set-receipt.json")});
	assert.equal(independent.result.receiptSha256,packages.ordinary.receiptSha256);
	assert.equal(cli.receiptSha256,packages.ordinary.receiptSha256); assert.deepEqual(cli.archive,packages.ordinary.archive);
	return {profile: "native-php-task-v1",packages,...runs,offlineCLI: cli};
};
test("native PHP task evidence replays against both archives and an independently installed producer"
	,{skip: !env.LEAN_BRIDGE_PHP_TASK_AUDIT},async()=>{
		assert.deepEqual(await phpTaskEvidence(env.LEAN_BRIDGE_PHP_TASK_AUDIT,env.LEAN_BRIDGE_PHP_TASK_REBUILT),await json(file));
	}
);
