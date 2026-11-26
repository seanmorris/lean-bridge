/** @file Cancel a genuinely parked Lean pull from the installed Zend application. */
import assert from "node:assert/strict";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {exercisePhpTaskRelease} from "./php-wasm-task-installed.mjs";

const fx = resolve("tests/fixtures"), routes = ["ordinary","reviewed"];
const read = async path => JSON.parse(await readFile(path));
const added = ["openRead","readPulls","readCloses","releaseRead","finishedRead","readySibling","onRead"].map(n=>"Parked."+n);
const buildSets = async (work,sets) => {
	let ordinary;
	for (const route of routes) {
		const project = join(work,route+"-src"), output = join(work,route+"-out");
		await cp(join(fx,"javascript-wasm-generated-tasks"),project,{recursive:true});
		await copyFile(join(fx,"javascript-parked-reader/Reader.lean"),join(project,"Reader.lean"));
		await copyFile(join(fx,"php-wasm-task-owner/Parked.lean"),join(project,"Parked.lean"));
		await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname="Reader"\n[[lean_lib]]\nname="Parked"\n');
		const config = join(project,"lean-bridge.exports.json"), cfg = await read(config);
		cfg.modules.push("Parked"); cfg.exports.push(...added);
		cfg.taskExports.push("Parked.finishedRead","Parked.readySibling","Parked.onRead");
		cfg.taskIOErrors.push("Parked.onRead");
		cfg.asyncIterators.push({open:"Parked.openRead",next:"Parked.takeRead",close:"Parked.closeRead"});
		cfg.targets={"php-wasm":{npm:{name:"@example/jobs-php",version:"1.0.0"},composer:{name:"example/lean-jobs",version:"1.0.0"}}};
		if (route==="reviewed") {
			delete cfg.exports; await writeFile(join(project,"jobs.binding-ir.json"),canonicalJson(ordinary));
		}
		await writeFile(config,canonicalJson(cfg));
		try {await buildCanonicalProject({projectRoot:project,outputRoot:output,targets:["php-wasm"]});}
		catch (err) {throw new Error("PHP-Wasm "+route+": "+err.message+" "+JSON.stringify(err.details),{cause:err});}
		const api = await read(join(output,"binding-ir.json"));
		if (!ordinary) ordinary=api; else assert.deepEqual(api,ordinary);
		const dest = join(sets,route); await copyPackageSetHandoff(output,dest);
		for (const name of ["binding-ir.json","host-export-evidence.json"]) await copyFile(join(output,name),join(dest,name));
		await rm(project,{recursive:true}); await rm(output,{recursive:true});
	}
};

test("wasm32 PHP interrupts an outstanding read in a callback before the worker drains", {timeout:7_200_000}, async t=>{
	const env=process.env, replay=env.LEAN_BRIDGE_ZEND_READER_REPLAY,keep=env.LEAN_BRIDGE_ZEND_READER_KEEP;
	assert.ok(!(replay && keep));
	const work=await mkdtemp(join(tmpdir(),"zend-reader-")); t.after(()=>rm(work,{recursive:true,force:true}));
	const sets = replay ? resolve(replay) : await mkdtemp(join(keep ?? work,"handoffs-"));
	t.diagnostic("Handoffs: "+sets);
	if (!replay) await buildSets(work,sets);
	const output=resolve(env.LEAN_BRIDGE_ZEND_READER_RESULTS ?? "build/zend-parked-reader");
	await mkdir(output,{recursive:true});
	const receipts=new Set();
	const clientSha256=sha256(await readFile(join(fx,"php-wasm-task-owner/parked.php")));
	for(const route of routes) {
		const handoff=join(sets,route);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath:join(handoff,"package-set-receipt.json")});
		const api=await read(join(handoff,"binding-ir.json")),source=await read(join(handoff,"host-export-evidence.json"));
		assert.equal(source.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(source.reviewedSourceSha256,route==="ordinary"?null:sha256(canonicalJson(api)));
		assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));
		assert.ok(!receipts.has(result.receiptSha256));receipts.add(result.receiptSha256);
		const executions=await exercisePhpTaskRelease(handoff,t,undefined,false,false,false,false,false,{parked:true});
		assert.deepEqual(Object.keys(executions).sort(),["chromium","composer","embedded"]);
		for(const line of Object.values(executions)) assert.match(line,/parked reader cancelled before gate, zero items, late 73, one finalizer/u);
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256:result.receiptSha256,source:source.sourceTreeSha256,
			reviewedSourceSha256:source.reviewedSourceSha256,interface:hashBindingIr(api),clientSha256,
			archives:receipt.packages.map(p=>({name:p.name,...p.artifacts[0]})),executions}));
	}
});
