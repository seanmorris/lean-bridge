/**
 * Read the six selected local Composer observations without running producers.
 * Exact captured hashes bind opaque compiler products and original terminal bytes.
 * This is not a frozen acceptance receipt or a claim of native allocator cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { beforePhpCallbackInstalledStaging } from "./php-callback-installed-staging-history.mjs";
import { expectedOwnedPhpInstalledCallback, ownedPhpInstalledCallbackProbe } from "./owned-php-callback-result-installed.mjs";
import { assertOwnedPhpCallbackPackageSources } from "./owned-php-callback-result-package-sources.mjs";
import { readOwnedPhpCallbackZip } from "./owned-php-callback-result-package-zip.mjs";

const cases = [
	["ordinary-no-host", "smoke-r2", "021f8bce1ea720ba1e3cf01ec13af520f711d9b1dcb4fc9bbe5db2464b215e4e", "c4e4bc691ac923b6aa537ae57665225a91d013a8b7f6fdb4dee28432a9537c1a", "SMOKE"]
	, ["ordinary-host", "host-r1", "ca0cf63083085b59640512a577da9a2bc8060a8f6370d99b82f96c69ab149f12", "489b3337ccf7f93bdf70c2e2eef5fdc3a70db5a51b76b77c1238f66cabd4c682", "HOST"]
	, ["ordinary-combined", "combined-r1", "98b59919cafe5d4bd7a0091bd856919a3af1f611e5d608801ea0e9f67bccc367", "99e5832be7fd9605a8369464ee627f502366ac20f604fcaa945878064edec597", "COMBINED"]
	, ["reviewed-no-host", "reviewed-no-host-r1", "9832163d2b1f89410ad8539108a8a5e4a76ac1c06afa1aa2c5c23df8b04eb195", "fd872d8940cced4560c3062b000a38b2f137037f74216db02a6c10395b6492d6", "REVIEWED_NO_HOST"]
	, ["reviewed-host", "reviewed-host-r1", "66fbcbd457c0825864f64dde5efd4886faca3cbcd1f6b1ea3561f09a848abbce", "59b4da29ad49b19c57e18ae5bb0350e3751ea50d0b7039e6d6852eb24caf4c4a", "REVIEWED_HOST"]
	, ["reviewed-combined", "reviewed-combined-r1", "61e0dfc7f3e276f6cb8a502bc8bc36c8eab83f76403493a0f7561cd1f8de1c35", "afa6245a3c0967b54fe4b718dc1c7daa516e1065d32402c7ac30f51681761301", "REVIEWED_COMBINED"]
].map(([name, log, reportSha256, logSha256, marker]) => Object.freeze({ name: `${name}.json`
	, mode: name.split("-")[0], variant: name.slice(name.indexOf("-") + 1)
	, log: `build-php-callback-installed-${log}.log`
	, reportSha256, logSha256, marker }));
export const ownedPhpInstalledCases = Object.freeze(cases);
export const ownedPhpInstalledReportRoot = "build/owned-php-callback-result-packaging";
const selected = name => { const item = cases.find(item => item.name === name); assert.ok(item, "selected report name"); return item; };
const hash = value => sha256(canonicalJson(value));
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const keys = (value, names) => {
	assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...names].sort(), "closed schema keys");
};
const positive = value => assert.ok(Number.isSafeInteger(value) && value > 0, "positive safe integer");
const absolute = value => assert.ok(typeof value === "string" && isAbsolute(value) && !/[\n\r\0]/u.test(value), "recorded absolute path");
const freeze = value => {
	if(value && typeof value === "object")
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};
const shape = (item, baseline) => {
	assert.equal(typeof item, typeof baseline, "closed schema type");
	if(baseline === null)
	{
		assert.equal(item, null); return;
	}
	if(Array.isArray(baseline))
	{
		assert.ok(Array.isArray(item)); assert.equal(item.length, baseline.length, "closed array length");
		baseline.forEach((value, index) => shape(item[index], value));
	} else if(typeof baseline === "object")
	{
		keys(item, Object.keys(baseline)); for(const key of Object.keys(baseline)) shape(item[key], baseline[key]);
	} else if(typeof baseline === "number") assert.ok(Number.isSafeInteger(item), "closed finite safe integer");
};

/**
 * Read hash-bound originals; map paths without rewriting recorded report bytes.
 *
 * @param readEvidence - Reader for original reports and terminal logs.
 */
export const readOwnedPhpInstalledEvidence = async (readEvidence = readFile) => {
	const reports = {}, logs = {};
	for(const pin of cases)
	{
		const bytes = await readEvidence(join(ownedPhpInstalledReportRoot, pin.name));
		assert.equal(sha256(bytes), pin.reportSha256, `selected report bytes ${pin.name}`);
		reports[pin.name] = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(reports[pin.name]));
		logs[pin.name] = (await readEvidence(pin.log)).toString();
		assert.equal(sha256(logs[pin.name]), pin.logSha256, `selected log bytes ${pin.name}`);
	}
	return { reports, logs };
};
/**
 * Read the exact source state authenticated when the six reports were captured.
 *
 * @param path - Repository-relative source path.
 */
export const readOwnedPhpInstalledSource = async path =>
	beforePhpCallbackInstalledStaging(path, await readFile(path));
let originals;
const original = async name => {
	originals ??= readOwnedPhpInstalledEvidence().then(freeze);
	return (await originals).reports[name];
};

const producerSources = Object.freeze({
	"config/cli-package.v1.json": "f00b679dfe1e5410c42eb564f35c57175fa33e102fdfe9ed27e8144519840053"
	, "tests/owned-php-callback-result-packaging.test.mjs": "8669538171365fd588b771664ea4debc92ed9bc0c90a764e2c5b9447cb25a4c8"
	, "tests/helpers/owned-php-callback-result-installed.mjs": "3fdf7265fbd9a08a17b527dac1f8c02cd5c1f3b2f81539a651c262c68c0972e6"
	, "tests/helpers/owned-php-callback-result-composer.mjs": "b2be6d7acddc750c0d35199385ccfaf0089ed34278453e6fcf9cfb5bf416d96b"
	, "tests/helpers/owned-php-callback-result-execution.mjs": "05767e55e74c50ed449ea91baeedc1f57aa0545b11dd98f0a99fb4b21b1d3a52"
	, "tests/helpers/owned-php-callback-result-producer.mjs": "785ffdf57d026824c85336b05b8bbfd04908e7cf06836d876f2eb69be26731b0"
	, "tests/fixtures/structured-types/owned-installed-php-callback-observer.php": "0d7d61c0cfd775ee7ec9726346ea06830bb896114305b416f9fb1b720860fd99"
	, "tests/fixtures/structured-types/owned-installed-php-callback-assets.php": "4e5b002a20857b4aadd38c2dcefb4c33223871f4ba3c1254296395f213e112ee"
	, "tests/fixtures/structured-types/owned-php-callback-results.php": "8b3fabf3465e53e85098fdb9950d07c1e0fc31534f6eb0ec27bfacfe15b6065c"
	, "tests/helpers/owned-dotnet-callback-result-fixture.mjs": "736ad99c6f6dbc9a578cffd8182fb67802fbc094eaa8c54e709e771176330793"
	, "tests/helpers/brick-math.mjs": "ca360a3ecce5717a4d495459cfb09d6dba0f075393a28c91d2f725a2c8691eb6"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/package-set.mjs": "8613cb6fa1e7cb6bce93444160cf3a4503973064f52b644984637e909e5da82c"
	, "tests/helpers/owned-php-installed.mjs": "47c5e76200f44ae0c26817e9b185034a81cbb04457c30356e862e60924b36220"
	, "tests/helpers/type-corpus-php.mjs": "46f9428900f9a81c536f3d46accb633838d2778e43e62b5f78f84dafeeecc502"
	, "tests/helpers/lake-workspace.mjs": "56d4cb8097c41158f01ef4ae6ea0542dc188afab50894a49586528e366d3f082"
});

const execution = value => {
	keys(value, ["command", "args", "cwd", "env", "code", "signal", "timedOut", "spawnError", "stdout", "stderr"]);
	absolute(value.command); absolute(value.cwd); assert.ok(Array.isArray(value.args) && value.args.every(arg => typeof arg === "string"));
	assert.equal(value.code, 0, "raw process exit"); assert.equal(value.signal, null, "raw process signal");
	assert.equal(value.spawnError, null); assert.equal(value.timedOut, false);
	assert.equal(typeof value.stdout, "string"); assert.equal(typeof value.stderr, "string");
	assert.ok(Object.values(value.env).every(entry => typeof entry === "string"));
};
const phpJson = value => JSON.stringify(value).replaceAll("/", "\\/");
const observed = (value, expected) => {
	execution(value); assert.equal(value.stderr, "");
	assert.deepEqual(JSON.parse(value.stdout), expected, "raw PHP observation");
	assert.equal(value.stdout, phpJson(JSON.parse(value.stdout)) + "\n", "complete raw PHP line");
};

/**
 * Validate ordered terminal grammar before applying its original hash.
 *
 * @param name - Selected report filename.
 * @param text - Complete original terminal log or untrusted mutation.
 * @param item - Owning report used for exact diagnostic cross-binding.
 */
export const assertOwnedPhpInstalledLog = (name, text, item) => {
	const pin = selected(name), title = `installed Composer callback-result owners (${pin.mode}, ${pin.variant})`;
	assert.equal(typeof text, "string"); const lines = text.split("\n"); let index = 0;
	const line = expected => assert.equal(lines[index++], expected, `terminal line ${index}`);
	const duration = prefix => {
		const value = lines[index++]; assert.ok(value?.startsWith(prefix));
		assert.match(value.slice(prefix.length), /^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
		assert.ok(Number(value.slice(prefix.length)) > 0 && Number(value.slice(prefix.length)) < 2400000);
	};
	line("TAP version 13"); line(`# Subtest: ${title}`); line(`ok 1 - ${title}`);
	line("  ---"); duration("  duration_ms: "); line("  type: 'test'"); line("  ...");
	line(`# ${pin.mode}/${pin.variant}: first ${item.producerInterface} producer; scratch ${item.directory}`);
	line(`# ${pin.mode}/${pin.variant}: independent second producer; first ZIP preserved at ${item.savedHandoff}`);
	line(`# ${pin.mode}/${pin.variant}: ${expectedOwnedPhpInstalledCallback(pin.variant, "8.2.33").checks} public checks per run; four public executions, 30 cold/warm loader cases, result slots and broker identities zero`);
	for(const value of ["1..1", "# tests 1", "# suites 0", "# pass 1", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0"]) line(value);
	duration("# duration_ms "); line(`PHP_CALLBACK_${pin.marker}_NODE_EXIT=0`); line("");
	assert.equal(index, lines.length, "no unparsed terminal bytes");
	assert.equal(sha256(text), pin.logSha256, "selected terminal identity");
};

const assertRaw = (item, baseline) => {
	const { directory, variant, mode, installation: install } = item;
	absolute(directory); assert.match(basename(directory), new RegExp(`^lean-php-callback-installed-${mode}-${variant}-[A-Za-z0-9]{6}$`, "u"));
	absolute(item.savedHandoff); assert.match(basename(item.savedHandoff), new RegExp(`^${mode}-${variant}-handoff-[A-Za-z0-9]{6}$`, "u"));
	assert.equal(item.independentHandoff, join(item.savedHandoff, "independent"));
	const project = join(directory, "source"), author = join(directory, "author"), consumer = join(directory, "consumer");
	const cli = join(author, "node_modules/.bin/lean-bridge"), cliRoot = join(author, "node_modules", item.cli.package.name);
	assert.deepEqual(item.removedBeforeInstallation, { project, author, output: join(directory, "producer"), independent: join(directory, "independent") });
	assert.equal(item.producerExecutions.length, 4); assert.equal(item.installationExecutions.length, 5);
	const raw = [...item.producerExecutions, ...item.installationExecutions
		, ...item.observations.map(value => value.execution)
		, ...item.assets.map(value => value.execution)
		, ...item.disk.samples.map(value => value.execution)];
	assert.equal(raw.length, 50); raw.forEach(execution);
	assert.deepEqual(item.verification, item.producerExecutions[3]);
	assert.deepEqual(install.abiExecution, item.installationExecutions[0]);
	const [npm, first, second, verify] = item.producerExecutions;
	assert.equal(npm.command, "/usr/bin/npm"); assert.equal(npm.cwd, author);
	assert.deepEqual(npm.args, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(directory, "cli", item.cli.archive.path)]);
	assert.deepEqual(npm.env, { PATH: "/usr/bin:/bin", npm_config_cache: join(directory, "npm-cache") });
	assert.match(npm.stdout, /^\nadded 1 package in \d+(?:ms|s)\n$/u);
	assert.equal(npm.stderr, baseline.producerExecutions[0].stderr, "original npm notice bytes");
	assert.ok(["node", "nodejs"].includes(basename(first.command)));
	assert.equal(second.command, first.command); assert.equal(verify.command, first.command);
	const expectedEnvironment = { PATH: "/usr/bin:/bin", LC_ALL: "C", TZ: "UTC"
		, CC: "/usr/bin/cc", CXX: "/usr/bin/c++"
		, LEAN_BRIDGE_LEAN_PREFIX: first.env.LEAN_BRIDGE_LEAN_PREFIX
		, LEAN_BRIDGE_PHP: "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: "/usr/bin/composer"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" };
	absolute(expectedEnvironment.LEAN_BRIDGE_LEAN_PREFIX);
	for(const [index, value] of [first, second].entries())
	{
		const output = join(directory, index ? "independent" : "producer");
		assert.equal(value.cwd, directory); assert.deepEqual(value.env, expectedEnvironment); assert.equal(value.stderr, "");
		assert.deepEqual(value.args, variant === "no-host"
			? [join(author, "native-build-api.mjs"), cliRoot, project, output, expectedEnvironment.LEAN_BRIDGE_LEAN_PREFIX]
			: [cli, "build", "--project", project, "--target", "php-native", "--output", output, "--json"]);
		const response = JSON.parse(value.stdout); assert.equal(value.stdout, canonicalJson(response));
		assert.equal(response.status, "ok");
		assert.deepEqual(response.result, variant === "no-host" ? item.built : { ...item.built, output });
		if(variant === "no-host") assert.deepEqual(response, { status: "ok"
			, producerInterface: "native-build-api", result: item.built
			, capabilities: { ownedGraphs: true, ownedHostCallbacks: false, ownedInputTransfers: false, ownedAnchoredResults: false, ownedReceiverExports: false, ownedCallbackResultAnchors: true } });
		else
		{
			assert.equal(response.command, "build"); assert.equal(response.project, project); assert.equal(response.exitCode, 0);
			assert.deepEqual(response.diagnostics, []); assert.deepEqual(response.selection, { allTargets: false, targets: ["php-native"] });
		}
	}
	assert.deepEqual(verify.args, [cli, "verify", "--receipt", join(item.savedHandoff, "package-set-receipt.json"), "--json"]);
	assert.equal(verify.cwd, directory); assert.deepEqual(verify.env, copiedCleanEnvironment); assert.equal(verify.stderr, "");
	const verified = JSON.parse(verify.stdout); assert.equal(verify.stdout, canonicalJson(verified));
	assert.equal(verified.status, "ok"); assert.equal(verified.command, "verify"); assert.equal(verified.exitCode, 0);
	assert.deepEqual(verified.result, { archives: 1, authenticated: false
		, component: item.input.component.id
		, packages: [{ ecosystem: "composer", name: "lean-bridge/owned-values", target: "php-native", version: "1.2.3" }]
		, profiles: ["native-library-v1"]
		, receiptSha256: hash(item.packageSetReceipt)
		, verificationType: "local-package-set", verified: true });
	const installProject = join(consumer, "project"), php = item.installationExecutions[0].command;
	assert.match(basename(php), /^php(?:8\.2)?$/u);
	const abi = install.abi;
	assert.deepEqual(abi, { builtins: ["Core", "date", "libxml", "openssl", "pcre", "zlib", "filter", "hash", "json", "pcntl", "random", "Reflection", "SPL", "session", "standard", "sodium"]
		, extensionDirectory: "/usr/lib/php/20220829"
		, sapi: "cli", version: "8.2.33", width: 8, zts: 0 });
	assert.equal(item.installationExecutions[0].stdout, phpJson([abi.version, abi.width, abi.zts, abi.sapi, abi.extensionDirectory, abi.builtins]));
	const installEnv = { ...copiedCleanEnvironment, COMPOSER_HOME: join(installProject, "composer-home")
		, COMPOSER_CACHE_DIR: join(installProject, "cache")
		, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1"
		, COMPOSER_NO_INTERACTION: "1"
		, COMPOSER: join(installProject, "composer.json")
		, CORPUS_COMPOSER_PROBE: join(installProject, "tool-files.json") };
	for(const [index, value] of item.installationExecutions.entries())
	{
		assert.equal(value.stdout, baseline.installationExecutions[index].stdout, "original install stdout");
		assert.equal(value.stderr, baseline.installationExecutions[index].stderr, "original install stderr");
		assert.equal(value.cwd, installProject);
		assert.deepEqual(value.env, [0, 2].includes(index) ? copiedCleanEnvironment : installEnv);
		assert.equal(value.command, index === 2 ? "/usr/bin/unzip" : php);
		if(index === 2) assert.deepEqual(value.args, ["-q", join(installProject, "feed/package-0.zip"), "-d", join(installProject, "inspection-0")]);
		if([1, 3, 4].includes(index)) assert.deepEqual(value.args, [
			...install.composerOptions, "/usr/bin/composer"
			, "--no-plugins", "--no-scripts", "--no-interaction"
			, ...index === 1 ? ["--version"] : ["install", "--prefer-dist", "--no-progress", "--no-dev"]]);
	}
	assert.equal(item.installationExecutions[1].stdout, install.composerVersion + "\n");
	assert.equal(item.observations.length, 4); assert.equal(item.assets.length, 30);
	const libraries = Object.keys(item.nativeEvidence.libraries).sort(); assert.equal(libraries.length, 5);
	const publicCases = ["installed", "relocated-again"].flatMap(location => ["strict", "weak"].map(caller => ({ location, caller })));
	for(const [index, value] of item.observations.entries())
	{
		const { location, caller } = publicCases[index]; assert.equal(value.location, location); assert.equal(value.caller, caller);
		const deployment = location === "installed" ? join(consumer, "relocated") : join(directory, "runtime-only");
		assert.equal(value.execution.command, php); assert.equal(value.execution.cwd, deployment); assert.deepEqual(value.execution.env, copiedCleanEnvironment);
		assert.deepEqual(value.execution.args, [...install.runtimeOptions, "observer.php", variant, caller]);
		const expected = { consumer: expectedOwnedPhpInstalledCallback(variant, abi.version)
			, resultSlots: 0, registeredStates: 0, brokerIdentities: 0
			, idleSessionIdentities: 1, automaticShutdown: true, privateGmp: true
			, runtimeInitializations: 1, componentInitializations: 1
			, mappings: Object.fromEntries(libraries.map(name => [name, { [join(deployment, "vendor/lean-bridge/owned-values/native/linux-x64", name)]: true }])) };
		assert.deepEqual(value.observed, expected); observed(value.execution, expected);
	}
	const assetCases = ["cold", "warm"].flatMap(temperature => ["changed", "symlink", "missing"].flatMap(kind => libraries.map(name => ({ temperature, kind, name }))));
	for(const [index, value] of item.assets.entries())
	{
		const { temperature, kind, name } = assetCases[index]; assert.deepEqual({ temperature: value.temperature, kind: value.kind, name: value.name }, assetCases[index]);
		assert.equal(value.execution.command, php); assert.equal(value.execution.cwd, join(directory, "runtime-only"));
		assert.deepEqual(value.execution.env, copiedCleanEnvironment); assert.deepEqual(value.execution.args, [...install.runtimeOptions, "assets.php", temperature, kind, name]);
		const expected = { temperature, kind, name, boundary: "loader-reentry"
			, diagnostic: { class: "RuntimeException", code: 0, message: `Native library differs from compiled evidence: ${name}` }
			, restoredSha256: item.nativeEvidence.libraries[name]
			, restoredPublicCall: true
			, resultSlots: 0, registeredStates: 0, brokerIdentities: 0 };
		assert.deepEqual(value.observed, expected); observed(value.execution, expected);
	}
	positive(item.disk.initialAvailable); assert.ok(item.disk.initialAvailable > 2 * 1024 ** 3);
	assert.deepEqual(item.disk.samples.map(value => value.stage), ["before-first-producer", "after-first-producer", "before-independent-producer", "after-independent-producer", "installed", "relocated-again", "complete"]);
	for(const value of item.disk.samples)
	{
		positive(value.scratchBytes); positive(value.available);
		assert.equal(value.execution.command, "/usr/bin/du"); assert.equal(value.execution.cwd, directory);
		assert.deepEqual(value.execution.args, ["-sb", directory]); assert.deepEqual(value.execution.env, { PATH: "/usr/bin:/bin" });
		assert.equal(value.execution.stdout, `${value.scratchBytes}\t${directory}\n`); assert.equal(value.execution.stderr, "");
	}
};

/**
 * Check a closed report and authored sources before physical archive IO.
 *
 * @param name - Selected report filename.
 * @param item - Untrusted report observation.
 * @param readSource - Repository source reader.
 * @param readBaseline - Reader for the separately retained original report.
 */
export async function assertOwnedPhpInstalledReport(name, item, readSource = readOwnedPhpInstalledSource, readBaseline = original)
{
	const pin = selected(name), baseline = await readBaseline(name); shape(item, baseline);
	assert.equal(item.schemaVersion, 1); assert.equal(item.kind, "owned-php-callback-result-installed-observations");
	assert.equal(item.mode, pin.mode); assert.equal(item.variant, pin.variant); assert.equal(item.stage, "complete");
	assert.equal(item.producerInterface, pin.variant === "no-host" ? "native-build-api" : "installed-cli");
	assert.deepEqual(item.limitations, baseline.limitations);
	assertRaw(item, baseline);
	validatePackageSetReceipt(item.packageSetReceipt); assert.deepEqual(item.independentPackageSetReceipt, item.packageSetReceipt);
	assert.deepEqual(item.independentArchive, item.originalArchive);
	assert.deepEqual(item.reassembly, { original: item.originalArchive, repeated: item.originalArchive, package: item.built.packages[0] });
	assert.deepEqual(item.originalArchive, { bytes: item.built.packages[0].bytes, sha256: item.built.packages[0].sha256 });
	assert.equal(item.installation.archiveSha256, item.originalArchive.sha256);
	assert.deepEqual(item.installation.receipt, item.packageReceipt); assert.deepEqual(item.installation.receipts, [item.packageReceipt]);
	validateBrickMathInstall(item.installation, item.installation.deployment);
	assert.equal(hash(item), pin.reportSha256, "selected report identity (including opaque compiler and tool baselines)");
	for(const [path, expected] of Object.entries(producerSources)) assert.equal(sha256(await readSource(path)), expected, `producer source ${path}`);
	const cli = item.cli, config = JSON.parse(await readSource("config/cli-package.v1.json"));
	assert.deepEqual(cli.files.map(file => file.path).sort(), [...config.files, "README.md", "package.json"].sort());
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = cli;
	assert.equal(hash(inventory), inventorySha256); assert.equal(externalRegistryWrites, false);
	positive(archive.bytes); assert.equal(cli.productionApproved, false);
	for(const file of cli.files)
	{
		positive(file.bytes); assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		if(!["README.md", "package.json"].includes(file.path)) assert.deepEqual(identity(await readSource(file.path)), { bytes: file.bytes, sha256: file.sha256 }, `CLI source ${file.path}`);
	}
	// The generated CLI README/manifest identities are pinned in the selected
	// original report. They are not compared with unrelated checkout root files.
	const probe = await ownedPhpInstalledCallbackProbe();
	assert.deepEqual(item.probes.consumer, { source: probe, ...identity(probe) });
	for(const kind of ["observer", "assets"])
	{
		const path = `tests/fixtures/structured-types/owned-installed-php-callback-${kind}.php`, source = (await readSource(path)).toString();
		assert.deepEqual(item.probes[kind], { path, source, ...identity(source) });
	}
	if(pin.variant === "no-host")
	{
		const path = "tests/helpers/owned-php-callback-result-producer.mjs", source = (await readSource(path)).toString();
		assert.deepEqual(item.producerDriver, { path, source, ...identity(source) });
	} else assert.equal(item.producerDriver, null);
	return assertOwnedPhpCallbackPackageSources(pin.mode, pin.variant, item, readSource);
}

/**
 * Authenticate both physical handoffs and inspect ZIP entries without extraction.
 *
 * @param name - Selected report filename.
 * @param item - Owning hash-authenticated report.
 * @param readEvidence - Reader for original handoff bytes.
 */
export const assertOwnedPhpInstalledHandoffs = async (name, item, readEvidence = readFile) => {
	assert.equal(hash(item), selected(name).reportSha256, "selected handoff report");
	const receiptBytes = Buffer.from(canonicalJson(item.packageSetReceipt)), zipName = item.built.packages[0].archive;
	const sidecar = Buffer.from(`${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const zipPath = `archives/${zipName}`;
	let originalZip;
	for(const root of [item.savedHandoff, item.independentHandoff])
	{
		assert.deepEqual(await readEvidence(join(root, "package-set-receipt.json")), receiptBytes);
		assert.deepEqual(await readEvidence(join(root, "package-set-receipt.json.sha256")), sidecar);
		const zip = await readEvidence(join(root, zipPath)); assert.deepEqual(identity(zip), item.originalArchive);
		if(originalZip) assert.deepEqual(zip, originalZip); else originalZip = zip;
	}
	const receipt = canonicalJson(item.packageReceipt), files = readOwnedPhpCallbackZip(originalZip
		, { ...item.packageReceipt.files, "lean-bridge/package-receipt.json": identity(receipt) });
	assert.equal(files.get("lean-bridge/package-receipt.json").toString(), receipt);
	assert.equal(files.get("binding-manifest.json").toString(), canonicalJson(item.bindingManifest));
	const composer = JSON.parse(files.get("composer.json"));
	const selection = item.installation.lock.packages.find(value => value.name === item.packageReceipt.name);
	assert.deepEqual(selection.dist, { type: "zip"
		, url: `file://${item.directory}/consumer/project/feed/package-0.zip`
		, shasum: createHash("sha1").update(originalZip).digest("hex") });
	assert.deepEqual(selection, { ...composer, dist: selection.dist });
	for(const [path, value] of files) assert.deepEqual(item.installation.deployment[`vendor/${composer.name}/${path}`], identity(value), `installed ZIP entry ${path}`);
	const expectedInventory = { ...item.installation.deployment
		, "strict.php": identity(item.probes.consumer.source)
		, "weak.php": identity(item.probes.consumer.source.replace("strict_types=1", "strict_types=0"))
		, "observer.php": identity(item.probes.observer.source)
		, "assets.php": identity(item.probes.assets.source) };
	assert.deepEqual(item.inventory, expectedInventory);
	return files;
};

/**
 * Authenticate the complete matrix without changing files or external state.
 *
 * @param evidence - Six reports and complete original terminal logs.
 * @param root0 - Injected read-only IO.
 * @param root0.readSource - Repository source reader.
 * @param root0.readEvidence - Original archive reader.
 */
export const assertOwnedPhpInstalledMatrix = async (evidence, { readSource = readOwnedPhpInstalledSource, readEvidence = readFile } = {}) => {
	keys(evidence, ["reports", "logs"]); const names = cases.map(value => value.name);
	keys(evidence.reports, names); keys(evidence.logs, names);
	let checks = 0;
	for(const pin of cases)
	{
		const item = evidence.reports[pin.name];
		const sources = await assertOwnedPhpInstalledReport(pin.name, item, readSource);
		assertOwnedPhpInstalledLog(pin.name, evidence.logs[pin.name], item);
		const files = await assertOwnedPhpInstalledHandoffs(pin.name, item, readEvidence);
		for(const [path, source] of sources.files) assert.deepEqual(files.get(path), Buffer.from(source), `reconstructed ZIP source ${path}`);
		checks += item.observations.reduce((sum, value) => sum + value.observed.consumer.checks, 0);
	}
	const reports = Object.values(evidence.reports);
	const rawCount = reports.reduce((sum, item) => sum + item.producerExecutions.length + item.installationExecutions.length
		+ item.observations.length + item.assets.length + item.disk.samples.length, 0);
	assert.equal(rawCount, 300);
	const aliases = reports.flatMap(item => [[item.verification, item.producerExecutions[3]], [item.installation.abiExecution, item.installationExecutions[0]]]);
	assert.equal(aliases.length, 12); for(const [alias, owning] of aliases) assert.deepEqual(alias, owning);
	assert.equal(new Set(reports.map(item => item.directory)).size, 6);
	assert.equal(new Set(reports.flatMap(item => [item.savedHandoff, item.independentHandoff])).size, 12);
	assert.equal(new Set(reports.map(item => hash(item.cli))).size, 1);
	assert.equal(checks, 3344);
	return { reports: 6, producerBuilds: 12, handoffs: 12, rawExecutions: rawCount, aliases: 12, publicRuns: 24, publicChecks: checks, assets: 180 };
};
