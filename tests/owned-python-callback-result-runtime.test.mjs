/**
 * Exercise Python callback-local lifetimes against freshly compiled Lean code.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedPythonCallbackResultConfiguration, ownedPythonCallbackResultReviewedIr
	, ownedPythonCallbackResultSource, ownedPythonCallbackResultCombinedConfiguration
	, ownedPythonCallbackResultCombinedReviewedIr, ownedPythonCallbackResultCombinedSource } from "./helpers/owned-python-callback-result-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedPythonCallbackMutations } from "./helpers/owned-python-callback-result-mutations.mjs";
import { prepareOwnedPythonCallbackSanitizers } from "./helpers/owned-python-callback-result-sanitizers.mjs";
import { ownedPythonCallbackNativeSource } from "./helpers/owned-python-callback-result-native.mjs";
import { assertOwnedPythonCallbackRuntime } from "./helpers/owned-python-callback-result-evidence.mjs";

const variants = [
	{ name: "no-host", hostCallbacks: false, combined: false }
	, { name: "host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }
];
for(const mode of ["ordinary", "reviewed"]) for(const { name, hostCallbacks, combined } of variants)
test(`Python callback-result owners execute ${mode}-${name}`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const configuration = combined ? ownedPythonCallbackResultCombinedConfiguration : ownedPythonCallbackResultConfiguration;
	const reviewed = combined ? ownedPythonCallbackResultCombinedReviewedIr : ownedPythonCallbackResultReviewedIr;
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewed() }
		, hostCallbacks
		, sourceSuffix: combined ? ownedPythonCallbackResultCombinedSource : ownedPythonCallbackResultSource
		, evidenceName: `python-callback-result-${mode}-${name}-inputs.json`
	});
	const options = { hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, ...options };
	const native = generateOwnedCPackage(input);
	const generated = generateOwnedPythonPackage(native.layout.model.bindingIr, null, options);
	assert.equal(generated.c.header, native.publicHeader);
	const implementation = ownedPythonCallbackNativeSource(native, combined);
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
		, ...hostCallbacks ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-python-callback-results.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const sanitize = await prepareOwnedPythonCallbackSanitizers(compiled, hostCallbacks);
	const template = await readFile("tests/fixtures/structured-types/owned-python-callback-results.py", "utf8");
	const probe = `HOST_CALLBACKS = ${hostCallbacks ? "True" : "False"}\nCOMBINED = ${combined ? "True" : "False"}\nINSTALLED = False\n` + template;
	const runtime = generated.files[`${generated.packageDir}/_owned.py`], observations = [];
	for(const interpreter of await pythonGraphInterpreters(compiled.directory))
	{
		const root = join(interpreter.site, generated.packageDir);
		for(const [path, source] of Object.entries({
			"__init__.py": generated.valuesSource, "__init__.pyi": generated.stub
			, "_owned.py": runtime, "_native.py": generated.source }))
			await saveLakeFile(root, path, source);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		const run = () => runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libowned-python-callback-results.so")], interpreter.directory);
		const observed = await run();
		assert.equal(observed.stderr, "");
		const result = JSON.parse(observed.stdout);
		assert.ok(result.checks > 100);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		assert.equal(result.faults.length, combined ? 20 : hostCallbacks ? 14 : 6);
		const sanitized = await sanitize(interpreter, result);
		const mutations = [];
		if(name !== "host") for(const mutation of ownedPythonCallbackMutations(generated, combined))
		{
			await saveLakeFile(root, mutation.path, mutation.source);
			try
			{
				await runCopied(interpreter.command, ["-I", "-B", "-c", 'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec")', join(root, mutation.path)], interpreter.directory);
				await assert.rejects(run, error => {
					assert.equal(error.code, "build-command-failed");
					assert.ok(error.details.stderr.includes(mutation.diagnostic), mutation.name + ": " + error.details.stderr);
					assert.doesNotMatch(error.details.stderr, /SyntaxError|ImportError|Segmentation fault/u);
					mutations.push({ name: mutation.name, path: mutation.path
						, occurrences: mutation.occurrences
						, sourceSha256: sha256(mutation.source)
						, compiled: true, semanticRejection: true
						, diagnostic: mutation.diagnostic });
					return true;
				}, mutation.name);
			}
			finally
			{ await saveLakeFile(root, mutation.path, mutation.original); }
		}
		const restored = await run();
		assert.equal(restored.stderr, "");
		assert.deepEqual(JSON.parse(restored.stdout), result);
		observations.push({ name: interpreter.name, typing: interpreter.typing
			, ...result, ...sanitized, mutations, restored: true });
		t.diagnostic(`${mode}-${name}/${interpreter.name}: ${result.checks} checks, ${result.faults.reduce((sum, item) => sum + item.before + item.after, 0)} allocation failures`);
	}
	const report = {
		mode, name, hostCallbacks, combined, input, contract: generated.contract
		, actualLean: true, installedPackage: false, observations
		, publicSha256: sha256(generated.valuesSource)
		, stubSha256: sha256(generated.stub)
		, conversionsSha256: sha256(generated.source)
		, runtimeSha256: sha256(runtime)
		, nativeSha256: sha256(implementation), probeSha256: sha256(probe) };
	await assertOwnedPythonCallbackRuntime(report);
	for(const mutate of [
		value => { value.observations.pop(); }
		, value => { value.observations[0].faults.pop(); }
		, value => { value.observations[0].live = 1; }
		, value => { value.observations[0].sanitizerProbes.pop(); }
		, value => { value.observations[0].sanitizerEnvironment.PYTHONMALLOC = "pymalloc"; }
		, value => { value.observations[0].restored = false; }
		, value => { value.nativeSha256 = "0".repeat(64); }
	]) {
		const forged = structuredClone(report); mutate(forged);
		await assert.rejects(assertOwnedPythonCallbackRuntime(forged));
	}
	await saveLakeFile("build/owned-python-callback-results", `runtime-${mode}-${name}.json`, canonicalJson(report));
});
