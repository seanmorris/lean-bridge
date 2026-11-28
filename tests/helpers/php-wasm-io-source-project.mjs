/** @file Check ordinary/reviewed IO source admission at the public PHP-Wasm build boundary. */
import assert from "node:assert/strict";
import test from "node:test";
import { cp, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readPhpWasmIOProjectComponent } from "../../src/build/php-wasm-io-project.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const fixture = "tests/fixtures/php-wasm-sync-io";
const setup = async t => {
	const work = await mkdtemp(join(process.env.LEAN_BRIDGE_PHP_WASM_IO_TEST_WORK ?? tmpdir(),"php-wasm-io-source-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const project = join(work,"source"), output = join(work,"release");
	await cp(fixture,project,{recursive: true});
	const configPath = join(project,"lean-bridge.exports.json"), config = JSON.parse(await readFile(configPath));
	return { project, output, config, save: ()=>writeFile(configPath,canonicalJson(config)) };
};
test("PHP-Wasm refuses unimplemented effect grants before looking for tools or writing a release", async t=>{
	const {project,output,config,save} = await setup(t);
	config.nativeEffects = ["filesystem"]; await save();
	await assert.rejects(buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["php-wasm"],environment: {PATH: "/no-tools"}}),/only in-memory synchronous IO/u);
	await assert.rejects(lstat(output),{code: "ENOENT"});
});
const ordinary = process.env.LEAN_BRIDGE_PHP_WASM_IO_REVIEW_FROM;
test("Zend immediate cursors cannot select an OS grant or a task scheduler", async t => {
	const {project,output,config,save} = await setup(t);
	config.iterators = [{open: "Ledger.choose",next: "Ledger.next",close: "Ledger.finish"}];
	for(const [addition, expected] of [
		[{nativeEffects: ["filesystem"]}, /only in-memory synchronous IO/u]
		, [{asyncIterators: [{open: "Ledger.readTotal",next: "Ledger.nextTask",close: "Ledger.finishTask"}]}, /cannot mix immediate Zend iterators with scheduled calls/u]
	]) {
		Object.assign(config,addition); await save();
		await assert.rejects(buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["php-wasm"],environment: {PATH: "/no-tools"}}),expected);
		await assert.rejects(lstat(output),{code: "ENOENT"});
		config.nativeEffects=[];
	}
});
test("native IO still rejects a mismatched source toolchain before trying to compile", async t => {
	const {project,output} = await setup(t);
	await writeFile(join(project,"lean-toolchain"),"leanprover/lean4:v4.31.0\n");
	await assert.rejects(buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: ["php-native"]
		, environment: {PATH: "/no-tools"} }), /require the same pinned Lean toolchain/u);
	await assert.rejects(lstat(output),{code: "ENOENT"});
});
test("public PHP-Wasm build authenticates a reviewed IO API, source notices and error semantics", {skip: !ordinary,timeout: 600_000}, async t=>{
	const {project,output,config,save} = await setup(t);
	const api = JSON.parse(await readFile(join(ordinary,"php-wasm/component/io/binding-ir.json")));
	const review = join(project,"ledger.binding-ir.json"), notice = "Fixture notice for a source-locked PHP-Wasm package.\n";
	delete config.exports; config.package = {licenseFiles: ["LICENSE.txt"]}; await save();
	await writeFile(join(project,"LICENSE.txt"),notice); await writeFile(review,canonicalJson(api));
	try
	{
		await processBuildRunner.capture({command: process.execPath
			, args: [resolve("scripts/lean-bridge.mjs"),"build","--project",project,"--target","php-wasm","--output",output]
			, cwd: project});
	} catch(error)
	{ t.diagnostic(error.details); throw error; }
	const {receipt} = await readVerifiedPackageSetReceipt({receiptPath: join(output,"package-set-receipt.json")});
	assert.equal(receipt.packages.length,3);
	const root = join(output,"php-wasm/component");
	const component = await readPhpWasmIOProjectComponent(root, receipt.profiles[0].runtimeIdentity);
	assert.equal(component.model.sourceIdentity.reviewedBindingIr.semanticSha256,receipt.profiles[0].bindingIrSha256);
	assert.deepEqual(component.model.bindingIr,api);
	const source = JSON.parse(await readFile(join(root,"source-notices.json")));
	const path = source.packages[0].notices.find(f=>f.path === "LICENSE.txt").payload;
	assert.equal(await readFile(join(output,"packages/php-wasm/composer/licenses",path),"utf8"),notice);
	const failOutput = join(project,"../rejected");
	const add = api.declarations.find(d=>d.source.declaration === "Ledger.add");
	add.result.type.name = "bool"; await writeFile(review,canonicalJson(api));
	await assert.rejects(buildCanonicalProject({projectRoot: project,outputRoot: failOutput,targets: ["php-wasm"]}),/Reviewed API differs/u);
	await assert.rejects(lstat(failOutput),{code: "ENOENT"});
});
