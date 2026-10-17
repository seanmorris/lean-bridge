/**
 * Execute retained inherited checked-record npm packages in real source-free browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import {
	browserFrameworkArchives,
	installedBrowserCorpus
} from "./type-corpus-browser.mjs";
import { checkInheritedCheckedRecordNpmReport } from "./inherited-checked-record-npm-report.mjs";
import { inheritedCheckedRecordNpmSelection } from "./inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserEngines,
	inheritedCheckedRecordBrowserPackage,
	inheritedCheckedRecordBrowserProfiles,
	validateInheritedCheckedRecordBrowserObservation,
	validateInheritedCheckedRecordBrowserPhases
} from "./inherited-checked-record-browser-fixture.mjs";

const clean = {
	PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};
const fixture = "tests/fixtures/inherited-checked-record-consumers";

/**
 * Use only a retained npm handoff after both Lean author roots were removed.
 *
 * @param options - Accepted npm records and isolated browser workspace.
 * @param options.directory - Disposable browser-consumer parent directory.
 * @param options.records - Retained route records containing the npm handoff.
 * @param options.route - Exact ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Frozen package producer revision.
 * @param options.consumerCommit - Frozen browser caller and checker revision.
 * @param options.runtime - Independently observed Node identity for npm records.
 */
export const checkInheritedCheckedRecordBrowsers = async ({
	directory, records, route, producerCommit, consumerCommit, runtime
}) => {
	const selection = inheritedCheckedRecordNpmSelection(route);
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(requestedEngines, inheritedCheckedRecordBrowserEngines);
	await checkInheritedCheckedRecordNpmReport(path => readFile(join(records, path)), {
		route, producerCommit, runtime
	});
	const npm = JSON.parse(await readFile(join(records, "report.json")));
	const handoff = join(directory, "handoff");
	await cp(join(records, "handoff"), handoff, {
		recursive: true, errorOnExist: true, force: false
	});
	await verifyComponentPackageReceipt({
		receiptPath: join(handoff, "component-package-receipt.json")
	});
	const reports = [];
	for(const profile of inheritedCheckedRecordBrowserProfiles)
	{
		const root = join(directory, profile), bin = join(root, "bin");
		const retained = join(records, "browser", profile);
		await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
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
				const installed = join(root, "node_modules", name), actual = {};
				for(const path of await nativeArtifactPaths(installed))
					actual[path] = sha256(await readFile(join(installed, path)));
				assert.deepEqual(actual, expected, `Complete installed ${name} archive closure`);
			}
		};
		await verifyInstalled();
		await saveLakeFile(root, "request.json", canonicalJson({
			module: "inheritedcheckedrecords", profile, route
			, resultOnly: selection.resultOnly
		}));
		await saveLakeFile(root, "javascript.mjs", await readFile(join(fixture, "browser.mjs")));
		await saveLakeFile(root, "check.mjs", await readFile(join(fixture, "javascript.mjs")));
		const observations = [], inputs = {};
		const consumer = {
			packageSource: inheritedCheckedRecordBrowserPackage
			, validateObservation: (observation, phase) => {
				validateInheritedCheckedRecordBrowserObservation(observation, profile, route);
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
				const installed = join(root, "node_modules/inheritedcheckedrecords");
				const binding = await readFile(join(installed, "metadata/binding-ir.json"));
				assert.equal(hashBindingIr(JSON.parse(binding)), npm.builds[0].bindingIrSha256);
				await saveLakeFile(retained, "installed-binding-ir.json", binding);
				const declarations = await readFile(join(installed, "index.d.ts"));
				assert.equal(sha256(declarations), npm.trees.inheritedcheckedrecords["index.d.ts"]);
				await saveLakeFile(retained, "installed-index.d.ts", declarations);
				const runtimeRoot = join(root, "node_modules/@lean-bridge/runtime");
				const identity = await readFile(join(runtimeRoot, "runtime-identity.json"));
				const manifest = await readFile(join(runtimeRoot, "package.json"));
				const metadata = JSON.parse(manifest), basis = JSON.parse(identity);
				assert.equal(metadata.leanBridge.runtimeIdentity, sha256(canonicalJson(basis)));
				assert.equal(`${metadata.name}@${metadata.version}`, npm.receipt.runtime.package);
				const main = basis.files.find(file => file.path === "internal/main.wasm");
				assert.equal(sha256(await readFile(join(runtimeRoot, main.path))), main.sha256);
				await saveLakeFile(retained, "installed-runtime-identity.json", identity);
				await saveLakeFile(retained, "installed-runtime-package.json", manifest);
				await saveLakeFile(retained, "installed-component-package.json"
					, await readFile(join(installed, "package.json")));
				await saveLakeFile(retained, "inputs.json", canonicalJson(inputs));
			}
		};
		const result = await installedBrowserCorpus({
			library: { npmModule: "inheritedcheckedrecords" }, profile, root, framework
			, environment, consumer
		}).finally(() => saveLakeFile(retained, "observations.json", canonicalJson(observations)));
		validateInheritedCheckedRecordBrowserPhases(
			observations, profile, requestedEngines, route);
		const report = {
			schemaVersion: 1, profile, route, producerCommit, consumerCommit
			, bindingIrSha256: npm.builds[0].bindingIrSha256
			, receiptSha256: npm.builds[0].receiptSha256
			, corpusSha256: npm.callers["check.mjs"]
			, packageSourceSha256: sha256(inheritedCheckedRecordBrowserPackage)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true
			, inputs, observations, ...result
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
