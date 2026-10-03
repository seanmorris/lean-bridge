/**
 * Execute callback-local PHP owners against fresh ordinary and reviewed Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { compileOwnedPhpFixture } from "./owned-php-native.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"])
for(const variant of ["no-host", "host", "combined"])
test(`PHP callback-result owners execute real Lean (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_TEST !== "1"
	, timeout: 600000
}, async t => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const configuration = combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration;
	const reviewedIr = combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr;
	const sourceSuffix = combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource;
	const options = { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const compiled = await compileOwnedPhpFixture(t, {
		...(mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewedIr() })
		, sourceSuffix
		, ...options
		, evidenceName: `php-callback-results-${mode}-${variant}-inputs.json`
	});
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(compiled.sourceIdentity.exportConfigurationSha256, sha256(compiled.sourceIdentity.exportConfigurationSource));
	assert.equal(compiled.model.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(compiled.model.functions.filter(fn => fn.receiver === 0).length, combined ? 5 : 0);
	assert.equal(compiled.model.functions.filter(fn => fn.transfers?.length).length, combined ? 2 : 0);
	assert.ok(compiled.model.c.copies.length > 0, "callback-local factories have native copy entry points without host callbacks");
	const probePath = "tests/fixtures/structured-types/owned-php-callback-results.php";
	const probe = await readFile(probePath, "utf8");
	await saveLakeFile(compiled.directory, "consumer.php", probe);
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
	const args = ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "consumer.php", variant];
	let execution;
	try
	{
		execution = await runCopied(php, args, compiled.directory);
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error });
	}
	assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
	const observed = JSON.parse(execution.stdout);
	assert.equal(observed.variant, variant);
	assert.equal(observed.actualLean, true); assert.equal(observed.installedPackage, false);
	assert.match(observed.phpVersion, /^8\.[2-9]\.\d+/u);
	assert.equal(observed.phpIntSize, 8); assert.equal(observed.phpZts, false);
	assert.equal(observed.phpSapi, "cli"); assert.equal(observed.phpOs, "Linux");
	assert.equal(observed.machine, "x86_64"); assert.equal(observed.ffi, true);
	assert.deepEqual(Object.keys(observed.phases).sort(), ["native", ...hostCallbacks ? ["host"] : [], ...combined ? ["combined"] : []].sort());
	assert.ok(observed.phases.native >= 40);
	if(hostCallbacks) assert.ok(observed.phases.host >= 20);
	if(combined) assert.ok(observed.phases.combined >= 30);
	assert.equal(observed.checks, Object.values(observed.phases).reduce((sum, value) => sum + value, 0) + 2);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const compiledInputs = {};
	for(const path of ["Owned.lean", "Owned.c", "Owned.o"
		, "Carriers.c", "Carriers.o"
		, "Witness.lean", "Witness.c", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.c", "Callbacks.o"] : []
		, "public-api.c", "libowned-php.so"])
		compiledInputs[path] = sha256(await readFile(join(compiled.directory, path)));
	await saveLakeFile("build/owned-php-callback-results", `${mode}-${variant}.json`, canonicalJson({
		schemaVersion: 1, kind: "owned-php-callback-results-runtime", mode, variant
		, actualLean: true, installedPackage: false, options
		, command: { command: php, args, cwd: compiled.directory }
		, execution, observed
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, compilation: compiled.compilation, compiledInputs
		, nativeLibraries: JSON.parse(await readFile(join(compiled.directory, "native-evidence.json"), "utf8"))
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, publicHeaderSha256: sha256(compiled.model.c.header)
		, helpersSha256: sha256(compiled.helpers), probePath, probe
		, probeSha256: sha256(probe)
	}));
	t.diagnostic(`${observed.phpVersion} NTS: ${observed.checks} actual Lean ${variant} callback checks`);
});
