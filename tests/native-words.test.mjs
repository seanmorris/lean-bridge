/**
 * Install Word packages built from ordinary Lean and an independent reviewed IR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { wordReviewedIr, wordNativeSignatures as nativeWordSignatures } from "./helpers/word-fixture.mjs";
import { installWordConsumer, nativeWordEnvironment, nativeWordTargets } from "./helpers/native-word-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const profiles = process.env.LEAN_BRIDGE_WORD_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate Word profile");
assert.ok(profiles.every(profile => Object.hasOwn(nativeWordTargets, profile)), "Unknown or empty Word profile");
assert.ok(!profiles.includes("php-wasm") || profiles.length === 1, "Run the separate wasm32 Word build on its own");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("ordinary and reviewed Word packages preserve compiled platform integers in installed native consumers", { skip: !profiles.length, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-word-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-word-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/words", projectRoot, { recursive: true });
		const targets = Object.fromEntries(profiles.map(profile => nativeWordTargets[profile]));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Words"]
			, targets
			, ...(path === "ordinary-source" ? { exports: nativeWordSignatures.map(entry => entry.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(wordReviewedIr(nativeWordSignatures)));
		const environment = nativeWordEnvironment(profiles);
		t.diagnostic(`${path}: building ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = await json(join(outputRoot, profiles.includes("php-wasm") ? "php-wasm/component/model.json" : "native/component/model.json"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(nativeWordSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = profiles.includes("rust") ? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		for(const profile of profiles)
		{
			t.diagnostic(`${path}: installing and checking ${profile}`);
			const target = nativeWordTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const observation = await installWordConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			reports.push({ profile, path, signatures, ...observation, packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_WORD_REPORT ?? `build/word-native/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
