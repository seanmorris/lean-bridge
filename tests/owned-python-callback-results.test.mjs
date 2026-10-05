/**
 * Keep Python callback owners separate from host transport and export anchors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedPythonCallbackResultReviewedIr, ownedPythonCallbackResultCombinedReviewedIr } from "./helpers/owned-python-callback-result-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { normalizeOwnedPythonSanitizer } from "./helpers/owned-python-callback-result-sanitizers.mjs";
import { ownedPythonCallbackTyping } from "./helpers/owned-python-callback-result-typing.mjs";

const variants = [
	{ name: "no-host", hostCallbacks: false, combined: false }
	, { name: "host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }
];
const options = ({ hostCallbacks, combined }) => ({
	hostCallbacks, callbackResultAnchors: true, transferredInputs: combined
	, anchoredResults: combined, receiverExports: combined
});
const reviewed = variant => (variant.combined ? ownedPythonCallbackResultCombinedReviewedIr : ownedPythonCallbackResultReviewedIr)();

test("Python callback-result capability preserves whole owners without phantom export anchors", () => {
	const leaks = ["==42==ERROR: LeakSanitizer: detected memory leaks"
		, "Direct leak of 73 byte(s) in 1 object(s) allocated from:\n    #0 0xabc in allocate (/probe/native.so+0x123)"
		, "Direct leak of 80 byte(s) in 2 object(s) allocated from:\n    #0 0xdef in allocate (/probe/native.so+0x456)"
		, "SUMMARY: AddressSanitizer: 153 byte(s) leaked in 3 allocation(s)."];
	const report = leaks.join("\n\n"), normalized = normalizeOwnedPythonSanitizer(report, "/probe");
	assert.equal(normalizeOwnedPythonSanitizer([...leaks].reverse().join("\n\n")
		.replaceAll("==42==", "==99==").replaceAll("0xabc", "0x987"), "/probe"), normalized);
	for(const changed of [
		report.replace("+0x123", "+0x124"), report.replace("73 byte", "74 byte")
		, report.replace("1 object", "2 object"), report + "\n\n" + leaks[1]
		, "Tracer caught signal 11\nLeakSanitizer has encountered a fatal error."])
		assert.notEqual(normalizeOwnedPythonSanitizer(changed, "/probe"), normalized);
	for(const variant of variants)
	{
		const ir = reviewed(variant), before = structuredClone(ir), flags = options(variant);
		assert.throws(() => generateOwnedPythonPackage(ir, null, { ...flags, callbackResultAnchors: false }), /explicit output leases/u);
		const generated = generateOwnedPythonPackage(ir, null, flags);
		assert.deepEqual(ir, before); assert.equal(generated.contract.schemaVersion, 5);
		assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-python-v5");
		assert.equal(generated.contract.callbackResultAnchors.signatures.length, 4);
		assert.equal(generated.contract.callbackResultAnchors.parameterNumbering, "callback-local");
		for(const callback of generated.c.callbacks.filter(item => item.anchor !== undefined))
			assert.equal(generated.contract.callbackResultAnchors.signatures.find(item => item.id === callback.id).parameter, callback.anchor - 1);
		for(const key of ["resultAnchors", "receiverExports", "inputTransfers"])
			assert.equal(Boolean(generated.contract[key]), variant.combined, key);
		if(!variant.hostCallbacks)
		{
			assert.doesNotMatch(generated.source, /class _OwnedHost\d/u);
			assert.doesNotMatch(generated.stub, /class WithRecovery/u);
			assert.doesNotMatch(generated.files["README.md"], /Pass synchronous Python functions/u);
		}
		const reversed = structuredClone(ir); reversed.types.reverse();
		const reordered = generateOwnedPythonPackage(reversed, null, flags);
		for(const field of ["valuesSource", "stub", "source", "abiHeader", "contract"])
			assert.deepEqual(reordered[field], generated[field]);
	}
	const base = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedPythonPackage(base, null, { callbackResultAnchors: true }).files, generateOwnedPythonPackage(base).files);
});

test("Python callback stubs distinguish native owner arguments from raw host payloads", {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_CALLBACK_RESULT_TEST !== "1"
	, timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-python-callback-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	assert.match((await runCopied(checker, ["-I", "-m", "mypy", "--version"], root)).stdout, /^mypy 2\.3\.1\b/u);
	const interpreters = await pythonGraphInterpreters(root), observations = [];
	for(const variant of variants)
	{
		const generated = generateOwnedPythonPackage(reviewed(variant), null, options(variant));
		const { positive, invalid, wrong } = ownedPythonCallbackTyping(variant);
		for(const interpreter of interpreters)
		{
			const directory = join(interpreter.directory, variant.name), packageRoot = join(interpreter.site, generated.packageDir);
			for(const [path, source] of Object.entries({
				"__init__.py": generated.valuesSource, "__init__.pyi": generated.stub
				, "py.typed": ""
				, "_owned.py": generated.files[`${generated.packageDir}/_owned.py`]
				, "_native.py": generated.source }))
				await saveLakeFile(packageRoot, path, source);
			await saveLakeFile(directory, "typed.py", positive); await saveLakeFile(directory, "invalid.py", invalid);
			const check = path => runCopied(checker, ["-I", "-m", "mypy", "--strict"
				, "--no-incremental", "--cache-dir=/dev/null"
				, "--python-executable", interpreter.command, path], directory);
			const result = await check("typed.py").catch(error => { throw new Error(`${variant.name}/${interpreter.name}: ${JSON.stringify(error.details)}`, { cause: error }); });
			assert.equal(result.stderr, ""); assert.match(result.stdout, /Success: no issues found/u);
			const rejected = [];
			await assert.rejects(check("invalid.py"), error => {
				assert.equal(error.details.stderr, "");
				for(let line = 5; line < 5 + wrong.length; line++)
				{ assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`)); rejected.push(line); }
				assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/iu); return true;
			});
			await runCopied(interpreter.command, ["-I", "-B", "-c", "import lean_owned_aggregates"], directory);
			observations.push({ variant: variant.name, name: interpreter.name
				, typing: interpreter.typing, rejected
				, positiveSha256: sha256(positive), invalidSha256: sha256(invalid)
				, stubSha256: sha256(generated.stub) });
		}
	}
	assert.equal(observations.length, 9);
	await saveLakeFile("build/owned-python-callback-results", "typing.json", canonicalJson({ observations }));
});
