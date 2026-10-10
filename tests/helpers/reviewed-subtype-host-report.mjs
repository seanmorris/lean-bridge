/**
 * Check original reviewed-host reports against both producer records and the independent API.
 * This validates report consistency. Archive authentication and execution provenance are separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeSubtypeTargets } from "./native-subtype-install.mjs";
import { reviewedSubtypeHostConsumer, reviewedSubtypeHostIr, reviewedSubtypeHostProfiles, reviewedSubtypeHostSource } from "./reviewed-subtype-host-fixture.mjs";
import { reviewedSubtypeHostChecks } from "./reviewed-subtype-host-install.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};

/**
 * Validate a complete selection without opening any historical absolute producer path.
 *
 * @param options - Explicit expected selection and archive-relative record reader.
 * @param options.profiles - Sorted, unique native profiles expected by the caller.
 * @param options.read - Read one original relative producer record as bytes.
 * @param options.python - Optional exact Python minor floor.
 */
export const assertReviewedSubtypeHostRecords = async ({ profiles, read, python }) => {
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.deepEqual(profiles, [...new Set(profiles)].sort());
	assert.ok(profiles.every(profile => reviewedSubtypeHostProfiles.includes(profile)));
	if(python !== undefined) assert.ok(profiles.includes("python") && ["3.11", "3.12"].includes(python));
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(Buffer.from(bytes).toString(), canonicalJson(value), `Noncanonical producer record: ${path}`);
		return value;
	};
	const report = await json("report.json"), review = reviewedSubtypeHostIr();
	assert.deepEqual(Object.keys(report).sort(), ["builds", "profiles", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.profiles, profiles);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	const source = await readFile("tests/fixtures/onboarding/native-subtype/Subtypes.lean", "utf8") + reviewedSubtypeHostSource;
	const configuration = { schemaVersion: 1, modules: ["Subtypes"], targets: Object.fromEntries(profiles.map(profile => nativeSubtypeTargets[profile])) };
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(await json(prefix + "review.json"), review);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(Buffer.from(await read(prefix + "Subtypes.lean")).toString(), source);
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.exports.length, 12);
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		const identity = model.sourceIdentity;
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(review));
		assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(review)));
		assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(review));
		const selection = reviewedSourceSelection(identity.reviewedBindingIr);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], ["Subtypes"]);
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.modules.length, 1);
		assert.deepEqual(identity.modules[0].source, { path: "Subtypes.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) });
		assert.equal(identity.modules[0].module, "Subtypes");
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))].sort(), Object.keys(configuration.targets).sort());
		const expected = { bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) };
		assert.deepEqual(report.builds[attempt], expected);
	}
	for(const item of report.reports)
	{
		const profile = item.profile;
		assert.deepEqual(await json(profile + ".json"), item);
		assert.equal(item.path, "reviewed-source");
		assert.equal(item.checks, reviewedSubtypeHostChecks[profile]);
		assert.equal(item.consumerSha256, sha256(await reviewedSubtypeHostConsumer(profile)));
		assert.equal(item.reviewedBindingIrSha256, hashBindingIr(review));
		assert.deepEqual(item.dispatch, { observed: false, reason: "No host entry counters in this installed acceptance" });
		flags(item, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution"]);
		for(const [key, value] of Object.entries(report.builds[0])) assert.deepEqual(item[key], value);
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === nativeSubtypeTargets[profile][0]));
		if(profile !== "perl")
		{
			flags(item, ["compilerFreeReplay", "sourceUnchangedAfterReplay"]);
			assert.equal(item.repeatedRuns, profile === "php-native" ? 2 : 1);
		}
		if(profile === "python")
		{
			const environment = item.pythonEnvironment;
			assert.match(environment.python, /^3\.(?:11|12)\.[0-9]+$/u);
			if(python) assert.ok(environment.python.startsWith(python + "."));
			assert.equal(environment.site, `lib/python${environment.python.split(".").slice(0, 2).join(".")}/site-packages`);
			hash(environment.baselineSha256);
			assert.notEqual(environment.baselineSha256, environment.expectedSha256);
			assert.equal(environment.expectedSha256, sha256(canonicalJson(environment.entries)));
			assert.equal(environment.receiptSha256, environment.entries[`${environment.site}/lean_subtypes/lean_bridge/package-receipt.json`].sha256);
			hash(environment.interpreter.sha256); assert.equal(environment.interpreter.kind, "file");
		}
		if(profile === "perl")
		{
			hash(item.interpreterSha256);
			for(const key of ["version", "archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
				assert.equal(typeof item.perl[key], "string");
		}
	}
	return report;
};
