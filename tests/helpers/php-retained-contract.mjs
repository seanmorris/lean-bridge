/**
 * Check the documented native PHP callback surface and retained acceptance results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { phpRetainedEvidence } from "./php-retained-evidence.mjs";
import { schedulerPackages } from "./php-task-feed.mjs";

const dir="tests/fixtures/php-retained-tasks",file="docs/evidence/php-retained-tasks-20261123.json";
const json=async p=>JSON.parse(await readFile(p,"utf8")),env=process.env;
test("PHP retained callback examples match installed code, selected Lean source and the published CLI",async()=>{
	const snippet=(section,lang)=>section.split("\x60\x60\x60"+lang+"\n")[1].split("\x60\x60\x60")[0];
	const section=async(p,h)=>(await readFile(p,"utf8")).split(h+"\n")[1].split("\n### ")[0];
	const consumer=await section("docs/php.md","### Pass a callback to a Lean worker");
	assert.equal(snippet(consumer,"php"),await readFile(join(dir,"example.php"),"utf8"));
	const publisher=await section("docs/publish/php.md","### Export a task that calls PHP");
	const cfg=JSON.parse(snippet(publisher,"json"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg);
	assert.deepEqual(cfg.exports,["Retained.repeatCall"]); assert.deepEqual(cfg.taskExports,cfg.exports); assert.deepEqual(cfg.taskIOErrors,cfg.exports);
	assert.equal(cfg.targets["php-native"].name,"lean-bridge/retained");
	const lean=await readFile("tests/fixtures/python-retained-tasks/Retained.lean","utf8");
	assert.ok(lean.includes(snippet(publisher,"lean").split("namespace Retained\n\n")[1].split("\n\nend Retained")[0]));
	for(const path of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const o=await json(path); assert.ok((o.files??o.includedFiles).includes("src/backends/php/io-callbacks.php"));
	}
});
test("installed PHP retained callback evidence covers both runtimes and both author routes",async()=>{
	const pin=await json(file),{ordinary,reviewed}=pin.packages;
	assert.equal(pin.profile,"native-php-task-v1"); assert.equal(ordinary.bindingIrSha256,reviewed.bindingIrSha256);
	assert.notEqual(ordinary.receiptSha256,reviewed.receiptSha256); assert.deepEqual(pin.offlineCLI.archive,ordinary.archive);
	assert.equal(pin.offlineCLI.receiptSha256,ordinary.receiptSha256); assert.deepEqual(pin.scheduler,schedulerPackages);
	for(const p of [ordinary,reviewed])
{ assert.equal(p.scalarSlots,19); assert.ok(p.retainedExports>=10); }
	const cells=pin.reports.map(r=>{
		assert.equal(r.receipt,pin.packages[r.route].receiptSha256); assert.ok(r.checks>=55 && r.example && r.shutdown);
		assert.equal(r.live,0); assert.equal(r.fdDelta,0); return r.route+":"+r.php;
	});
	assert.deepEqual(cells.sort(),["ordinary:8.2.35","ordinary:8.5.10","reviewed:8.2.35","reviewed:8.5.10"]);
	for(const [n,hash] of Object.entries(pin.sources)) assert.equal(sha256(await readFile(join(dir,n))),hash);
});
test("native PHP retained callbacks replay against both installed packages and an independent offline producer"
	,{skip: !env.LEAN_BRIDGE_PHP_RETAINED_AUDIT},async()=>{
		assert.deepEqual(await phpRetainedEvidence(env.LEAN_BRIDGE_PHP_RETAINED_AUDIT,env.LEAN_BRIDGE_PHP_RETAINED_REBUILT),await json(file));
	}
);
