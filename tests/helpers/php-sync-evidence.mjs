/**
 * Bind native PHP IO evidence to the actual receipts, API and consumer code.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const dir = "tests/fixtures/php-sync-io", file = "docs/evidence/php-sync-io-20261123.json";
const json = async f => JSON.parse(await readFile(f,"utf8"));
const digest = async f => sha256(await readFile(f));
const env = process.env, root = env.LEAN_BRIDGE_PHP_IO_AUDIT;
test("native PHP synchronous IO documentation uses the installed example and a valid producer configuration", async () => {
	const snippet = async (path, heading) => (await readFile(path,"utf8")).split(heading+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/php.md","### Call synchronous IO and handle errors"),await readFile(join(dir,"example.php"),"utf8"));
	const config = JSON.parse(await snippet("docs/publish/php.md","### Export synchronous IO"));
	validateExportConfiguration(config); await assertJsonSchema("lean-export-configuration",config);
	assert.deepEqual(config.nativeEffects,["filesystem"]);
	assert.equal(config.targets["php-native"].name,"lean-bridge/journal");
	const lean = await readFile("tests/fixtures/native-sync-io/Journal.lean","utf8");
	for(const name of config.exports) assert.ok(lean.includes("\ndef "+name.split(".")[1]+" "));
	const assets = ["src/backends/php/io-codec.php","src/backends/php/io-port.mjs","src/backends/php/io-surface.mjs","src/backends/php/io-package.mjs","src/release/php-io-package.mjs"];
	for(const name of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const manifest = await json(name);
		for(const asset of assets) assert.ok((manifest.files ?? manifest.includedFiles).includes(asset));
	}
});

/**
 * Reconstruct an evidence summary from both original and reproduced builds.
 *
 * @param original - Original package handoffs, sources and installed-consumer observations.
 * @param rebuilt - Independent offline CLI reproduction.
 */
export const phpIOEvidence = async (original, rebuilt) => {
	const packages = {}, filename = "package-set-receipt.json", profile = "native-php-io-v1";
	for(const route of ["ordinary","reviewed","peer"])
	{
		const folder = join(original,route), h = join(folder,"handoff");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(h,filename) });
		await assertJsonSchema("package-set-receipt",receipt);
		const ir = await json(join(h,"binding-ir.json")), evidence = await json(join(h,"host-export-evidence.json"));
		const [p] = receipt.packages, bindingIrSha256 = hashBindingIr(ir);
		assert.equal(receipt.packages.length,1); assert.equal(p.profile,profile); assert.equal(p.target,"php-native");
		assert.equal(receipt.profiles[0].bindingIrSha256,bindingIrSha256);
		assert.equal(evidence.selection.synchronousIO,true); assert.deepEqual(evidence.selection.nativeEffects,["filesystem"]);
		const modules = {};
		for(const { module, sourceSha256 } of evidence.interfaces)
		{
			assert.match(module,/^[A-Za-z]+$/u);
			assert.equal(await digest(join(folder,"source",module+".lean")),sourceSha256);
			modules[module] = sourceSha256;
		}
		const reviewed = route === "reviewed";
		assert.equal(evidence.reviewedSourceSha256,reviewed ? await digest(join(folder,"source/public.binding-ir.json")) : null);
		const archive = p.artifacts[0], receiptSha256 = result.receiptSha256;
		const { compilerSha256, extractorSha256, sourceTreeSha256 } = evidence;
		packages[route] = { archive, receiptSha256, bindingIrSha256, modules
			, runtime: p.runtimeIdentity, compilerSha256, extractorSha256
			, sourceTreeSha256, declarations: ir.declarations.length };
		assert.equal(sourceTreeSha256,receipt.source.treeSha256);
	}
	assert.deepEqual(packages.reviewed.modules,packages.ordinary.modules);
	assert.equal(packages.reviewed.bindingIrSha256,packages.ordinary.bindingIrSha256);
	assert.equal(new Set(Object.values(packages).map(p => p.runtime)).size,1);
	const acceptance = join(original,"installed-php-io-v1.json"), { sources, reports } = await json(acceptance);
	assert.deepEqual(Object.keys(sources).sort(),["example.php","installed.php","integrity.php"]);
	for(const [name,hash] of Object.entries(sources)) assert.equal(await digest(join(dir,name)),hash);
	const seen = new Set(); let checks = 0;
	for(const row of reports)
	{
		assert.ok(["ordinary","reviewed"].includes(row.route)); assert.ok(["journal-first","peer-first"].includes(row.order));
		assert.ok(["8.2.35","8.5.10"].includes(row.php)); assert.equal(row.forkCheck,row.php === "8.2.35");
		assert.equal(row.checks,row.forkCheck ? 58 : 57); assert.equal(row.retired,true);
		assert.equal(row.modifiedLibraryRefused,true); checks += row.checks;
		assert.deepEqual(row.receipts,[packages[row.route].receiptSha256,packages.peer.receiptSha256]);
		seen.add([row.route,row.php,row.order].join(":"));
	}
	assert.equal(seen.size,8); assert.equal(reports.length,8); assert.equal(checks,460);
	const repro = await json(join(rebuilt,"reproduction.json"));
	const copy = await readVerifiedPackageSetReceipt({ receiptPath: join(rebuilt,"handoff",filename) });
	assert.equal(copy.result.receiptSha256,repro.receiptSha256); assert.equal(repro.receiptSha256,packages.ordinary.receiptSha256);
	assert.deepEqual(copy.receipt.packages[0].artifacts,[repro.archive]); assert.deepEqual(repro.archive,packages.ordinary.archive);
	const acceptanceSha256 = await digest(acceptance);
	return { profile, packages, sources, reports, checks, acceptanceSha256, offlineCLI: repro };
};
test("original Composer IO handoffs, all installed rows and independent rebuild match their retained pin"
	, { skip: !root }
	, async () => assert.deepEqual(await phpIOEvidence(root,env.LEAN_BRIDGE_PHP_IO_REBUILT),await json(file)));
