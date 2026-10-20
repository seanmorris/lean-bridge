/**
 * Source-free C and C++ acceptance for directional callback Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { compileCallableGraphPackageModel } from "../src/backends/c/callable-graph-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { callbackSubtypeConfiguration, callbackSubtypeFixture, callbackSubtypeReviewedIr } from "./helpers/callback-subtype-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const profiles = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)));
const targets = Object.fromEntries(profiles.map(profile => [profile, { name: "callbacksubtypes", version: "1.0.0" }]));

const cNames = ir => {
	const model = compileCallableGraphPackageModel(ir, ["c"]);
	const functions = new Map(model.functions.map(item => [item.field, item]));
	return {
		HOST_SCALAR: functions.get("call_host").parameters[0].publicName
		, HOST_MIXED: functions.get("call_host_mixed").parameters[0].publicName
		, CLOSURE_SCALAR: functions.get("make_closure").result.publicOwnedName
		, CLOSURE_MIXED: functions.get("make_mixed_closure").result.publicOwnedName
	};
};

test("ordinary and reviewed C-family callback Subtypes install from source-free archives", {
	skip: !profiles.length, timeout: 2_400_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-native-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed callback Subtype native inputs: ${root}`);
	});
	const environment = nativeFixtureEnvironment(profiles), reports = [];
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const author = join(root, `${route}-author`), projectRoot = join(author, "project");
		const outputRoot = join(author, "release"), consumer = join(root, `${route}-consumer`);
		const handoff = join(root, `${route}-handoff`);
		await cp(callbackSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackSubtypeConfiguration(route), targets
		}));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: profiles, environment });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const ir = JSON.parse(await readFile(join(outputRoot, "native/component/binding-ir.json"), "utf8"));
		if(route === "ordinary") review = callbackSubtypeReviewedIr(ir);
		else assert.equal(reviewedContractDifference(review, ir), null);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		const names = cNames(ir);
		for(const profile of profiles)
		{
			const source = async name => {
				const text = await readFile(`tests/fixtures/callback-subtype-consumers/${name}.${name === "c" ? "c" : "cpp"}`, "utf8");
				return name === "c" ? `${Object.entries(names).map(([macro, value]) => `#define ${macro} ${value}`).join("\n")}\n${text}` : text;
			};
			const observation = await installCopiedConsumer({ profile, consumer, handoff
				, packages: receipt.packages.filter(item => item.target === profile)
				, environment
				, fixture: { source, wit: []
					, success: "callback-subtype-native-ok"
					, expectedChecks: profile === "c" ? 16 : 13 } });
			delete observation.command;
			reports.push({ route, profile
				, ...observation
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
	}
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_OUTPUT
		?? "build/callback-subtypes/native.json");
	await saveLakeFile(dirname(output), basename(output), canonicalJson({ schemaVersion: 1, reports }));
	complete = true;
});
