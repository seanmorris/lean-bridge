/**
 * Independently check reproduced Rust packages and all three execution stages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalSubtypeRustRoutes, nominalSubtypeRustModes, nominalSubtypeRustCounts, parseNominalSubtypeRustResult } from "./nominal-subtype-rust-fixture.mjs";
import { nominalSubtypeRustOriginal } from "./nominal-subtype-rust-generators.mjs";
import { checkNominalSubtypeRustModels } from "./nominal-subtype-rust-model-records.mjs";
import { checkNominalSubtypeRustPackage } from "./nominal-subtype-rust-package-records.mjs";
import { checkNominalSubtypeRustEnvironment } from "./nominal-subtype-rust-environment-records.mjs";

/**
 * Enumerate all producer records and the original archive checksum supplements.
 *
 * @param route - Independently selected author route.
 * @param crate - Authenticated original package inventory.
 * @param dependencies - Authenticated original dependency handoff record.
 */
export const nominalSubtypeRustRecords = (route, crate, dependencies) => {
	assert.ok(nominalSubtypeRustRoutes.includes(route));
	return ["report.json", "runtime.json", "toolchain.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.rs"
		, "crate.json", "dependencies.json", "installation.json"
		, "consumer-environment.json", "consumer-metadata.json", "consumer-build.json"
		, "consumer.Cargo.toml", "consumer.Cargo.lock", "consumer.config.toml"
		, "api-probe.json", "api-probe.rs", "link-only"
		, "installed.json", "relocated.json", "source-free.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", "NominalSubtypes.lean", "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...crate.retained.map(path => `package/${path}`)
		, ...dependencies.packages.map(pkg => `dependency-manifests/${pkg.directory}.json`)];
};

/**
 * Check both builds, frozen sources, offline installation and complete public results.
 *
 * @param read - Selection-relative original byte reader, never historical paths.
 * @param options - Independently selected producer, toolchain and runtime scope.
 * @param options.route - Ordinary or reviewed source route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.runtime - Observed platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 * @param options.toolchain - Independently pinned original Rust and Cargo identities.
 */
export const checkNominalSubtypeRustReport = async (read, { route, mode, producerCommit, runtime, floor, toolchain }) => {
	assert.ok(nominalSubtypeRustRoutes.includes(route)); assert.ok(nominalSubtypeRustModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`); return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "compilerFreeReplay", "declaredGlibcFloor"
		, "dependencies", "dispatch", "expectedBindingIrSha256", "independentBuilds"
		, "installation", "mode", "observations", "offlineInstall", "producerCommit"
		, "receipt", "relocatedInstallation", "reproducible", "route", "runtime"
		, "schemaVersion", "sourceFreeExecutable"
		, "sourceRemovedBeforeInstallation"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation", "sourceFreeExecutable"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Rust constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	const { model, receipt } = await checkNominalSubtypeRustModels({ report, read, json, route, mode, producerCommit });
	const { crate, generatorPaths } = await checkNominalSubtypeRustPackage({ read, json, model, receipt, floor, producerCommit });
	const source = nominalSubtypeRustOriginal(producerCommit, "tests/fixtures/nominal-subtype-consumers/rust.rs").toString();
	assert.equal((await read("consumer.rs")).toString(), route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1"));
	const { root, installation, dependencies, closure } = await checkNominalSubtypeRustEnvironment({ read, json, crate, mode, toolchain });
	assert.deepEqual(report.installation, installation); assert.deepEqual(report.dependencies, dependencies);
	assert.equal(report.observations.length, 3);
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const observation = await json(`${stage}.json`); assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(Object.keys(observation).sort(), ["counts", "cwd", "normalExitCleanup", "run", "stage", ...index === 2 ? ["sourcesRemoved"] : ["closure"]].sort());
		assert.equal(observation.stage, stage); assert.equal(observation.normalExitCleanup, true);
		assert.equal(observation.cwd, index === 2 ? posix.join(posix.dirname(root), "source-free") : root + (index ? "-relocated" : ""));
		if(index === 2) assert.equal(observation.sourcesRemoved, true);
		else assert.deepEqual(observation.closure, closure);
		assert.deepEqual(observation.counts, nominalSubtypeRustCounts[mode]);
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, ""); parseNominalSubtypeRustResult(observation.run.stdout, mode);
	}
	return { route, mode, producerCommit, runtime, floor, toolchain
		, counts: nominalSubtypeRustCounts[mode], executions: 3
		, dispatchObserved: false, generatorModules: generatorPaths.length
		, records: nominalSubtypeRustRecords(route, crate, dependencies).length };
};
