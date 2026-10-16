/**
 * Check nested checked-record CPAN projection before installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { projectPerlNames } from "../../src/backends/perl/naming.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	nestedCheckedRecordPerlConfiguration
	, nestedCheckedRecordPerlModes
	, nestedCheckedRecordPerlModule
	, nestedCheckedRecordPerlReview
	, nestedCheckedRecordPerlRoutes
} from "./nested-checked-record-perl-fixture.mjs";
import { nestedCheckedRecordFixture } from "./nested-checked-record-fixture.mjs";

const receipt = {
	library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
	, runtimeIdentity: "c".repeat(64)
	, initializer: "initialize_NestedCheckedRecords"
};
const nativeModel = async (route, mode) => JSON.parse(await readFile(
	`docs/evidence/nested-checked-record-native-20261016/${route}-${mode}/records/build-0/model.json`
	, "utf8"
));
const perlModel = async (route, mode) => {
	const native = await nativeModel(route, mode);
	return { ...native, moduleName: nestedCheckedRecordPerlModule
		, exports: projectPerlNames(nestedCheckedRecordPerlModule, native.exports) };
};

test("Perl projection preserves nested classes and proof-free result-only APIs", async () => {
	for(const route of nestedCheckedRecordPerlRoutes)
		for(const mode of nestedCheckedRecordPerlModes)
		{
			const files = generatePerlBindingPackage(await perlModel(route, mode), receipt);
			assert.deepEqual(Object.keys(files), [
				"Component.xs"
				, "lib/LeanBridge/NestedCheckedRecords.pm"
				, "binding-manifest.json"
			]);
			const xs = files["Component.xs"], pm = files["lib/LeanBridge/NestedCheckedRecords.pm"];
			const classes = mode === "full"
				? ["Packet", "Holder", "Choice", "Choice::Empty", "Choice::Packet"]
				: ["Packet"];
			for(const name of classes)
				assert.ok(pm.includes(`package LeanBridge::NestedCheckedRecords::${name};`), `${route}/${mode}/${name}`);
			assert.ok(pm.includes("=head1 CHECKED RECORDS"));
			assert.ok(pm.includes("Every nested Fin bound and Subtype constructor runs before the record constructor at that exact path."));
			assert.doesNotMatch(pm, /Nested checked records.*remain unsupported/u);
			const packet = pm.split("package LeanBridge::NestedCheckedRecords::Packet;\n")[1]
				.split("package LeanBridge::NestedCheckedRecords::Holder;\n")[0];
			assert.ok(packet.includes("my @required = qw(digit word);"));
			assert.doesNotMatch(packet, /linked/u);
			assert.doesNotMatch(xs, /lean_alloc_ctor/u);
			if(mode === "result-only")
			{
				assert.match(xs, /\nproduce_option\(\.\.\.\)\n/u);
				assert.match(xs, /\nproduce_array\(\.\.\.\)\n/u);
				assert.doesNotMatch(xs, /_refinement_\d+/u);
				assert.doesNotMatch(xs, /\nfirst\(\.\.\.\)\n/u);
			}
		}
});

test("Perl nested guards name each field and run inner checks before outer constructors", async () => {
	for(const route of nestedCheckedRecordPerlRoutes)
	{
		const files = generatePerlBindingPackage(await perlModel(route, "full"), receipt);
		const xs = files["Component.xs"], prefix = route === "ordinary" ? "arg" : "value";
		assert.ok(xs.includes(`"${prefix}0"`), `${route}: parameter identity`);
		for(const text of [
			"%s.digit is not below its Fin 10 bound"
			, "%s.word was rejected by NestedCheckedRecords.mkWord"
			, `${prefix}0 was rejected by NestedCheckedRecords.mkPacket`
			, "%s[%zu].word was rejected by NestedCheckedRecords.mkWord"
			, "%s.packet.digit is not below its Fin 10 bound"
			, "%s.packet.value was rejected by NestedCheckedRecords.mkPacket"
			, "%s.error was rejected by NestedCheckedRecords.mkPacket"
		]) assert.ok(xs.includes(text), `${route}: ${text}`);
		const direct = xs.slice(xs.indexOf("\nfirst(...)\n"), xs.indexOf("\nvoid\n", xs.indexOf("\nfirst(...)\n") + 1));
		const bound = direct.indexOf("is not below its Fin 10 bound");
		const word = direct.indexOf("was rejected by NestedCheckedRecords.mkWord");
		const record = direct.indexOf("was rejected by NestedCheckedRecords.mkPacket");
		assert.ok(bound >= 0 && word > bound && record > word, `${route}: nested guard order`);
	}
});

test("Perl representation validation still rejects malformed erased carriers", async () => {
	const model = await perlModel("ordinary", "full");
	const packet = model.types.find(type => type.name === "NestedCheckedRecords.Packet");
	for(const mutate of [
		type => { type.erased = []; }
		, type => { type.erased = ["digit"]; }
		, type => { type.erased = ["linked", "linked"]; }
		, type => { type.fields[0].name = "DESTROY"; }
	]) {
		const changed = structuredClone(model), selected = changed.types.find(type => type.name === packet.name);
		mutate(selected);
		assert.throws(() => generatePerlBindingPackage(changed, receipt));
	}
});

for(const route of nestedCheckedRecordPerlRoutes)
	for(const mode of nestedCheckedRecordPerlModes)
		test(`fresh Lean compiles nested checked-record Perl adapters for ${route} ${mode}`, {
			skip: process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_LEAN_TEST !== "1"
			, timeout: 900_000
		}, async t => {
			const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nested-checked-record-perl-source-"));
			t.after(() => rm(directory, { recursive: true, force: true }));
			const projectRoot = join(directory, "project");
			await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
			const configuration = nestedCheckedRecordPerlConfiguration(route, mode);
			const expected = nestedCheckedRecordPerlReview(mode);
			await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson(configuration));
			if(route === "reviewed")
				await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(expected));
			let compiled;
			await assert.rejects(() => buildElaboratedComponent({
				projectRoot, outputRoot: join(directory, "out")
				, moduleName: nestedCheckedRecordPerlModule
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
			assert.equal(compiled.model.moduleName, nestedCheckedRecordPerlModule);
			const files = generatePerlBindingPackage(compiled.model, receipt);
			const pm = files["lib/LeanBridge/NestedCheckedRecords.pm"];
			assert.ok(pm.includes("=head1 CHECKED RECORDS"));
			assert.ok(compiled.adapters.leanSource.includes("structure LbErased.NestedCheckedRecords.Packet where"));
			assert.doesNotMatch(compiled.adapters.leanSource, /_root_\.NestedCheckedRecords\.Packet\.mk/u);
			assert.equal(compiled.model.exports.length, mode === "full" ? 13 : 2);
		});
