/**
 * Execute retained zero-payload packages in real source-free browser consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	verifyComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import {
	browserFrameworkArchives, installedBrowserCorpus
} from "./type-corpus-browser.mjs";
import {
	validateZeroPayloadBrowserObservation
	, validateZeroPayloadBrowserPhases
	, zeroPayloadBrowserCaller
	, zeroPayloadBrowserEngines
	, zeroPayloadBrowserExpected
	, zeroPayloadBrowserName
	, zeroPayloadBrowserPackageSource
	, zeroPayloadBrowserProfiles
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

const clean = {
	PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};
const fixture = "tests/fixtures/zero-payload-checked-record-browser";

/**
 * Consume only a retained handoff after both Lean author roots were removed.
 *
 * @param options - Frozen npm records and isolated browser workspace.
 * @param options.directory - Disposable browser-consumer parent directory.
 * @param options.records - Route records containing the package handoff.
 * @param options.route - Exact author route.
 * @param options.producerCommit - Package-producing revision.
 * @param options.consumerCommit - Browser-consuming revision.
 * @param options.runtime - Observed Node identity.
 */
export const checkZeroPayloadBrowsers = async ({
	directory, records, route, producerCommit, consumerCommit, runtime
}) => {
	const { resultOnly } = zeroPayloadBrowserSelection(route);
	const requestedEngines = corpusBrowserSelection(
		process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(requestedEngines, zeroPayloadBrowserEngines);
	const npm = JSON.parse(await readFile(join(records, "report.json")));
	assert.equal(npm.route, route);
	assert.equal(npm.producerCommit, producerCommit);
	assert.deepEqual(npm.runtime, runtime);
	assert.deepEqual(npm.expected, zeroPayloadBrowserExpected(route));
	assert.equal(npm.independentBuilds, 2);
	assert.equal(npm.reproducible, true);
	assert.equal(npm.sourceRemovedBeforeInstallation, true);
	const handoff = join(directory, "handoff");
	await cp(join(records, "handoff"), handoff, {
		recursive: true, errorOnExist: true, force: false
	});
	await verifyComponentPackageReceipt({
		receiptPath: join(handoff, "component-package-receipt.json")
	});
	const reports = [];
	for(const profile of zeroPayloadBrowserProfiles)
	{
		const root = join(directory, profile), bin = join(root, "bin");
		const retained = join(records, "browser", profile);
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(root, "package.json"
			, canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"])
			await saveLakeFile(root, name, "");
		const framework = profile === "browser-react"
			? await browserFrameworkArchives(root) : [];
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const environment = { ...clean, PATH: bin };
		const args = [
			npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"
			, "--userconfig", join(root, "user.npmrc")
			, "--globalconfig", join(root, "global.npmrc")
			, "--cache", join(root, "empty-cache")
			, join(handoff, npm.receipt.runtime.archive)
			, join(handoff, npm.receipt.package.archive)
			, ...framework.map(item => join(root, item.archive))
		];
		const install = await processBuildRunner.capture({
			command: process.execPath, args, cwd: root
			, env: environment, timeoutMs: 300_000
		});
		await saveLakeFile(retained, "install.json", canonicalJson(install));
		const verifyInstalled = async () => {
			for(const [name, expected] of Object.entries(npm.trees))
			{
				const actual = {};
				const installed = join(root, "node_modules", name);
				for(const path of await nativeArtifactPaths(installed))
					actual[path] = sha256(await readFile(join(installed, path)));
				assert.deepEqual(actual, expected, `Complete installed ${name} closure`);
			}
		};
		await verifyInstalled();
		await saveLakeFile(root, "request.json", canonicalJson({
			module: zeroPayloadBrowserName, profile, route, resultOnly
		}));
		await saveLakeFile(root, "javascript.mjs"
			, await readFile(join(fixture, "browser.mjs")));
		await saveLakeFile(root, "check.mjs"
			, await zeroPayloadBrowserCaller(route));
		const observations = [], inputs = {};
		const consumer = {
			packageSource: zeroPayloadBrowserPackageSource
			, validateObservation: (observation, phase) => {
				validateZeroPayloadBrowserObservation(observation, profile, route);
				observations.push({ ...phase, observation });
			}
			, beforeInstallRemoval: async () => {
				await verifyInstalled();
				const entry = {
					"browser-javascript": "plain", "browser-react": "react"
					, "browser-worker": "worker-main"
				}[profile];
				for(const name of [
					"package.json", "package-lock.json", "request.json", "package.mjs"
					, "index.html", "javascript.mjs", "check.mjs", `${entry}.mjs`
					, ...profile === "browser-worker" ? ["worker.mjs"] : []
				]) {
					const bytes = await readFile(join(root, name));
					await saveLakeFile(retained, name, bytes);
					inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
				const installed = join(root, "node_modules", zeroPayloadBrowserName);
				const binding = await readFile(join(installed, "metadata/binding-ir.json"));
				assert.equal(hashBindingIr(JSON.parse(binding))
					, npm.builds[0].bindingIrSha256);
				await saveLakeFile(retained, "installed-binding-ir.json", binding);
				const declarations = await readFile(join(installed, "index.d.ts"));
				assert.equal(sha256(declarations)
					, npm.trees[zeroPayloadBrowserName]["index.d.ts"]);
				await saveLakeFile(retained, "installed-index.d.ts", declarations);
				const runtimeRoot = join(root, "node_modules/@lean-bridge/runtime");
				const identity = await readFile(join(runtimeRoot, "runtime-identity.json"));
				const manifest = await readFile(join(runtimeRoot, "package.json"));
				const metadata = JSON.parse(manifest), basis = JSON.parse(identity);
				assert.equal(metadata.leanBridge.runtimeIdentity
					, sha256(canonicalJson(basis)));
				assert.equal(`${metadata.name}@${metadata.version}`
					, npm.receipt.runtime.package);
				const main = basis.files.find(file => file.path === "internal/main.wasm");
				assert.equal(sha256(await readFile(join(runtimeRoot, main.path)))
					, main.sha256);
				await saveLakeFile(retained, "installed-runtime-identity.json", identity);
				await saveLakeFile(retained, "installed-runtime-package.json", manifest);
				await saveLakeFile(retained, "installed-component-package.json"
					, await readFile(join(installed, "package.json")));
				await saveLakeFile(retained, "inputs.json", canonicalJson(inputs));
			}
		};
		const result = await installedBrowserCorpus({
			library: { npmModule: zeroPayloadBrowserName }
			, profile, root, framework, environment, consumer
		}).finally(() => saveLakeFile(retained, "observations.json"
			, canonicalJson(observations)));
		validateZeroPayloadBrowserPhases(
			observations, profile, requestedEngines, route);
		const report = {
			schemaVersion: 1, profile, route, producerCommit, consumerCommit
			, bindingIrSha256: npm.builds[0].bindingIrSha256
			, receiptSha256: npm.builds[0].receiptSha256
			, corpusSha256: npm.callers["check.mjs"]
			, packageSourceSha256: sha256(zeroPayloadBrowserPackageSource)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true, inputs, observations, ...result
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		reports.push(report);
	}
	const report = {
		schemaVersion: 1, route, producerCommit, consumerCommit
		, requestedEngines, reports
	};
	await saveLakeFile(records, "browser.json", canonicalJson(report));
	return report;
};
