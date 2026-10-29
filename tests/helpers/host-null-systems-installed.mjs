/**
 * Source-free, relocated HostNull acceptance for C, C++, Rust and WIT/WASI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import {
	verifyFinContainerEdgeArchiveClosure, verifyFinContainerEdgeFileClosure
} from "./fin-container-edge-closure.mjs";
import {
	hostNullArities, hostNullProjection, hostNullReviewedIr
} from "./host-null-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";

export const hostNullSystemsProfiles = Object.freeze(["c", "cpp", "rust", "wit-wasi"]);
export const hostNullSystemsChecks = Object.freeze({
	c: 38, cpp: 19, rust: 17, "wit-wasi": 51
});
const targets = Object.freeze({
	c: Object.freeze({ name: "host-null-demo", version: "1.0.0" })
	, cpp: Object.freeze({ name: "host-null-demo", version: "1.0.0" })
	, cargo: Object.freeze({ name: "host-null-demo", version: "1.0.0" })
	, "wit-wasi": Object.freeze({ name: "host-null-demo", version: "1.0.0" })
});
const targetByProfile = Object.freeze({
	c: "c", cpp: "cpp", rust: "cargo", "wit-wasi": "wit-wasi"
});
const extensionByProfile = Object.freeze({
	c: "c", cpp: "cpp", rust: "rs", "wit-wasi": "c"
});
const receiptByProfile = Object.freeze({
	c: "lean-bridge-package.json", cpp: "lean-bridge-package.json"
	, rust: "lean-bridge/package-receipt.json"
	, "wit-wasi": "lean-bridge-package.json"
});
const exports_ = hostNullReviewedIr().declarations.map(item => item.source.declaration);
const positions = Object.freeze([
	"parameter", "result", "field", "callback-parameter", "callback-result"
]);

const privateShape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return {
		...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) => left.bindingId.localeCompare(right.bindingId))
	};
};

const installedRoot = (root, profile, pkg) => join(root
	, profile === "rust" ? `${pkg.name}-${pkg.version}`
		: `${pkg.name}-${pkg.version}-${profile}`);

const runtimeEnvironment = (root, profile, pkg) => ({
	...copiedCleanEnvironment
	, LD_LIBRARY_PATH: profile === "rust"
		? join(installedRoot(root, profile, pkg), "lean-bridge/lib")
		: join(installedRoot(root, profile, pkg), "lib")
	, CARGO_HOME: "/unavailable/cargo"
	, RUSTC: "/unavailable/rustc"
});

const executable = (root, profile) => join(root
	, profile === "rust" ? "target/debug/consumer" : "consumer");

/**
 * Build both author routes, install their prepared systems packages offline,
 * delete producer and consumer sources, relocate each consumer, and rerun it.
 *
 * @param t - Node test context owning temporary roots.
 */
export const runHostNullSystemsAcceptance = async t => {
	const outputRoot = resolve(process.env.LEAN_BRIDGE_SYSTEMS_HOST_NULL_OUTPUT
		?? "build/host-null/systems");
	const selectedRoutes = (process.env.LEAN_BRIDGE_SYSTEMS_HOST_NULL_ROUTES
		?? "ordinary,reviewed").split(",");
	assert.ok(selectedRoutes.length > 0 && new Set(selectedRoutes).size === selectedRoutes.length);
	assert.ok(selectedRoutes.every(route => ["ordinary", "reviewed"].includes(route)));
	await assert.rejects(access(outputRoot), { code: "ENOENT" });
	await mkdir(outputRoot, { recursive: true });
	const environment = nativeFixtureEnvironment(hostNullSystemsProfiles);
	environment.LEAN_BRIDGE_WASM_TOOLS ??= resolve(".toolchains/wasm-tools/bin/wasm-tools");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
		.toString().trim();
	const routes = [];
	for(const route of selectedRoutes)
	{
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-host-null-systems-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true, force: true });
			else t.diagnostic(`Retained failed systems HostNull inputs: ${root}`);
		});
		const author = join(root, "author"), projectRoot = join(author, "project");
		const release = join(author, "release"), consumer = join(root, "consumer");
		const handoff = join(consumer, "handoff"), dependencyHandoff = join(consumer, "dependencies");
		const retained = join(outputRoot, route);
		await mkdir(retained, { recursive: true });
		await cp("tests/fixtures/onboarding/host-null", projectRoot, { recursive: true });
		const configuration = {
			schemaVersion: 1, modules: ["HostNullDemo"]
			, hostProjections: [hostNullProjection], targets
			, ...route === "ordinary" ? { exports: exports_, arities: hostNullArities } : {}
		};
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot
			, "reviewed.binding-ir.json", canonicalJson(hostNullReviewedIr()));
		t.diagnostic(`${route}: compiling authenticated C, C++, Rust and WIT/WASI HostNull packages`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot: release, targets: Object.keys(targets), environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		const modelBytes = await readFile(join(release, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(privateShape(model.bindingIr), privateShape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(model.bindingIr), /(?:null|value)Constructor/u);
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const receipt = await copyPackageSetHandoff(release, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = await prepareRustCorpusDependencies({
			rustRoot: join(release, "native/rust"), directory: author
			, handoff: dependencyHandoff, environment
		});
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await cp(handoff, join(retained, "handoff"), { recursive: true });
		await cp(dependencyHandoff, join(retained, "dependency-handoff"), { recursive: true });
		await saveLakeFile(retained, "configuration.json", canonicalJson(configuration));
		await saveLakeFile(retained, "HostNullDemo.lean", await readFile(
			join(projectRoot, "HostNullDemo.lean")));
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });

		const installed = [];
		for(const profile of hostNullSystemsProfiles)
		{
			const packages = receipt.packages.filter(item => item.target === targetByProfile[profile]);
			assert.equal(packages.filter(item => item.role === "component").length, 1);
			const pkg = packages.find(item => item.role === "component");
			const extension = extensionByProfile[profile];
			const source = await readFile(
				`tests/fixtures/host-null-consumers/${profile}.${extension}`, "utf8");
			const fixture = {
				source: () => source, success: `host-null-${profile}`
				, expectedChecks: hostNullSystemsChecks[profile]
				, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
				, ...(profile === "wit-wasi" ? { wit: [
					/type bridge-value-1 = option<u32>/u
					, /type bridge-value-2 = option<option<u32>>/u
					, /type bridge-value-3 = option<option<u32>>/u
				] } : {})
			};
			const result = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, dependencies, fixture
			});
			delete result.command;
			const root0 = join(consumer, profile);
			const receiptPath = receiptByProfile[profile];
			const receiptBytes = await readFile(join(installedRoot(root0, profile, pkg), receiptPath));
			await saveLakeFile(retained, `${profile}/consumer.${extension}`, source);
			installed.push({ profile, extension, source, packages, pkg, result, receiptBytes });
		}
		await rm(handoff, { recursive: true, force: true });
		await rm(dependencyHandoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });
		await assert.rejects(access(dependencyHandoff), { code: "ENOENT" });

		const observations = [];
		for(const item of installed)
		{
			const current = join(consumer, item.profile);
			await rm(join(current, `consumer.${item.extension}`), { force: true });
			if(item.profile === "rust") await Promise.all([
				rm(join(current, "Cargo.toml"), { force: true })
				, rm(join(current, ".cargo"), { recursive: true, force: true })
				, rm(join(current, "cargo-home"), { recursive: true, force: true })
				, rm(join(current, "dependencies"), { recursive: true, force: true })
			]);
			else await rm(join(current, "tools"), { recursive: true, force: true });
			const relocated = join(consumer, `${item.profile}-relocated`);
			await rename(current, relocated);
			await assert.rejects(access(current), { code: "ENOENT" });
			await assert.rejects(access(join(relocated, `consumer.${item.extension}`)), { code: "ENOENT" });
			const closure = await verifyFinContainerEdgeFileClosure({
				installed: installedRoot(relocated, item.profile, item.pkg)
				, receiptPath: receiptByProfile[item.profile]
				, receiptBytes: item.receiptBytes
			});
			const rerun = await runCopied(executable(relocated, item.profile), [], relocated
				, runtimeEnvironment(relocated, item.profile, item.pkg));
			assert.equal(rerun.stderr, "");
			assert.equal(rerun.stdout
				, `host-null-${item.profile}:${hostNullSystemsChecks[item.profile]}\n`);
			observations.push({
				profile: item.profile, checks: item.result.checks
				, consumerSha256: sha256(item.source)
				, offlineInstall: item.result.offlineInstall
				, compilerFreePath: item.result.compilerFreePath
				, nestedOptionDistinct: true, positions
				, invalidRepresentationRejected: true
				, invalidRepresentationEnforcement: ["c", "wit-wasi"].includes(item.profile)
					? "runtime-validation" : "typed-public-carrier"
				, ownershipCleanup: true, sourceFreeRelocatedExecution: true
				, executions: [
					{ checks: hostNullSystemsChecks[item.profile], relocated: false }
					, { checks: hostNullSystemsChecks[item.profile], relocated: true }
				]
				, packages: item.packages, ...closure
			});
		}
		const report = {
			schemaVersion: 1, route, profiles: hostNullSystemsProfiles, producerCommit
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(modelBytes), rustDependencies: dependencies
			, observations, sourceRemovedBeforeInstallation: true
			, consumerSourceRemovedBeforeRelocatedExecution: true
			, installationHandoffRemovedBeforeRelocatedExecution: true
			, packageHandoffRetained: true, rustDependencyHandoffRetained: true
			, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		routes.push(report);
		complete = true;
	}
	const cells = routes.flatMap(route => route.observations.flatMap(observation =>
		observation.positions.map(position => ({
			route: route.route, profile: observation.profile, position
		}))
	));
	assert.equal(cells.length, selectedRoutes.length * hostNullSystemsProfiles.length * positions.length);
	if(selectedRoutes.length === 2) assert.equal(cells.length, 40);
	assert.equal(new Set(routes.map(route => route.bindingIrSha256)).size, 1);
	const summary = { schemaVersion: 1, producerCommit, routes, cells };
	await saveLakeFile(outputRoot, "summary.json", canonicalJson(summary));
	return summary;
};
