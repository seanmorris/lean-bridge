/**
 * Execute dependent checked-record packages in real source-free browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
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
	dependentCheckedRecordBrowserPackage
	, dependentCheckedRecordEngines
	, dependentCheckedRecordName
	, dependentCheckedRecordProfiles
	, dependentCheckedRecordSelection
	, validateDependentCheckedRecordObservation
	, validateDependentCheckedRecordPhases
} from "./dependent-checked-record-browser-fixture.mjs";

const clean = {
	PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};
const fixture = "tests/fixtures/dependent-checked-record-browser";

/**
 * Use only a verified archive handoff after both author roots were removed.
 *
 * @param options - Frozen npm records and isolated browser workspace.
 */
export const checkDependentCheckedRecordBrowsers = async options => {
	const {
		directory, handoff, receipt, records, route, producerCommit
	} = options;
	const { resultOnly } = dependentCheckedRecordSelection(route);
	const requestedEngines = corpusBrowserSelection(
		process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS
	);
	assert.deepEqual(requestedEngines, dependentCheckedRecordEngines);
	const npm = JSON.parse(await readFile(join(records, "report.json")));
	assert.equal(npm.route, route);
	assert.equal(npm.producerCommit, producerCommit);
	assert.deepEqual(npm.receipt, receipt);
	await verifyComponentPackageReceipt({
		receiptPath: join(handoff, "component-package-receipt.json")
	});
	const reports = [];
	for(const profile of dependentCheckedRecordProfiles)
	{
		const root = join(directory, profile);
		const bin = join(root, "bin");
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
			npmCli, "install", "--offline", "--ignore-scripts"
			, "--no-audit", "--no-fund", "--userconfig"
			, join(root, "user.npmrc"), "--globalconfig"
			, join(root, "global.npmrc"), "--cache", join(root, "empty-cache")
			, join(handoff, receipt.runtime.archive)
			, join(handoff, receipt.package.archive)
			, ...framework.map(item => join(root, item.archive))
		];
		const install = await processBuildRunner.capture({
			command: process.execPath, args, cwd: root, env: environment
			, timeoutMs: 300_000
		});
		await saveLakeFile(retained, "install.json", canonicalJson(install));
		const verifyInstalled = async () => {
			for(const [name, expected] of Object.entries(npm.trees))
			{
				const installed = join(root, "node_modules", name);
				const actual = {};
				for(const path of await nativeArtifactPaths(installed))
					actual[path] = sha256(await readFile(join(installed, path)));
				assert.deepEqual(actual, expected
					, `Complete installed ${name} archive closure`);
			}
		};
		await verifyInstalled();
		await saveLakeFile(root, "request.json", canonicalJson({
			module: dependentCheckedRecordName, profile, route, resultOnly
		}));
		await saveLakeFile(root, "javascript.mjs"
			, await readFile(join(fixture, "browser.mjs")));
		await saveLakeFile(root, "check.mjs"
			, await readFile(join(fixture, "javascript.mjs")));
		const observations = [], inputs = {};
		const consumer = {
			packageSource: dependentCheckedRecordBrowserPackage
			, validateObservation: (observation, phase) => {
				validateDependentCheckedRecordObservation(
					observation, profile, route
				);
				observations.push({ ...phase, observation });
			}
			, beforeInstallRemoval: async () => {
				await verifyInstalled();
				const entry = {
					"browser-javascript": "plain", "browser-react": "react"
					, "browser-worker": "worker-main"
				}[profile];
				for(const name of [
					"package.json", "package-lock.json", "request.json"
					, "package.mjs", "index.html", "javascript.mjs", "check.mjs"
					, `${entry}.mjs`
					, ...profile === "browser-worker" ? ["worker.mjs"] : []
				]) {
					const bytes = await readFile(join(root, name));
					await saveLakeFile(retained, name, bytes);
					inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
				const installed = join(
					root, "node_modules", dependentCheckedRecordName
				);
				const binding = await readFile(join(
					installed, "metadata/binding-ir.json"
				));
				assert.equal(hashBindingIr(JSON.parse(binding))
					, npm.builds[0].bindingIrSha256);
				await saveLakeFile(retained, "installed-binding-ir.json", binding);
				const declarations = await readFile(join(installed, "index.d.ts"));
				assert.equal(sha256(declarations)
					, npm.trees[dependentCheckedRecordName]["index.d.ts"]);
				await saveLakeFile(retained, "installed-index.d.ts", declarations);
				const runtimeRoot = join(
					root, "node_modules/@lean-bridge/runtime"
				);
				const identity = await readFile(join(
					runtimeRoot, "runtime-identity.json"
				));
				const manifest = await readFile(join(runtimeRoot, "package.json"));
				const metadata = JSON.parse(manifest), basis = JSON.parse(identity);
				assert.equal(metadata.leanBridge.runtimeIdentity
					, sha256(canonicalJson(basis)));
				assert.equal(metadata.name + "@" + metadata.version
					, receipt.runtime.package);
				assert.equal(sha256(await readFile(join(
					runtimeRoot, "internal/main.wasm"
				))), basis.files.find(
					file => file.path === "internal/main.wasm"
				).sha256);
				await saveLakeFile(retained, "installed-runtime-identity.json", identity);
				await saveLakeFile(retained, "installed-runtime-package.json", manifest);
				await saveLakeFile(retained, "installed-component-package.json"
					, await readFile(join(installed, "package.json")));
				await saveLakeFile(retained, "inputs.json", canonicalJson(inputs));
			}
		};
		const result = await installedBrowserCorpus({
			library: { npmModule: dependentCheckedRecordName }
			, profile, root, framework, environment, consumer
		}).finally(() => saveLakeFile(
			retained, "observations.json", canonicalJson(observations)
		));
		validateDependentCheckedRecordPhases(
			observations, profile, requestedEngines, route
		);
		const report = {
			schemaVersion: 1, profile, route, producerCommit
			, bindingIrSha256: npm.builds[0].bindingIrSha256
			, receiptSha256: npm.builds[0].receiptSha256
			, corpusSha256: npm.corpusSha256
			, packageSourceSha256: sha256(dependentCheckedRecordBrowserPackage)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true
			, inputs, observations, ...result
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		reports.push(report);
	}
	await saveLakeFile(records, "browser.json", canonicalJson({
		schemaVersion: 1, route, producerCommit, requestedEngines, reports
	}));
	return reports;
};
