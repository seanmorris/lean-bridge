/**
 * Fast controls for the value-index NuGet identity, probe and record closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
	checkedRecordValueIndexDotnetRoutes
} from "./checked-record-value-index-dotnet-fixture.mjs";
import {
	assertCheckedRecordValueIndexDotnetIdentity
	, checkedRecordValueIndexDotnetAssembly
} from "./checked-record-value-index-dotnet-package.mjs";
import {
	checkedRecordValueIndexDotnetApiProbe
	, checkedRecordValueIndexDotnetInputNames
	, checkedRecordValueIndexDotnetResultNames
	, checkCheckedRecordValueIndexDotnetProbe
} from "./checked-record-value-index-dotnet-probe.mjs";
import {
	checkedRecordValueIndexDotnetRecords
} from "./checked-record-value-index-dotnet-report.mjs";

test("value-index NuGet identity binds coordinate, assembly and provenance", () => {
	const model = {
		bindingIrSha256: "a".repeat(64)
		, component: {
			id: "checkedrecordvalueindices@1.0.0"
			, name: "checkedrecordvalueindices", version: "1.0.0"
		}
		, sourceIdentity: { sourceTreeSha256: "b".repeat(64) }
	};
	const pkg = {
		target: "nuget", ecosystem: "nuget", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded"
		, requires: [], name: "Checkedrecordvalueindices.Api", version: "1.0.0"
		, runtimeIdentity: "c".repeat(64)
		, artifacts: [{
			path: "packages/Checkedrecordvalueindices.Api.1.0.0.nupkg"
			, bytes: 1, sha256: "d".repeat(64)
		}]
	};
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package"
		, ecosystem: "nuget", namespace: checkedRecordValueIndexDotnetAssembly
		, assembly: checkedRecordValueIndexDotnetAssembly, name: pkg.name
		, version: pkg.version, runtimeIdentity: pkg.runtimeIdentity
		, bindingIrSha256: model.bindingIrSha256, component: model.component
		, sourceIdentity: model.sourceIdentity, glibcMinimumVersion: "2.38"
		, compiledProjectionSha256: "e".repeat(64)
	};
	assert.doesNotThrow(() => assertCheckedRecordValueIndexDotnetIdentity(
		receipt, pkg, model, "2.38"
	));
	for(const mutate of [
		value => { value.receipt.namespace = "Wrong"; }
		, value => { value.pkg.name = "Wrong.Api"; }
		, value => { value.receipt.bindingIrSha256 = "0".repeat(64); }
		, value => { value.receipt.glibcMinimumVersion = "2.39"; }
	]) {
		const changed = structuredClone({ receipt, pkg, model }); mutate(changed);
		assert.throws(() => assertCheckedRecordValueIndexDotnetIdentity(
			changed.receipt, changed.pkg, changed.model, "2.38"
		));
	}
});

test("value-index C# probe closes eight input and eight result methods", () => {
	for(const name of checkedRecordValueIndexDotnetInputNames)
		assert.ok(checkedRecordValueIndexDotnetApiProbe.includes(
			`nameof(Api.${name})`));
	for(const name of checkedRecordValueIndexDotnetResultNames)
		assert.ok(checkedRecordValueIndexDotnetApiProbe.includes(
			`nameof(Api.${name})`));
	for(const name of [
		"On", "Off", "Ab", "EmptyToken", "UnicodeToken", "EmptySized"
		, "ZeroToken", "WideToken"
	]) assert.match(checkedRecordValueIndexDotnetApiProbe
		, new RegExp(`static ${name}\\?`, "u"));
	const common = {
		cwd: "/tmp/value-index-probe"
		, restore: { code: 0, stdout: "restored", stderr: "" }
		, diagnostics: { version: "2.1.0", runs: [{ results: [] }] }
	};
	assert.doesNotThrow(() => checkCheckedRecordValueIndexDotnetProbe({
		...common, build: { code: 0, stdout: "built", stderr: "" }
		, outputs: { "Probe.dll": { bytes: 1, sha256: "a".repeat(64) } }
	}, "full"));
	const results = checkedRecordValueIndexDotnetInputNames.map(name => {
		const line = checkedRecordValueIndexDotnetApiProbe.split("\n")
			.findIndex(source => source.includes(`nameof(Api.${name})`)) + 1;
		return {
			ruleId: "CS0117", level: "error"
			, message: { text: `'Api' does not contain a definition for '${name}'` }
			, locations: [{ physicalLocation: {
				artifactLocation: {
					uri: pathToFileURL(join(common.cwd, "probe.cs")).href
				}
				, region: { startLine: line, endLine: line }
			} }]
		};
	});
	assert.doesNotThrow(() => checkCheckedRecordValueIndexDotnetProbe({
		...common, build: { code: 1, stdout: "refused", stderr: "" }
		, diagnostics: { version: "2.1.0", runs: [{ results }] }, outputs: {}
	}, "result-only"));
});

test("value-index .NET retained records are route-complete and unique", () => {
	const nuget = { retained: [
		"Checkedrecordvalueindices.Api.nuspec"
		, "lean-bridge/package-receipt.json"
	] };
	const context = { outputs: {
		"Consumer.dll": {}, "Consumer.deps.json": {}
		, [`${checkedRecordValueIndexDotnetAssembly}.dll`]: {}
		, "runtimes/linux-x64/native/libLeanBridge.so": {}
	} };
	for(const route of checkedRecordValueIndexDotnetRoutes)
	{
		const paths = checkedRecordValueIndexDotnetRecords(route, nuget, context);
		assert.deepEqual(paths, [...paths].sort());
		assert.equal(new Set(paths).size, paths.length);
		assert.ok(paths.includes("build-0/CheckedRecordValueIndices.lean"));
		assert.equal(paths.includes("build-0/api.binding-ir.json")
			, route.endsWith("reviewed-ir"));
		assert.equal(paths.includes("api-probe/out/Probe.dll")
			, !route.startsWith("result-only-"));
		assert.ok(paths.includes(
			"handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg"
		));
	}
});
