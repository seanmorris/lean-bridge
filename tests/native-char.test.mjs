/**
 * Install Char packages built from ordinary Lean and an independent reviewed IR.
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
import { nativeCharReviewedIr, nativeCharSignatures } from "./helpers/native-char-fixture.mjs";
import { installCharConsumer, nativeCharEnvironment, nativeCharTargets } from "./helpers/native-char-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const profiles = process.env.LEAN_BRIDGE_CHAR_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate Char profile");
assert.ok(profiles.every(profile => Object.hasOwn(nativeCharTargets, profile)), "Unknown or empty Char profile");
assert.ok(!profiles.includes("php-wasm") || profiles.length === 1, "Run the separate wasm32 Char build on its own");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("ordinary and reviewed Char packages preserve Unicode scalars in installed native consumers", { skip: !profiles.length, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-char-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-char-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/glyphs", projectRoot, { recursive: true });
		const targets = Object.fromEntries(profiles.map(profile => nativeCharTargets[profile]));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Glyphs"]
			, targets
			, ...(path === "ordinary-source" ? { exports: nativeCharSignatures.map(entry => entry.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeCharReviewedIr()));
		const environment = nativeCharEnvironment(profiles);
		t.diagnostic(`${path}: building ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = await json(join(outputRoot, profiles.includes("php-wasm") ? "php-wasm/component/model.json" : "native/component/model.json"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(nativeCharSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = profiles.includes("rust") ? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		for(const profile of profiles)
		{
			t.diagnostic(`${path}: installing and checking ${profile}`);
			const target = nativeCharTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const observation = await installCharConsumer({ profile, consumer, handoff, packages, dependencies, environment });
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
	const reportPath = resolve(process.env.LEAN_BRIDGE_CHAR_REPORT ?? `build/char-native/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
