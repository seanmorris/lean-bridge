/**
 * Compile typed Python receiver members over independently built Lean adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedPythonReceiverConfiguration, ownedPythonReceiverReviewedIr, ownedPythonReceiverSource
	, ownedPythonPlainReceiverReviewedIr, ownedPythonReceiverProbe } from "./helpers/owned-python-receiver-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const enabled = process.env.LEAN_BRIDGE_OWNED_PYTHON_RECEIVER_TEST === "1";

test("Python receiver generation keeps nominal properties and existing free APIs", () => {
	const ir = ownedPythonReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPythonPackage(ir, null, { ...options, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedPythonPackage(ir, null, options);
	assert.deepEqual(ir, before); assert.equal(generated.c.functions.length, 27);
	assert.equal(generated.contract.schemaVersion, 4); assert.equal(generated.contract.receiverExports.exports.length, 16);
	assert.match(generated.stub, /@property\n {4}def serial\(self: Value\[Ticket\]\) -> int:/u);
	assert.match(generated.stub, /def choose_ticket\(self: Value\[Ticket\], arg1: Value\[Ticket\]\) -> Value\[Ticket\]/u);
	for(const name of ["get", "retain", "close", "is_closed", "copy_value", "same_identity"])
	{
		const invalid = structuredClone(ir); invalid.declarations.find(item => item.name === "serial").name = name;
		assert.throws(() => generateOwnedPythonPackage(invalid, null, options), /reserved/u);
	}
	const prior = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedPythonPackage(prior, null, { receiverExports: true }).files, generateOwnedPythonPackage(prior).files);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const shuffled = generateOwnedPythonPackage(reversed, null, options);
	for(const field of ["valuesSource", "stub", "source", "abiHeader", "contract"]) assert.deepEqual(shuffled[field], generated[field]);
});

test("Python resource-only receivers need no callback or borrowed-result capability", () => {
	for(const consuming of [false, true])
	{
		const generated = generateOwnedPythonPackage(ownedPythonPlainReceiverReviewedIr(consuming), null, {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		assert.equal(generated.contract.resultAnchors, undefined);
		assert.equal(generated.contract.receiverExports.exports.length, consuming ? 3 : 2);
		assert.equal(generated.c.copies, undefined);
		assert.doesNotMatch(generated.source, /result_validate|_OwnedHost\d+/u);
		assert.doesNotMatch(generated.files[`${generated.packageDir}/_owned.py`], /result_validate/u);
		assert.doesNotMatch(generated.files["README.md"], /Pass synchronous Python functions|with_recovery\(function/u);
	}
});

test("Python receiver stubs check nominal owners, properties and anchored arguments", { skip: !enabled, timeout: 300000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-python-receiver-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedPythonPackage(ownedPythonReceiverReviewedIr(), null, options);
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	assert.match((await runCopied(checker, ["-I", "-m", "mypy", "--version"], directory)).stdout, /^mypy 2\.3\.1\b/u);
	const positive = `from typing import assert_type
import lean_owned_aggregates as api
def exercise(root: api.Value[api.Ticket], record: api.Value[api.Bundle]) -> None:
    assert_type(root.serial, int)
    assert_type(root.get().serial, int)
    assert_type(root.label, str)
    assert_type(root.retain_ticket(), api.Value[api.Ticket])
    assert_type(api.Value.retain_ticket(root), api.Value[api.Ticket])
    assert_type(root.choose_ticket(root), api.Value[api.Ticket])
    assert_type(root.get().choose_ticket(root), api.Value[api.Ticket])
    assert_type(record.primary, api.Value[api.Ticket])
    assert_type(record.get().primary, api.Ticket)
    assert_type(record.payload, api.Payload)
    assert_type(record.echo_record(), api.Value[api.Bundle])
    assert_type(root.transfer_ticket(), api.Value[api.Ticket])
`;
	const invalid = `import lean_owned_aggregates as api
def invalid(root: api.Value[api.Ticket], record: api.Value[api.Bundle]) -> None:
    record.serial
    root.serial = 1
    root.get().retain_ticket()
    root.choose_ticket(root.get())
    root.echo_record()
    wrong: str = root.serial
    record.primary()
`;
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(directory))
	{
		for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource, "__init__.pyi": generated.stub, "py.typed": "" }))
			await saveLakeFile(join(interpreter.site, generated.packageDir), path, source);
		await saveLakeFile(interpreter.directory, "typed.py", positive); await saveLakeFile(interpreter.directory, "invalid.py", invalid);
		const check = path => runCopied(checker, ["-I", "-m", "mypy"
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", interpreter.command, path], interpreter.directory);
		const result = await check("typed.py").catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
		assert.equal(result.stderr, ""); assert.match(result.stdout, /Success: no issues found/u);
		const rejected = [];
		await assert.rejects(check("invalid.py"), error => {
			assert.equal(error.details.stderr, "");
			for(const line of [3, 4, 5, 6, 7, 8, 9])
			{ assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`)); rejected.push(line); }
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/iu); return true;
		});
		observations.push({ name: interpreter.name, typing: interpreter.typing, rejected });
	}
	await saveLakeFile("build/owned-python-receivers", "typing.json", canonicalJson({ observations
		, positiveSha256: sha256(positive), invalidSha256: sha256(invalid)
		, stubSha256: sha256(generated.stub) }));
});

for(const mode of ["ordinary", "reviewed"]) test(`Python receiver members preserve their original lifetime (${mode})`, { skip: !enabled, timeout: 900000 }, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedPythonReceiverConfiguration() } : { reviewedIr: ownedPythonReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedPythonReceiverSource
		, evidenceName: `python-receivers-${mode}-inputs.json`
	});
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true, ...options };
	const native = generateOwnedCPackage(input), generated = generateOwnedPythonPackage(native.layout.model.bindingIr, null, options);
	const implementation = ownedRustBorrowNativeSource(native);
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-python-receivers.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = generated.files[`${generated.packageDir}/_owned.py`], probe = await ownedPythonReceiverProbe();
	const choose = generated.functions.findIndex(fn => fn.name === "chooseTicket");
	const mutations = [
		{ name: "receiver-used-as-other-argument-anchor", path: "_native.py"
			, source: generated.source
			, before: `return _call${choose}(self.get(), arg1)`
			, after: `return _call${choose}(self.get(), self)` }
		, { name: "unchecked-whole-value", path: "_owned.py", source: runtime
			, before: "            storage.lease.require()\n            return storage.value"
			, after: "            return storage.value" }
		, { name: "escaped-callback-frame", path: "_owned.py", source: runtime
			, before: "            self.scope.active = False"
			, after: "            self.scope.active = True" }
	];
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(compiled.directory))
	{
		const root = join(interpreter.site, generated.packageDir);
		for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource
			, "__init__.pyi": generated.stub, "_owned.py": runtime
			, "_native.py": generated.source }))
			await saveLakeFile(root, path, source);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		const run = () => runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libowned-python-receivers.so")], interpreter.directory);
		const observed = await run().catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
		assert.equal(observed.stderr, ""); const result = JSON.parse(observed.stdout);
		assert.ok(result.checks > 100); assert.equal(result.live, 0); assert.equal(result.identities, 0);
		for(const name of ["pythonBefore", "pythonAfter", "nativeBefore", "nativeAfter"]) assert.ok(result[name] > 0);
		const rejectedMutations = [];
		for(const mutation of mutations)
		{
			assert.equal(mutation.source.split(mutation.before).length, 2);
			const changed = mutation.source.replace(mutation.before, mutation.after);
			await saveLakeFile(root, mutation.path, changed);
			await runCopied(interpreter.command, ["-I", "-B", "-c", 'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec")', join(root, mutation.path)], interpreter.directory);
			await assert.rejects(run(), error => { assert.match(error.details.stderr, /AssertionError:/u); return true; });
			rejectedMutations.push({ name: mutation.name, compiled: true, sourceSha256: sha256(changed) });
			await saveLakeFile(root, mutation.path, mutation.source);
		}
		const restored = await run(); assert.equal(restored.stderr, ""); assert.deepEqual(JSON.parse(restored.stdout), result);
		observations.push({ name: interpreter.name, typing: interpreter.typing, ...result, rejectedMutations, restored: true });
		t.diagnostic(JSON.stringify(observations.at(-1)));
	}
	await saveLakeFile("build/owned-python-receivers", mode + ".json", canonicalJson({
		mode, input
		, actualLean: true, installedPackage: false, observations
		, publicSha256: sha256(generated.valuesSource)
		, stubSha256: sha256(generated.stub)
		, conversionsSha256: sha256(generated.source), runtimeSha256: sha256(runtime)
		, nativeSha256: sha256(implementation), probeSha256: sha256(probe) }));
});
