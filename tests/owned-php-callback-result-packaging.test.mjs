/**
 * Build and install authentic Composer callback-result packages without publishing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { installOwnedPhpCallbackArchive } from "./helpers/owned-php-callback-result-composer.mjs";
import { captureOwnedPhpCallback } from "./helpers/owned-php-callback-result-execution.mjs";
import { expectedOwnedPhpInstalledCallback, ownedPhpInstalledCallbackProbe } from "./helpers/owned-php-callback-result-installed.mjs";
import { ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const available = async () => { const disk = await statfs(tmpdir()); return disk.bavail * disk.bsize; };
const requireSpace = async () => assert.ok(await available() > 2 * 1024 ** 3, "serial PHP Composer producer requires more than 2 GiB free");
const succeeded = execution => {
	assert.equal(execution.code, 0, JSON.stringify(execution));
	assert.equal(execution.signal, null); assert.equal(execution.spawnError, null); assert.equal(execution.timedOut, false);
};
const missing = async path => { await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); };
const observedJson = execution => {
	succeeded(execution); assert.equal(execution.stderr, "");
	const value = JSON.parse(execution.stdout);
	assert.equal(execution.stdout, JSON.stringify(value).replaceAll("/", "\\/") + "\n", "one exact PHP JSON observation");
	return value;
};

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host", "combined"])
test(`installed Composer callback-result owners (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 2400000
}, async t => {
	await requireSpace();
	const directory = await mkdtemp(join(tmpdir(), `lean-php-callback-installed-${mode}-${variant}-`));
	const reportRoot = resolve("build/owned-php-callback-result-packaging"); await mkdir(reportRoot, { recursive: true });
	const savedHandoff = await mkdtemp(join(reportRoot, `${mode}-${variant}-handoff-`));
	const project = join(directory, "source"), author = join(directory, "author"), output = join(directory, "producer");
	const independent = join(directory, "independent"), consumer = join(directory, "consumer");
	const environment = { PATH: "/usr/bin:/bin", LC_ALL: "C", TZ: "UTC"
		, CC: "/usr/bin/cc", CXX: "/usr/bin/c++"
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.36" };
	const report = { schemaVersion: 1
		, kind: "owned-php-callback-result-installed-observations"
		, mode, variant, stage: "prepare", savedHandoff, directory
		, producerInterface: variant === "no-host" ? "native-build-api" : "installed-cli"
		, producerExecutions: [], installationExecutions: []
		, observations: [], assets: []
		, disk: { initialAvailable: await available(), samples: [] }
		, limitations: ["result-slot registry and broker identities only; no native allocator or leak-free claim"
			, "warm asset checks reenter the loader, not every cached public call"
			, "invocation counts observed for host callbacks only; pure native closures have no call counter"
				, "no-host uses the installed native-build API, not the CLI build command"] };
	const checkpoint = () => saveLakeFile(savedHandoff, "observations.partial.json", canonicalJson(report));
	const sample = async stage => {
		const execution = await captureOwnedPhpCallback("/usr/bin/du", ["-sb", directory], directory, { PATH: "/usr/bin:/bin" });
		const item = { stage, execution }; report.disk.samples.push(item); await checkpoint();
		succeeded(execution); assert.equal(execution.stderr, "");
		const size = execution.stdout.split("\t")[0]; assert.match(size, /^(?:0|[1-9]\d*)$/u);
		assert.equal(execution.stdout, `${size}\t${directory}\n`);
		item.scratchBytes = Number(size); assert.ok(Number.isSafeInteger(item.scratchBytes));
		item.available = await available(); await checkpoint();
	};
	t.after(async () => { await rm(directory, { recursive: true, force: true }); });
	const capture = async (command, args, cwd, env, timeout = 180000) => {
		const execution = await captureOwnedPhpCallback(command, args, cwd, env, timeout);
		report.producerExecutions.push(execution); await checkpoint(); succeeded(execution); return execution;
	};
	try
	{
		const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
		const combined = variant === "combined", hostCallbacks = variant !== "no-host";
		const configuration = mode === "ordinary"
			? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
			: { schemaVersion: 1, modules: ["Owned"] };
		configuration.targets = { "php-native": settings };
		const reviewedIr = mode === "reviewed" ? (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() : null;
		await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
		const lean = await readFile(join(project, "Owned.lean"), "utf8") + (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
		await saveLakeFile(project, "Owned.lean", lean);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
		if(reviewedIr) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(reviewedIr));
		report.sourceInputs = { lean, configuration, reviewedIr }; const before = await lakeInputState(project);
		const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "cli") });
		report.cli = candidate.report;
		await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
		const npm = await realpath(join(process.execPath, "../../bin/npm"));
		await capture(process.execPath, [npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive], author
			, { PATH: "/usr/bin:/bin", npm_config_cache: join(directory, "npm-cache") });
		const cliRoot = join(author, "node_modules", candidate.report.package.name), cli = join(author, "node_modules/.bin/lean-bridge");
		for(const file of candidate.report.files) assert.deepEqual(identity(await readFile(join(cliRoot, file.path))), { bytes: file.bytes, sha256: file.sha256 });
		await missing(candidate.output);
		const driverPath = "tests/helpers/owned-php-callback-result-producer.mjs", driver = await readFile(driverPath, "utf8");
		report.producerDriver = variant === "no-host" ? { path: driverPath, source: driver, ...identity(driver) } : null;
		if(variant === "no-host") await saveLakeFile(author, "native-build-api.mjs", driver);
		const build = async destination => {
			await requireSpace(); await sample(`before-${destination === output ? "first" : "independent"}-producer`);
			const args = variant === "no-host" ? [join(author, "native-build-api.mjs"), cliRoot, project, destination, environment.LEAN_BRIDGE_LEAN_PREFIX]
				: [cli, "build", "--project", project, "--target", "php-native", "--output", destination, "--json"];
			const execution = await capture(process.execPath, args, directory, environment, 1200000);
			const response = JSON.parse(execution.stdout);
			assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["php-native"]);
			if(variant === "no-host")
			{
				assert.equal(response.producerInterface, "native-build-api"); assert.equal(response.capabilities.ownedHostCallbacks, false);
			}
			assert.deepEqual(await lakeInputState(project), before);
			await sample(`after-${destination === output ? "first" : "independent"}-producer`);
			return response.result;
		};
		t.diagnostic(`${mode}/${variant}: first ${report.producerInterface} producer; scratch ${directory}`);
		report.stage = "first-producer"; const built = await build(output); report.built = built;
		const options = { working: output
			, nativeRoot: join(output, "native/component")
			, runtimeRoot: join(output, "native/runtime")
			, adapterRoot: join(output, "native/owned-php-binding")
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings, environment };
		const verified = await ownedPhpEvidence(options);
		assert.equal(verified.adapter.schemaVersion, 5); assert.equal(verified.php.contract.schemaVersion, 5);
		assert.equal(verified.model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(Boolean(verified.model.ownedGraph.hostCallbacks), hostCallbacks);
		for(const name of ["inputTransfers", "resultAnchors", "receiverExports"]) assert.equal(Boolean(verified.model.ownedGraph[name]), combined, name);
		report.input = { metadata: await json(join(options.nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
		report.componentReceipt = verified.receipt; report.adapterReceipt = verified.adapter; report.nativeEvidence = verified.evidence;
		const pkg = built.packages[0]; assert.equal(built.packages.length, 1);
		report.packageReceipt = await json(join(output, "packages/php-native/composer/lean-bridge/package-receipt.json"));
		report.bindingManifest = await json(join(output, "packages/php-native/composer/binding-manifest.json"));
		assert.equal(report.bindingManifest.schemaVersion, 5);
		report.packageSetReceipt = await copyPackageSetHandoff(output, savedHandoff);
		const archive = await readFile(join(savedHandoff, "archives", pkg.archive));
		report.originalArchive = identity(archive); await checkpoint();
		assert.deepEqual(report.originalArchive, { bytes: pkg.bytes, sha256: pkg.sha256 });
		const reassembled = join(directory, "reassembled");
		const rebuilt = await packageOwnedPhp({ ...options, working: reassembled, glibcMinimumVersion: built.glibcMinimumVersion });
		assert.deepEqual(rebuilt.packages, built.packages);
		const repeated = await readFile(join(reassembled, "archives", pkg.archive)); assert.deepEqual(repeated, archive);
		report.reassembly = { package: rebuilt.packages[0], original: identity(archive), repeated: identity(repeated) };
		await missing(reassembled); await missing(output); await checkpoint();
		t.diagnostic(`${mode}/${variant}: independent second producer; first ZIP preserved at ${savedHandoff}`);
		report.stage = "independent-producer"; const second = await build(independent);
		assert.deepEqual(second.packages, built.packages);
		report.independentPackageSetReceipt = await json(join(independent, "package-set-receipt.json"));
		assert.deepEqual(report.independentPackageSetReceipt, report.packageSetReceipt);
		const secondArchive = await readFile(join(independent, "archives", pkg.archive)); assert.deepEqual(secondArchive, archive);
		report.independentArchive = identity(secondArchive);
		report.independentHandoff = join(savedHandoff, "independent");
		const independentReceipt = await copyPackageSetHandoff(independent, report.independentHandoff);
		assert.deepEqual(independentReceipt, report.packageSetReceipt);
		for(const path of ["package-set-receipt.json", "package-set-receipt.json.sha256", `archives/${pkg.archive}`])
			assert.deepEqual(await readFile(join(report.independentHandoff, path)), await readFile(join(savedHandoff, path)));
		await checkpoint();
		await missing(independent); await missing(project);
		report.verification = await capture(process.execPath, [cli, "verify", "--receipt", join(savedHandoff, "package-set-receipt.json"), "--json"], directory, copiedCleanEnvironment);
		assert.equal(JSON.parse(report.verification.stdout).status, "ok"); await missing(author);
		report.removedBeforeInstallation = { project, output, independent, author };
		report.stage = "offline-install"; await checkpoint();
		const installed = await installOwnedPhpCallbackArchive({ root: consumer
			, archive: join(savedHandoff, "archives", pkg.archive)
			, pkg, environment, executions: report.installationExecutions, checkpoint });
		report.installation = installed.evidence; assert.deepEqual(installed.evidence.receipt, report.packageReceipt);
		assert.equal(report.installationExecutions.length, 5);
		assert.deepEqual(report.installationExecutions[0], installed.abiExecution);
		assert.deepEqual(JSON.parse(installed.abiExecution.stdout), [installed.evidence.version, 8, 0, "cli", installed.abi.extensionDirectory, installed.abi.builtins]);
		assert.deepEqual(report.installationExecutions[3].args, report.installationExecutions[4].args);
		for(const execution of report.installationExecutions) succeeded(execution);
		const libraries = Object.keys(verified.evidence.libraries).sort(); assert.equal(libraries.length, 5);
		for(const name of libraries) assert.equal(report.packageReceipt.files[`native/linux-x64/${name}`].sha256, verified.evidence.libraries[name]);
		const source = await ownedPhpInstalledCallbackProbe();
		const observerPath = "tests/fixtures/structured-types/owned-installed-php-callback-observer.php";
		const assetsPath = "tests/fixtures/structured-types/owned-installed-php-callback-assets.php";
		const observer = await readFile(observerPath, "utf8"), assets = await readFile(assetsPath, "utf8");
		report.probes = { consumer: { source, ...identity(source) }
			, observer: { path: observerPath, source: observer, ...identity(observer) }
			, assets: { path: assetsPath, source: assets, ...identity(assets) } };
		let { deployment } = installed;
		for(const caller of ["strict", "weak"]) await saveLakeFile(deployment, `${caller}.php`, source.replace("strict_types=1", `strict_types=${caller === "strict" ? 1 : 0}`));
		await saveLakeFile(deployment, "observer.php", observer); await saveLakeFile(deployment, "assets.php", assets);
		const inventory = await ownedPhpInventory(deployment);
		const execute = async args => captureOwnedPhpCallback(installed.php, [...installed.runtimeOptions, ...args], deployment, installed.environment);
		report.stage = "installed-consumers"; await checkpoint();
		for(const location of ["installed", "relocated-again"])
		{
			if(location === "relocated-again")
			{
				const destination = join(directory, "runtime-only"); await rename(deployment, destination); deployment = destination;
				await missing(consumer);
			}
			for(const caller of ["strict", "weak"])
			{
				const execution = await execute(["observer.php", variant, caller]);
				const observation = { location, caller, execution }; report.observations.push(observation); await checkpoint(); succeeded(execution);
				const observed = observedJson(execution); observation.observed = observed;
				const mappings = Object.fromEntries(libraries.map(name => [name, { [join(deployment, "vendor", pkg.name, "native/linux-x64", name)]: true }]));
				assert.deepEqual(observed, { consumer: expectedOwnedPhpInstalledCallback(variant, installed.evidence.version)
					, resultSlots: 0, registeredStates: 0, brokerIdentities: 0
					, idleSessionIdentities: 1, automaticShutdown: true, privateGmp: true
					, runtimeInitializations: 1, componentInitializations: 1, mappings });
				if(report.observations.length > 1) assert.deepEqual(observed.consumer, report.observations[0].observed.consumer);
			}
			await verifyNativeFiles(join(deployment, "vendor", pkg.name), report.packageReceipt.files);
			assert.deepEqual(await ownedPhpInventory(deployment), inventory); await sample(location);
		}
		const assetCases = ["cold", "warm"].flatMap(temperature => ["changed", "symlink", "missing"].flatMap(kind => libraries.map(name => ({ temperature, kind, name }))));
		assert.equal(assetCases.length, 30);
		for(const { temperature, kind, name } of assetCases)
		{
			const execution = await execute(["assets.php", temperature, kind, name]);
			const item = { temperature, kind, name, execution }; report.assets.push(item); await checkpoint(); succeeded(execution);
			item.observed = observedJson(execution);
			assert.deepEqual(item.observed, { temperature, kind, name
				, boundary: "loader-reentry"
				, diagnostic: { class: "RuntimeException", message: `Native library differs from compiled evidence: ${name}`, code: 0 }
				, restoredSha256: verified.evidence.libraries[name]
				, restoredPublicCall: true
				, resultSlots: 0, registeredStates: 0, brokerIdentities: 0 });
		}
		assert.equal(report.observations.length, 4); assert.equal(report.assets.length, 30);
		assert.deepEqual(report.observations.map(({ location, caller }) => ({ location, caller })), ["installed", "relocated-again"].flatMap(location => ["strict", "weak"].map(caller => ({ location, caller }))));
		assert.deepEqual(report.assets.map(({ temperature, kind, name }) => ({ temperature, kind, name })), assetCases);
		assert.equal(report.producerExecutions.length, 4);
		await verifyNativeFiles(join(deployment, "vendor", pkg.name), report.packageReceipt.files);
		assert.deepEqual(await ownedPhpInventory(deployment), inventory); report.inventory = inventory;
		report.stage = "complete"; await sample("complete"); await checkpoint();
		await saveLakeFile(reportRoot, `${mode}-${variant}.json`, canonicalJson(report));
		t.diagnostic(`${mode}/${variant}: ${report.observations[0].observed.consumer.checks} public checks per run; four public executions, 30 cold/warm loader cases, result slots and broker identities zero`);
	} catch(error)
	{
		report.failure = { message: error.message, stack: error.stack }; await checkpoint(); throw error;
	}
});
