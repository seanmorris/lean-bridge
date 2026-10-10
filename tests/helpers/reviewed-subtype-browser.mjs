/**
 * Execute independently reviewed Subtype archives in real source-free browser consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";
import { assertReviewedSubtypeNpmRecords } from "./reviewed-subtype-npm-report.mjs";
import { reviewedSubtypeBrowserPackage, reviewedSubtypeBrowserProfiles, validateReviewedSubtypeBrowserObservation, validateReviewedSubtypeBrowserPhases } from "./reviewed-subtype-browser-fixture.mjs";

const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
const fixture = "tests/fixtures/reviewed-subtype-consumers";

/**
 * Use only the verified archive handoff after the npm producer has removed both author roots.
 *
 * @param options - Existing source-free npm handoff and original build records.
 * @param options.directory - Disposable browser-consumer parent directory.
 * @param options.handoff - Archive handoff directory.
 * @param options.receipt - Verified component and shared-runtime receipt.
 * @param options.records - Retained npm compiler, author and caller records.
 */
export const checkReviewedSubtypeBrowsers = async ({ directory, handoff, receipt, records }) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	const npm = await assertReviewedSubtypeNpmRecords(path => readFile(join(records, path)));
	assert.deepEqual(npm.receipt, receipt);
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const reports = [];
	for(const profile of reviewedSubtypeBrowserProfiles)
	{
		const root = join(directory, profile), bin = join(root, "bin"), retained = join(records, profile);
		await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(root, name, "");
		const framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const environment = { ...clean, PATH: bin };
		const args = [npmCli, "install", "--offline", "--ignore-scripts"
			, "--no-audit", "--no-fund", "--userconfig", join(root, "user.npmrc")
			, "--globalconfig", join(root, "global.npmrc")
			, "--cache", join(root, "empty-cache")
			, join(handoff, receipt.runtime.archive)
			, join(handoff, receipt.package.archive)
			, ...framework.map(item => join(root, item.archive))];
		await processBuildRunner.capture({ command: process.execPath, args, cwd: root, env: environment, timeoutMs: 300_000 });
		await saveLakeFile(root, "request.json", canonicalJson({ module: "subtypes", profile }));
		await saveLakeFile(root, "javascript.mjs", await readFile(join(fixture, "browser.mjs")));
		await saveLakeFile(root, "check.mjs", await readFile(join(fixture, "javascript.mjs")));
		const observations = [], inputs = {};
		const consumer = { packageSource: reviewedSubtypeBrowserPackage
			, validateObservation: (observation, phase) => {
				validateReviewedSubtypeBrowserObservation(observation, profile);
				observations.push({ ...phase, observation });
			}
			, beforeInstallRemoval: async () => {
				const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
				for(const name of ["package.json", "package-lock.json", "request.json", "package.mjs", "index.html", "javascript.mjs", "check.mjs", `${entry}.mjs`, ...profile === "browser-worker" ? ["worker.mjs"] : []])
				{
					const bytes = await readFile(join(root, name));
					await saveLakeFile(retained, name, bytes); inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
				const installed = join(root, "node_modules/subtypes");
				const binding = await readFile(join(installed, "metadata/binding-ir.json"));
				assert.equal(hashBindingIr(JSON.parse(binding)), npm.bindingIrSha256);
				await saveLakeFile(retained, "installed-binding-ir.json", binding);
				const declarations = await readFile(join(installed, "index.d.ts"));
				assert.equal(sha256(declarations), npm.typescript.declarationsSha256);
				await saveLakeFile(retained, "installed-index.d.ts", declarations);
				const runtimeRoot = join(root, "node_modules/@lean-bridge/runtime");
				const identity = await readFile(join(runtimeRoot, "runtime-identity.json"));
				const manifest = await readFile(join(runtimeRoot, "package.json"));
				const metadata = JSON.parse(manifest), basis = JSON.parse(identity);
				assert.equal(metadata.leanBridge.runtimeIdentity, sha256(canonicalJson(basis)));
				assert.equal(metadata.name + "@" + metadata.version, receipt.runtime.package);
				assert.equal(metadata.version, "0.0.0-abi" + basis.metadata.leanBridge.componentScalarAbi + "." + metadata.leanBridge.runtimeIdentity);
				assert.equal(sha256(await readFile(join(runtimeRoot, "internal/main.wasm"))), basis.files.find(file => file.path === "internal/main.wasm").sha256);
				await saveLakeFile(retained, "installed-runtime-identity.json", identity);
				await saveLakeFile(retained, "installed-runtime-package.json", manifest);
				await saveLakeFile(retained, "installed-component-package.json", await readFile(join(installed, "package.json")));
				await saveLakeFile(retained, "inputs.json", canonicalJson(inputs));
			}
		};
		const result = await installedBrowserCorpus({ library: { npmModule: "subtypes" }, profile, root, framework, environment, consumer })
			.finally(() => saveLakeFile(retained, "observations.json", canonicalJson(observations)));
		validateReviewedSubtypeBrowserPhases(observations, profile, requestedEngines);
		const report = { schemaVersion: 1, profile, path: "reviewed-source"
			, bindingIrSha256: npm.bindingIrSha256, receiptSha256: npm.receiptSha256
			, corpusSha256: npm.corpusSha256
			, packageSourceSha256: sha256(reviewedSubtypeBrowserPackage)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true
			, inputs, observations, ...result };
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		reports.push(report);
	}
	await saveLakeFile(records, "browser.json", canonicalJson({ schemaVersion: 1, requestedEngines, reports }));
	return reports;
};
