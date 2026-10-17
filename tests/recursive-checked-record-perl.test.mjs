/**
 * Generated and installed Perl acceptance for recursive checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { generateCopiedPerlGraphXs } from "../src/backends/perl/copied-graph-xs.mjs";
import { projectPerlNames } from "../src/backends/perl/naming.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import {
	loadRecursiveCheckedRecordPerlCaller, recursiveCheckedRecordPerlCallerArguments
	, recursiveCheckedRecordPerlConfiguration, recursiveCheckedRecordPerlFixtures
	, recursiveCheckedRecordPerlPackage, recursiveCheckedRecordPerlReview
	, recursiveCheckedRecordPerlRoutes
} from "./helpers/recursive-checked-record-perl-fixture.mjs";
import "./helpers/recursive-checked-record-perl-evidence-tests.mjs";
import "./helpers/recursive-checked-record-perl-installed-tests.mjs";

const receipt = component => ({
	library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
	, runtimeIdentity: "c".repeat(64)
	, initializer: `initialize_LeanBridgeNative${sha256(component).slice(0, 16)}`
});
const mutualModel = async route => {
	const path = `docs/evidence/mutual-checked-record-jvm-20261016/${route}/records/build-0/model.json`;
	const model = JSON.parse(await readFile(path, "utf8"));
	const moduleName = "LeanBridge::MutualCheckedRecords";
	return { ...model, moduleName
		, exports: projectPerlNames(moduleName, model.exports) };
};

test("recursive checked-record Perl keeps four exact author/fixture selections", async () => {
	const caller = await loadRecursiveCheckedRecordPerlCaller();
	assert.match(caller, /recursive\|mutual ordinary\|reviewed/u);
	assert.doesNotMatch(caller, /ROUTE_PREFIX|__ROUTE|BEGIN (?:RECURSIVE|MUTUAL)/u);
	for(const route of recursiveCheckedRecordPerlRoutes)
		for(const fixture of recursiveCheckedRecordPerlFixtures)
		{
			const selected = recursiveCheckedRecordPerlPackage(fixture);
			const configuration = recursiveCheckedRecordPerlConfiguration(route, fixture);
			assert.deepEqual(configuration.targets, {
				cpan: { module: selected.module, version: "1.000" }
			});
			assert.equal(recursiveCheckedRecordPerlReview(fixture).component.id
				, `${fixture}checkedrecords@1.0.0`);
			assert.deepEqual(recursiveCheckedRecordPerlCallerArguments(fixture, route)
				, ["consumer.pl", fixture, route]);
		}
});

test("recursive checked-record Perl packages bind exact native diagnostics", async () => {
	for(const route of recursiveCheckedRecordPerlRoutes)
	{
		const model = await mutualModel(route);
		const files = generatePerlBindingPackage(model, receipt(model.component.id));
		const xs = files["Component.xs"];
		assert.match(xs, /mutualcheckedrecords_graph_error\(\)/u);
		assert.ok(xs.indexOf("mutualcheckedrecords_graph_error()")
			< xs.indexOf('status == 1 ? "invalid argument"'));
		assert.match(xs, /croak\("%s\\n", specific\)/u);
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.deepEqual(manifest.supportedFeatures
			, ["checked-refinement-diagnostics"]);
		assert.match(files["lib/LeanBridge/MutualCheckedRecords.pm"]
			, /recursive copied values/u);
	}
});

test("unrefined Perl graph packages retain the diagnostic-free path", () => {
	const generated = generateCopiedPerlGraphXs(
		nativeRecursiveReviewedIr(), "LeanBridge::Recursive"
	);
	assert.equal(generated.refinementDiagnostics, false);
	assert.doesNotMatch(generated.source, /_graph_error/u);
	assert.match(generated.source, /status == 1 \? "invalid argument"/u);
});
