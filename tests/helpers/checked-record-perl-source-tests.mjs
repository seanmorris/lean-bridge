/**
 * Check Perl payload-mirror generation independently of installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { projectPerlNames } from "../../src/backends/perl/naming.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { checkedRecordContracts, checkedRecordFixture, checkedRecordReview } from "./checked-record-fixture.mjs";
import { readCheckedRecordRemainingHostsArchive } from "./checked-record-remaining-hosts-archive.mjs";

const moduleName = "LeanBridge::CheckedRecords";
const receipt = {
	library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
	, runtimeIdentity: "c".repeat(64), initializer: "initialize_CheckedRecords"
};
let archive;
const modelFor = async route => {
	// These are authenticated native models, not claims that Perl previously ran them.
	archive ??= readCheckedRecordRemainingHostsArchive();
	const { files } = await archive;
	const native = JSON.parse(files.get(`${route}/build-0/model.json`));
	return { ...native, moduleName, exports: projectPerlNames(moduleName, native.exports) };
};

for(const route of ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"])
	test(`Perl checked-record source uses payload mirrors and selected constructors for ${route}`, async () => {
		const model = await modelFor(route), before = structuredClone(model);
		const files = generatePerlBindingPackage(model, receipt);
		const xs = files["Component.xs"], pod = files["lib/LeanBridge/CheckedRecords.pm"];
		const adapters = generateCompiledNativeLeanAdapters(model);
		assert.deepEqual(model, before);
		assert.ok(pod.includes("=head1 CHECKED RECORDS"));
		assert.ok(pod.includes("payload fields"));
		assert.ok(pod.includes("without changing the caller's record"));
		assert.ok(pod.includes("No proof object or input constructor"));
		assert.ok(!pod.includes("=head1 BOUNDED INTEGERS"));
		assert.ok(!pod.includes("Checked Lean Fin bounds:"));
		assert.doesNotMatch(xs, /lean_alloc_ctor/u, "XS must not construct source records by layout");
		for(const item of model.exports)
		{
			const start = xs.indexOf(`\n${item.publicName}(...)\n`);
			assert.ok(start > 0, item.publicName);
			const next = xs.indexOf("\nvoid\n", start + 1);
			const body = xs.slice(start, next < 0 ? undefined : next);
			assert.ok(body.includes(`${item.symbol}(`));
			for(const [index, tree] of item.refinements.parameters.entries())
			{
				if(tree === null) continue;
				assert.equal(tree.kind, "checked-record");
				const validation = `lean_inc(a${index}); if (!${item.symbol}_refinement_${index}(a${index}))`;
				assert.ok(body.includes(validation));
				assert.ok(body.indexOf(validation) < body.indexOf(`lean_object *checked = ${item.symbol}(`));
				const parameter = model.bindingIr.declarations.find(declaration => declaration.source.declaration === item.name).parameters[index].name;
				assert.ok(body.includes(`${parameter} was rejected by ${tree.constructor}`));
				assert.ok(pod.includes(`${parameter} checked by ${tree.constructor}`));
				assert.ok(adapters.leanSource.includes(`_root_.${tree.constructor} value.`));
			}
		}
		for(const type of model.types.filter(type => type.kind === "record"))
		{
			assert.ok(adapters.leanSource.includes(`structure LbErased.${type.name} where`));
			assert.ok(adapters.leanSource.includes(`LbErased.${type.name}.mk`));
			assert.ok(!adapters.leanSource.includes(`_root_.${type.name}.mk`));
			for(const proof of type.erased) assert.ok(!pod.includes(`sub ${proof} `));
		}
		if(route.startsWith("result-only-"))
		{
			assert.equal(model.exports.length, 1);
			assert.doesNotMatch(xs, /_refinement_\d+\(/u);
			assert.doesNotMatch(pod, /checked by CheckedRecords\./u);
			assert.ok(pod.includes("result projects proof-backed record payload fields"));
		}
	});

test("Perl checked-record package reader enables constructors for every package mode", async () => {
	const source = await readFile("src/release/cpan-package.mjs", "utf8");
	assert.ok(source.includes("nativeCheckedRecords: true"));
	for(const capability of [
		"ownedGraphs", "ownedHostCallbacks", "ownedInputTransfers"
		, "ownedAnchoredResults", "ownedReceiverExports"
		, "ownedCallbackResultAnchors"
	]) assert.ok(source.includes(`${capability}: isOwned`), capability);
	assert.doesNotMatch(source, /nativeCallbackRefinements: true/u);
});

for(const route of ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"])
	test(`fresh Lean compiles checked-record Perl mirror adapters for ${route}`, {
		skip: process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_LEAN_TEST !== "1"
		, timeout: 900_000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-perl-source-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project");
		await cp(checkedRecordFixture, projectRoot, { recursive: true });
		const expected = checkedRecordReview(), resultOnly = route.startsWith("result-only-");
		const reviewed = route.endsWith("reviewed-ir");
		if(resultOnly)
		{
			expected.declarations = expected.declarations.filter(item => item.name === "repeated");
			expected.types = expected.types.filter(item => item.name === "Triple");
		}
		const contracts = checkedRecordContracts();
		const exports = resultOnly ? ["CheckedRecords.repeated"] : Object.keys(contracts);
		const configuration = { schemaVersion: 1, modules: ["CheckedRecords"]
			, targets: { cpan: { module: moduleName, version: "1.000" } }
			, ...reviewed ? {} : { exports, contracts: Object.fromEntries(exports.map(name => [name, contracts[name]])) } };
		await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson(configuration));
		if(reviewed) await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(expected));
		let compiled;
		await assert.rejects(() => buildElaboratedComponent({
			projectRoot, outputRoot: join(directory, "out"), moduleName
			, leanPrefix: resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, targets: ["cpan"], profile: "native-library-v1"
			, receiptName: "native-component.json"
			, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
			, createAdapters: generateCompiledNativeLeanAdapters
			, compileComponent: async input => {
				compiled = input;
				throw Object.assign(new Error("stop before C"), { code: "stop-before-c" });
			}
		}), error => {
			if(error.code !== "stop-before-c") throw error;
			return true;
		});
		assert.ok(compiled, "Fresh Lean must reach the native compilation boundary");
		assert.equal(reviewedContractDifference(expected, compiled.model.bindingIr), null);
		assert.equal(compiled.model.moduleName, moduleName);
		const files = generatePerlBindingPackage(compiled.model, receipt);
		assert.ok(files["lib/LeanBridge/CheckedRecords.pm"].includes("=head1 CHECKED RECORDS"));
		assert.ok(compiled.adapters.leanSource.includes("structure LbErased.CheckedRecords.Triple where"));
		assert.doesNotMatch(compiled.adapters.leanSource, /_root_\.CheckedRecords\.(?:Interval|Sized|Bounded|Triple|Percent)\.mk/u);
		assert.equal(compiled.model.exports.length, resultOnly ? 1 : 8);
	});
