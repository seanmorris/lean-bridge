/**
 * Validate native checked-record records against the independent API and caller corpus.
 * Archive authentication and execution provenance are separate requirements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { checkedRecordHostConsumer, checkedRecordHostExtensions, checkedRecordHostSelection, checkedRecordHostTargets } from "./checked-record-native-fixture.mjs";
import { refinementsKey } from "./checked-record-fixture.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);

/**
 * Check both original build records and every host result without opening producer paths.
 *
 * @param options - Explicit selection and relative record reader.
 * @param options.profiles - Sorted unique profiles expected by the caller.
 * @param options.route - Exact source and result-only selection.
 * @param options.read - Read original bytes by archive-relative path.
 * @param options.python - Optional Python minor floor.
 */
export const assertCheckedRecordHostRecords = async ({ profiles, route, read, python }) => {
	const selection = checkedRecordHostSelection(route, profiles);
	assert.deepEqual(profiles, [...profiles].sort());
	if(python !== undefined) assert.ok(profiles.includes("python") && ["3.11", "3.12"].includes(python));
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(Buffer.from(bytes).toString(), canonicalJson(value), `Noncanonical producer record: ${path}`);
		return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), ["builds", "profiles", "reports", "reproducible", "route", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.equal(report.route, route); assert.deepEqual(report.profiles, profiles);
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	const source = await readFile("tests/fixtures/onboarding/checked-records/CheckedRecords.lean", "utf8");
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(await json(prefix + "expected.json"), selection.expected);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), selection.configuration);
		assert.equal(Buffer.from(await read(prefix + "CheckedRecords.lean")).toString(), source);
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.exports.length, selection.resultOnly ? 1 : 8);
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		for(const declaration of selection.expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.source.declaration);
			assert.ok(exported, declaration.id);
			const tree = (site, constructor) => {
				const definition = selection.expected.types.find(item => item.id === site.type.id);
				return definition ? { kind: "checked-record"
					, definition: definition.id.slice("lean:".length), constructor
					, fields: definition.fields.map(field => field.name) } : null;
			};
			const constructors = declaration.source.extensions[refinementsKey];
			assert.deepEqual(exported.refinements, {
				parameters: declaration.parameters.map((site, index) => tree(site, constructors?.parameters[index]?.constructor ?? null))
				, result: tree(declaration.result, null)
			});
		}
		const identity = model.sourceIdentity;
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), selection.expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(selection.expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(selection.expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(selection.expected));
			const requested = reviewedSourceSelection(identity.reviewedBindingIr);
			for(const key of ["contracts", "exports", "specializations"])
				assert.deepEqual(identity.request[key], requested[key]);
		} else
		{
			assert.ok(!identity.reviewedBindingIr, "Ordinary source acquired a reviewed authority");
			assert.deepEqual(identity.request.contracts, selection.configuration.contracts);
			assert.deepEqual(identity.request.exports, selection.configuration.exports);
			assert.equal(identity.request.specializations, undefined);
		}
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], ["CheckedRecords"]);
		assert.equal(identity.exportConfigurationSource, canonicalJson(selection.configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(selection.configuration)));
		assert.equal(identity.modules.length, 1);
		assert.deepEqual(identity.modules[0].source, { path: "CheckedRecords.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) });
		assert.equal(identity.modules[0].module, "CheckedRecords");
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))].sort(), Object.keys(selection.configuration.targets).sort());
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
		assert.equal(item.route, route);
		assert.equal(item.reviewed, selection.reviewed); assert.equal(item.resultOnly, selection.resultOnly);
		assert.equal(item.checks, selection.checks);
		const caller = await checkedRecordHostConsumer(profile, route);
		assert.equal(Buffer.from(await read(`consumers/${profile}.${checkedRecordHostExtensions[profile]}`)).toString(), caller);
		assert.equal(item.consumerSha256, sha256(caller));
		assert.equal(item.expectedBindingIrSha256, hashBindingIr(selection.expected));
		assert.deepEqual(item.dispatch, { observed: false, reason: "No entry counters in this installed host acceptance" });
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
			assert.equal(item[key], true, key);
		assert.equal(item.repeatedRuns, profile === "php-native" ? 2 : 1);
		for(const [key, value] of Object.entries(report.builds[0])) assert.deepEqual(item[key], value);
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === checkedRecordHostTargets[profile][0]));
		if(profile === "python")
		{
			const environment = item.pythonEnvironment;
			assert.match(environment.python, /^3\.(?:11|12)\.[0-9]+$/u);
			if(python) assert.ok(environment.python.startsWith(python + "."));
			assert.equal(environment.site, `lib/python${environment.python.split(".").slice(0, 2).join(".")}/site-packages`);
			hash(environment.baselineSha256); assert.notEqual(environment.baselineSha256, environment.expectedSha256);
			assert.equal(environment.expectedSha256, sha256(canonicalJson(environment.entries)));
			assert.equal(environment.receiptSha256, environment.entries[`${environment.site}/lean_checkedrecords/lean_bridge/package-receipt.json`].sha256);
			hash(environment.interpreter.sha256); assert.equal(environment.interpreter.kind, "file");
		}
	}
	return report;
};
