/**
 * Replay the supplemental strict-constructor and variant-refusal callers against
 * original, authenticated full packages from the primitive-base npm and Python archives.
 * No Lean, compiler or package build runs: each package is the archived original, installed
 * offline into a fresh consumer, executed, physically relocated and executed again.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import {
	attachFinContainerEdgePythonPackage
	, createFinContainerEdgePythonEnvironment
	, finContainerEdgePythonFlags
	, runFinContainerEdgePython
	, verifyFinContainerEdgePythonEnvironment
} from "./fin-container-edge-python-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	nominalPrimitiveSubtypeBrowserEngines
	, nominalPrimitiveSubtypeBrowserPhases
	, nominalPrimitiveSubtypeBrowserProfiles
} from "./nominal-primitive-subtype-browser-fixture.mjs";
import { nominalPrimitiveSubtypeName } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypeNpmArchive, nominalPrimitiveSubtypeNpmArchive } from "./nominal-primitive-subtype-npm-archive.mjs";
import { checkNominalPrimitiveSubtypePythonArchive, nominalPrimitiveSubtypePythonArchive } from "./nominal-primitive-subtype-python-archive.mjs";
import { nominalPrimitiveSubtypePythonReceipt } from "./nominal-primitive-subtype-python-wheel.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";

export const nominalPrimitiveSupplementRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSupplementCounts = Object.freeze({ checks: 126, rejections: 23, strictValues: 17, variantRefusals: 6 });
const consumers = "tests/fixtures/nominal-primitive-subtype-consumers";

/**
 * Read one authenticated archive member and require its recorded identity.
 *
 * @param archive - Repository-relative archive directory.
 * @param index - Parsed, digest-checked archive index.
 * @param path - Member path below the archive.
 */
const member = async (archive, index, path) => {
	const entry = index.files.find(item => item.path === path);
	assert.ok(entry, path); const bytes = await readFile(join(archive, path));
	assert.equal(bytes.length, entry.bytes, path); assert.equal(sha256(bytes), entry.sha256, path);
	return bytes;
};

/**
 * Copy one authenticated full-API npm handoff out of the immutable archive.
 *
 * @param route - Ordinary or reviewed author route.
 * @param directory - Fresh scratch directory.
 */
const archivedNpmHandoff = async (route, directory) => {
	await checkNominalPrimitiveSubtypeNpmArchive();
	const index = JSON.parse(await readFile(join(nominalPrimitiveSubtypeNpmArchive, "index.json")));
	const prefix = `${route}/full/records/handoff/`, handoff = join(directory, "handoff");
	await mkdir(handoff, { recursive: true });
	for(const entry of index.files.filter(item => item.path.startsWith(prefix)))
	{
		const bytes = await member(nominalPrimitiveSubtypeNpmArchive, index, entry.path);
		await saveLakeFile(handoff, entry.path.slice(prefix.length), bytes);
	}
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "component-package-receipt.json")));
	const reportPath = `${route}/full/records/report.json`;
	const original = JSON.parse(await member(nominalPrimitiveSubtypeNpmArchive, index, reportPath));
	assert.deepEqual(original.receipt, receipt);
	return { index, handoff, receipt, trees: original.trees };
};

/**
 * Install the archived ordinary or reviewed full npm package offline and run the supplement twice.
 *
 * @param options - Selected route and exclusively owned directories.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.directory - Fresh scratch directory for the consumer.
 * @param options.output - New original-record destination.
 */
export const replayNominalPrimitiveSupplementNpm = async ({ route, directory, output }) => {
	assert.ok(nominalPrimitiveSupplementRoutes.includes(route));
	const { index, handoff, receipt } = await archivedNpmHandoff(route, directory);
	const consumer = join(directory, "consumer"), moved = join(directory, "relocated-consumer"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const clean = root => ({ ...copiedCleanEnvironment, PATH: join(root, "bin"), NODE_PATH: "", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" });
	const installArgs = [
		npmCli, "install", "--offline", "--ignore-scripts", "--no-audit"
		, "--no-fund", "--userconfig", join(consumer, "user.npmrc")
		, "--globalconfig", join(consumer, "global.npmrc")
		, "--cache", join(consumer, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)
	];
	const install = await runCopied(process.execPath, installArgs, consumer, clean(consumer));
	await saveLakeFile(output, "install.json", canonicalJson(install));
	const callers = {
		"index.mjs": `import * as api from "${nominalPrimitiveSubtypeName}";\nimport {checkNominalPrimitiveSupplement} from "./fixtures/javascript-supplement.mjs";\nconsole.log(JSON.stringify(checkNominalPrimitiveSupplement(api)));\n`
	};
	for(const name of ["javascript.mjs", "javascript-supplement.mjs"])
		callers[`fixtures/${name}`] = await readFile(join(consumers, name), "utf8");
	for(const [path, source] of Object.entries(callers))
	{ await saveLakeFile(consumer, path, source); await saveLakeFile(output, `callers/${path}`, source); }
	const observations = [];
	for(const root of [consumer, moved])
	{
		if(root === moved)
		{ await rename(consumer, moved); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const run = await runCopied(process.execPath, ["index.mjs"], root, clean(root));
		assert.equal(run.stderr, ""); assert.deepEqual(JSON.parse(run.stdout), nominalPrimitiveSupplementCounts);
		for(const [path, source] of Object.entries(callers)) assert.equal(await readFile(join(root, path), "utf8"), source, path);
		observations.push({ relocated: root === moved, run });
		await saveLakeFile(output, root === moved ? "relocated.json" : "installed.json", canonicalJson(observations.at(-1)));
	}
	const archiveIndex = await readFile(join(nominalPrimitiveSubtypeNpmArchive, "index.json"));
	const callerDigests = Object.entries(callers).map(([path, source]) => [path, sha256(source)]);
	const report = {
		schemaVersion: 1, host: "npm", route, mode: "full"
		, archiveSha256: sha256(archiveIndex), producerCommit: index.producerCommit
		, receipt, observations, counts: nominalPrimitiveSupplementCounts
		, callers: Object.fromEntries(callerDigests)
		, originalPackage: true, leanBuild: false
		, offlineInstall: true, relocatedInstallation: true
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	return report;
};

/**
 * Install the archived ordinary or reviewed full wheel in a fresh venv and run the supplement twice.
 *
 * @param options - Selected route, interpreter and exclusively owned directories.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.minor - Archived Python floor, 3.11 or 3.12.
 * @param options.command - Absolute interpreter path for that floor.
 * @param options.root - Fresh consumer directory; it is moved to root + "-relocated".
 * @param options.output - New original-record destination.
 */
export const replayNominalPrimitiveSupplementPython = async ({ route, minor, command, root, output }) => {
	assert.ok(nominalPrimitiveSupplementRoutes.includes(route)); assert.ok(["3.11", "3.12"].includes(minor)); assert.ok(isAbsolute(command));
	await checkNominalPrimitiveSubtypePythonArchive();
	const index = JSON.parse(await readFile(join(nominalPrimitiveSubtypePythonArchive, "index.json")));
	const records = `${route}/full/records/`;
	const packageSet = JSON.parse(await member(nominalPrimitiveSubtypePythonArchive, index, records + "handoff/package-set-receipt.json"));
	const artifact = packageSet.packages[0].artifacts[0];
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const wheel = join(root, artifact.path.split("/").at(-1));
	await saveLakeFile(root, wheel.slice(root.length + 1), await member(nominalPrimitiveSubtypePythonArchive, index, records + "handoff/" + artifact.path));
	const wheelBytes = await readFile(wheel); assert.equal(sha256(wheelBytes), artifact.sha256);
	const receiptRun = await runCopied("/usr/bin/unzip", ["-p", wheel, nominalPrimitiveSubtypePythonReceipt], root);
	assert.equal(receiptRun.stderr, ""); const receiptBytes = Buffer.from(receiptRun.stdout);
	const source = await readFile(join(consumers, "python-supplement.py"), "utf8");
	const args = ["consumer.py", ...route === "reviewed" ? ["--reviewed"] : []];
	await saveLakeFile(root, "consumer.py", source); await saveLakeFile(output, "callers/consumer.py", source);
	const baseline = await createFinContainerEdgePythonEnvironment({ baseCommand: command, venv: join(root, "venv"), cwd: root });
	assert.equal(baseline.python.split(".").slice(0, 2).join("."), minor);
	await saveLakeFile(output, "baseline.json", canonicalJson(baseline));
	const cache = await mkdtemp(join(root, ".supplement-pip-bytecode-"));
	try
	{
		const arguments_ = [
			...finContainerEdgePythonFlags(cache), "-m", "pip", "--isolated"
			, "install", "--no-index", "--no-deps", "--no-cache-dir"
			, "--no-compile", wheel
		];
		const run = await runCopied(join(baseline.venv, "bin/python"), arguments_, root);
		await saveLakeFile(output, "pip.json", canonicalJson({ arguments: arguments_, environment: copiedCleanEnvironment, run }));
	}
	finally
	{ assert.deepEqual(await readdir(cache), []); await rm(cache, { recursive: true }); }
	await rm(wheel);
	const installed = await attachFinContainerEdgePythonPackage(baseline, { receiptPath: nominalPrimitiveSubtypePythonReceipt, receiptBytes });
	const observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const context = { ...installed, venv: join(location, "venv") };
		const before = await verifyFinContainerEdgePythonEnvironment(context);
		const run = await runFinContainerEdgePython(context, args, location);
		assert.equal(run.stderr, ""); assert.deepEqual(JSON.parse(run.stdout), nominalPrimitiveSupplementCounts);
		assert.deepEqual(await verifyFinContainerEdgePythonEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		observations.push({ relocated: Boolean(position), arguments: args, run });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
	}
	const archiveIndex = await readFile(join(nominalPrimitiveSubtypePythonArchive, "index.json"));
	const report = {
		schemaVersion: 1, host: "python", route, mode: "full"
		, minor, python: baseline.python, archiveSha256: sha256(archiveIndex)
		, producerCommit: index.producerCommit, wheelSha256: artifact.sha256
		, receiptSha256: sha256(receiptBytes), consumerSha256: sha256(source)
		, observations, counts: nominalPrimitiveSupplementCounts
		, originalPackage: true, leanBuild: false
		, offlineInstall: true, relocatedInstallation: true
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	return report;
};

/**
 * Require the supplement result from one browser lifecycle observation.
 *
 * @param result - Original browser callback record.
 * @param profile - Required browser context.
 * @param route - Required author route.
 */
const validateSupplementObservation = (result, profile, route) => {
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: nominalPrimitiveSubtypeName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: {
			module: nominalPrimitiveSubtypeName, route, mode: "full", resultOnly: false
			, ...nominalPrimitiveSupplementCounts
		}
		, hostVersion: result.hostVersion
	});
};

/**
 * Install the archived full npm package in each browser context and run the supplement
 * through every lifecycle phase in Chromium, Firefox and WebKit.
 *
 * @param options - Selected route and exclusively owned directories.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.directory - Fresh scratch directory for the browser consumers.
 * @param options.output - New original-record destination.
 */
export const replayNominalPrimitiveSupplementBrowsers = async ({ route, directory, output }) => {
	assert.ok(nominalPrimitiveSupplementRoutes.includes(route));
	const engines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(engines, nominalPrimitiveSubtypeBrowserEngines);
	const { index, handoff, receipt, trees } = await archivedNpmHandoff(route, directory);
	const sources = ["browser-supplement.mjs", "javascript-supplement.mjs", "javascript.mjs"];
	const entrySource = 'export { executeCorpus } from "./fixtures/nominal-primitive-subtype-consumers/browser-supplement.mjs";\n';
	const packageSource = `import request from "./request.json";\nexport { request };\nexport const loadApi = () => import("${nominalPrimitiveSubtypeName}");\n`;
	const reports = [];
	for(const profile of nominalPrimitiveSubtypeBrowserProfiles)
	{
		const root = join(directory, profile), bin = join(root, "bin"), retained = join(output, profile);
		await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(root, name, "");
		const framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const environment = {
			PATH: bin, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
			, LEAN_BRIDGE_LEAN: "/unavailable/lean"
			, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
			, NODE_PATH: ""
		};
		const args = [
			npmCli, "install", "--offline", "--ignore-scripts", "--no-audit"
			, "--no-fund", "--userconfig", join(root, "user.npmrc")
			, "--globalconfig", join(root, "global.npmrc")
			, "--cache", join(root, "empty-cache")
			, join(handoff, receipt.runtime.archive)
			, join(handoff, receipt.package.archive)
			, ...framework.map(item => join(root, item.archive))
		];
		const install = await processBuildRunner.capture({ command: process.execPath, args, cwd: root, env: environment, timeoutMs: 300_000 });
		await saveLakeFile(retained, "install.json", canonicalJson(install));
		const verifyInstalled = async () => {
			for(const [name, expected] of Object.entries(trees))
			{
				const installed = join(root, "node_modules", name), actual = {};
				for(const path of await nativeArtifactPaths(installed))
					actual[path] = sha256(await readFile(join(installed, path)));
				assert.deepEqual(actual, expected, `Complete installed ${name} archive closure`);
			}
		};
		await verifyInstalled();
		const request = { module: nominalPrimitiveSubtypeName, profile, route, mode: "full", resultOnly: false };
		await saveLakeFile(root, "request.json", canonicalJson(request));
		await saveLakeFile(root, "javascript.mjs", entrySource);
		for(const name of sources)
			await saveLakeFile(root, `fixtures/nominal-primitive-subtype-consumers/${name}`, await readFile(join(consumers, name)));
		const observations = [], inputs = {};
		const consumer = {
			packageSource
			, validateObservation: (observation, phase) => {
				validateSupplementObservation(observation, profile, route);
				observations.push({ ...phase, observation });
			}
			, beforeInstallRemoval: async () => {
				await verifyInstalled();
				const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
				const retainedInputs = [
					"package.json", "package-lock.json", "request.json"
					, "package.mjs", "index.html", "javascript.mjs", `${entry}.mjs`
					, ...profile === "browser-worker" ? ["worker.mjs"] : []
					, ...sources.map(name => `fixtures/nominal-primitive-subtype-consumers/${name}`)
				];
				for(const name of retainedInputs)
				{
					const bytes = await readFile(join(root, name));
					await saveLakeFile(retained, name, bytes); inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
				await saveLakeFile(retained, "inputs.json", canonicalJson(inputs));
			}
		};
		const library = { npmModule: nominalPrimitiveSubtypeName };
		const result = await installedBrowserCorpus({ library, profile, root, framework, environment, consumer })
			.finally(() => saveLakeFile(retained, "observations.json", canonicalJson(observations)));
		const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
		const phases = engines.flatMap(engine => variants.flatMap(variant =>
			nominalPrimitiveSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
		assert.deepEqual(observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), phases);
		const report = {
			schemaVersion: 1, host: "browser", profile, route, mode: "full"
			, producerCommit: index.producerCommit, receipt, engines
			, inputs, observations, counts: nominalPrimitiveSupplementCounts
			, originalPackage: true, leanBuild: false
			, offlineInstall: true, ...result
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		reports.push(report);
	}
	await saveLakeFile(output, "browser.json", canonicalJson({ schemaVersion: 1, route, engines, reports }));
	return reports;
};
