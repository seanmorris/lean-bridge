/**
 * Check original structural WIT execution records without reopening historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeWitConfiguration, structuralSubtypeWitCounts, parseStructuralSubtypeWitResult } from "./structural-subtype-wit-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypeWitPackageRecords = Object.freeze([
	"binding-manifest.json", "native-wit-adapter.json"
	, "wit/structuralsubtypes.wit"
	, "component/structuralsubtypes.wasm", "component/structuralsubtypes.wat"
	, "include/structuralsubtypes_wasmtime.h"
	, "lib/pkgconfig/structuralsubtypes-wit.pc"
]);
export const structuralSubtypeWitRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.c"
	, "installed.json", "relocated.json", "installed-receipt.json"
	, ...structuralSubtypeWitPackageRecords.map(path => "package/" + path)
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact WIT author contracts, authenticated Wasmtime packages and relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypeWitReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeWitConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No WIT entry counters in this installed acceptance" });
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const modelBytes = await read(`build-${index}/model.json`), model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 12);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${index}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, { path: "StructuralSubtypes.lean", bytes: source.length, sha256: sha256(source) });
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		digest(model.sourceIdentity.leanCompilerSha256);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["wit-wasi"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}

	const header = original("tests/fixtures/structural-subtype-consumers/wit-values.h").toString();
	const raw = original("tests/fixtures/structural-subtype-consumers/wit-wasi.c").toString();
	const include = '#include "wit-values.h"\n'; assert.equal(raw.split(include).length, 2);
	const source = raw.replace(include, header + "\n");
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.c")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller));
	assert.equal(report.installed.checks, structuralSubtypeWitCounts.checks);
	assert.deepEqual(report.installed.result, structuralSubtypeWitCounts);
	for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(report.installed[key], true, key);
	const receiptBytes = await read("installed-receipt.json"), receipt = await json("installed-receipt.json");
	const model = await json("build-0/model.json"), pkg = report.receipt.packages[0];
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi"); assert.equal(receipt.name, "structuralsubtypes");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, "1.0.0"); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity); assert.equal(receipt.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.wasmtime, wasmtimeCapiIdentity.version);
	assert.deepEqual(receipt.files["share/lean-bridge/component/model.json"], { bytes: (await read("build-0/model.json")).length, sha256: sha256(await read("build-0/model.json")) });
	for(const [path, entry] of Object.entries(receipt.files))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
	}
	const projection = compileCopiedWitModel(model.bindingIr, configuration.targets["wit-wasi"]);
	assert.deepEqual(await json("package/binding-manifest.json"), projection.manifest);
	assert.equal((await read("package/wit/structuralsubtypes.wit")).toString(), projection.wit);
	assert.equal((await read("package/component/structuralsubtypes.wat")).toString(), projection.wat);
	assert.equal((await read("package/include/structuralsubtypes_wasmtime.h")).toString(), renderWitHostHeader(projection));
	for(const path of structuralSubtypeWitPackageRecords)
	{
		const bytes = await read("package/" + path);
		assert.deepEqual(receipt.files[path], { bytes: bytes.length, sha256: sha256(bytes) });
	}
	const component = await read("package/component/structuralsubtypes.wasm");
	assert.deepEqual(component.subarray(0, 8), Buffer.from([0, 97, 115, 109, 13, 0, 1, 0]));
	assert.equal(receipt.componentSha256, sha256(component));
	const adapter = await json("package/native-wit-adapter.json");
	assert.equal(adapter.schemaVersion, 1); assert.equal(adapter.profile, "native-wit-v1");
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256); assert.equal(adapter.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(adapter.library, "libstructuralsubtypes_wasmtime.so");
	assert.equal(adapter.component, "component/structuralsubtypes.wasm");
	assert.equal(adapter.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.deepEqual(adapter.settings, configuration.targets["wit-wasi"]);
	assert.match(adapter.wasmTools, /^wasm-tools 1\.245\.1(?: |$)/u);
	assert.equal(adapter.componentReceiptSha256, receipt.files["share/lean-bridge/component/native-component.json"].sha256);
	assert.equal(adapter.adapterReceiptSha256, receipt.files["share/lean-bridge/native-c-adapter.json"].sha256);
	const { files: wasmtimeFiles, ...wasmtime } = adapter.wasmtime;
	assert.deepEqual(wasmtime, wasmtimeCapiIdentity);
	assert.equal(sha256(canonicalJson(wasmtimeFiles)), wasmtimeCapiIdentity.filesSha256);
	for(const [path, entry] of Object.entries(adapter.files))
	{
		const target = path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path;
		assert.deepEqual(receipt.files[target], entry, path);
	}
	for(const [path, entry] of Object.entries(wasmtimeFiles)) assert.deepEqual(adapter.files["wasmtime/" + path], entry);
	for(const path of ["lib/libstructuralsubtypes_wasmtime.so", "lib/libstructuralsubtypes.so", "lib/libwasmtime.so"])
		assert.ok(receipt.files[path]?.bytes > 0);
	const pkgConfig = (await read("package/lib/pkgconfig/structuralsubtypes-wit.pc")).toString();
	assert.equal(pkgConfig, "prefix=${pcfiledir}/../..\nincludedir=${prefix}/include\nlibdir=${prefix}/lib\n\nName: structuralsubtypes-wit\nDescription: Compiled Lean WIT API and Wasmtime 42.0.1 host\nVersion: 1.0.0\nLibs: -L${libdir} -Wl,-rpath,${libdir} -lstructuralsubtypes_wasmtime -lwasmtime\nCflags: -I${includedir}\n");
	assert.equal(report.executable.runtimeSearchPath, "$ORIGIN/structuralsubtypes-1.0.0-wit-wasi/lib");
	digest(report.executable.executableSha256);
	const closure = {
		receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: sha256(canonicalJson([...Object.keys(receipt.files), "lean-bridge-package.json"].sort()))
	};
	assert.equal(report.observations.length, 2);
	for(const [position, place] of ["installed", "relocated"].entries())
	{
		const observation = await json(place + ".json");
		assert.deepEqual(observation, report.observations[position]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypeWitResult(observation.run.stdout), structuralSubtypeWitCounts);
		assert.deepEqual(observation.counts, structuralSubtypeWitCounts); assert.deepEqual(observation.closure, closure);
	}
	return {
		route, producerCommit
		, ...structuralSubtypeWitCounts
		, executions: 2, wasmtime: receipt.wasmtime, dispatchObserved: false
		, archives: report.builds[0].archives
	};
};
