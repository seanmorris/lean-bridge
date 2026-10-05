/**
 * Python whole-result borrows over ordinary and reviewed compiled Lean APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPythonConversions } from "../src/backends/python/owned-conversions.mjs";
import { ownedPythonRuntime } from "../src/backends/python/owned-runtime.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowReviewedIr, ownedBorrowConfiguration } from "./helpers/owned-borrow-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Python borrowed results require whole owners without changing unanchored APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPythonConversions(ir, { transferredInputs: true }), /explicit output leases/u);
	const generated = generateOwnedPythonConversions(ir, { transferredInputs: true, anchoredResults: true });
	assert.deepEqual(ir, before);
	assert.equal(generated.c.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.match(generated.valuesSource, /def retain_ticket\(arg0: Value\[Ticket\]\) -> Value\[Ticket\]/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedPythonConversions(reversed, { transferredInputs: true, anchoredResults: true });
	const enabled = generateOwnedPythonConversions(ownedAggregateReviewedIr(), { anchoredResults: true });
	const baseline = generateOwnedPythonConversions(ownedAggregateReviewedIr());
	for(const key of ["valuesSource", "stub", "source"])
	{
		assert.equal(reordered[key], generated[key]); assert.equal(enabled[key], baseline[key]);
	}
});

test("Python borrowed-result stubs retain owner, container and callable types", {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_BORROW_TEST !== "1", timeout: 300000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-python-borrow-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedPythonConversions(ownedRustBorrowReviewedIr(), { transferredInputs: true, anchoredResults: true });
	const borrowOnly = generateOwnedPythonConversions(ownedBorrowReviewedIr(), { anchoredResults: true });
	assert.ok(borrowOnly.c.functions.every(fn => !fn.transfers?.length));
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	assert.match((await runCopied(checker, ["-I", "-m", "mypy", "--version"], directory)).stdout, /^mypy 2\.3\.1\b/u);
	const positive = `from typing import assert_type
import lean_owned_aggregates as api
def exercise() -> None:
    root = api.new_ticket(7, "label")
    assert_type(root, api.Value[api.Ticket])
    assert_type(root.get(), api.Ticket)
    view = api.retain_ticket(root)
    assert_type(view.retain(), api.Value[api.Ticket])
    empty = api.copy_value([], result_of=api.echo_array)
    assert_type(empty.get(), tuple[api.Ticket, ...])
    raw = api.Bundle(root.get(), None, (), (), api.Payload(-1, b""))
    record = api.copy_value(raw)
    assert_type(record, api.Value[api.Bundle])
    closure = api.make_record(record)
    assert_type(closure(True, raw), api.Value[api.Bundle])
    assert_type(api.transfer_ticket(root), api.Value[api.Ticket])
`;
	const invalid = `import lean_owned_aggregates as api
def invalid(root: api.Value[api.Ticket], record: api.Value[api.Bundle]) -> None:
    api.retain_ticket(root.get())
    api.transfer_ticket(root.get())
    wrong: str = root.get()
    root()
    closure = api.make_record(record)
    closure(True, "wrong")
    wrong_result: api.Value[api.Tree] = closure(False, record.get())
    api.copy_value([], result_of=api.serial)
`;
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(directory))
	{
		const pkg = join(interpreter.site, generated.packageDir);
		for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource
			, "__init__.pyi": generated.stub, "py.typed": ""
			, "_owned.py": ownedPythonRuntime(generated.c.prefix, { transferredInputs: true, anchoredResults: true }) }))
			await saveLakeFile(pkg, path, source);
		await saveLakeFile(interpreter.directory, "typed.py", positive);
		await saveLakeFile(interpreter.directory, "invalid.py", invalid);
		const check = path => runCopied(checker, ["-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", interpreter.command, path], interpreter.directory);
		const result = await check("typed.py"); assert.equal(result.stderr, "");
		assert.match(result.stdout, /Success: no issues found/u);
		const rejected = [];
		await assert.rejects(() => check("invalid.py"), error => {
			assert.equal(error.details.stderr, "");
			for(const line of [3, 4, 5, 6, 8, 9, 10])
			{
				assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`)); rejected.push(line);
			}
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/iu);
			return true;
		});
		for(const [name, source] of Object.entries({ values: borrowOnly.valuesSource
			, stub: borrowOnly.stub, conversions: borrowOnly.source
			, runtime: ownedPythonRuntime(borrowOnly.c.prefix, { anchoredResults: true }) })) {
			await saveLakeFile(interpreter.directory, `${name}.py`, source);
			await runCopied(interpreter.command, ["-I", "-B", "-c", 'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec")', `${name}.py`], interpreter.directory);
			}
		observations.push({ name: interpreter.name, typing: interpreter.typing, rejected, borrowOnlyCompiled: true });
	}
	await saveLakeFile(resolve("build/owned-python-borrows"), "typing.json", canonicalJson({
		observations, positiveSha256: sha256(positive), invalidSha256: sha256(invalid)
		, stubSha256: sha256(generated.stub)
	}));
});

test("Python borrowed results execute without input-transfer support", {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_BORROW_TEST !== "1"
	, timeout: 900000
}, async t => {
	const probe = `import copy, ctypes, gc, sys
import lean_owned_aggregates as api
from lean_owned_aggregates import _native as native, _owned as runtime
library = ctypes.CDLL(sys.argv[1])
native._bind(runtime._OwnedRuntime(library))
state = native._runtime.current_state()
root = api.new_ticket(42, "borrow-only")
alias = copy.copy(root)
view = api.retain_ticket(root)
child = api.retain_ticket(view)
independent = child.retain()
assert child == independent
root.close()
assert not view.is_closed
alias.close()
assert view.is_closed and child.is_closed
try:
    child.get()
except api.LeanBridgeError as error:
    assert error.status == 4
else:
    raise AssertionError("Expired borrow accepted")
empty = api.copy_value([], result_of=api.echo_array)
empty_view = api.echo_array(empty)
assert empty_view.get() == ()
empty.close()
assert empty_view.is_closed
raw = api.Bundle(independent.get(), None, (), (), api.Payload(-7, b""))
owner = api.copy_value(raw)
borrowed = api.callback_record(owner, lambda value: value)
closure = api.make_record(owner)
kept = closure.retain()
assert borrowed == owner and closure(True, raw).get() == raw
owner.close()
assert borrowed.is_closed and closure.is_closed
assert kept(False, raw).get() == raw
del root, alias, view, child, independent, empty, empty_view, raw, owner, borrowed, closure, kept
gc.collect()
state.drain()
assert not state.slots
state.close()
print("borrow-only-ok")
`;
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() }
			, hostCallbacks: true, evidenceName: `python-borrow-only-${mode}-inputs.json`
		});
		const c = generateOwnedCPackage({ metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component
			, hostCallbacks: true, anchoredResults: true });
		assert.ok(c.values.functions.every(fn => !fn.transfers?.length));
		assert.equal(c.values.functions.filter(fn => fn.anchor !== undefined).length, 18);
		for(const [path, source] of Object.entries(c.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), source);
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra"
			, "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "borrow-only.so"]
		, compiled.directory, { PATH: "/usr/bin:/bin" });
		const generated = generateOwnedPythonConversions(c.layout.model.bindingIr, { anchoredResults: true });
		const runtime = ownedPythonRuntime(c.values.prefix, { anchoredResults: true });
		const interpreters = [];
		for(const interpreter of await pythonGraphInterpreters(compiled.directory))
		{
			for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource
				, "_owned.py": runtime, "_native.py": generated.source }))
				await saveLakeFile(join(interpreter.site, generated.packageDir), path, source);
			await saveLakeFile(interpreter.directory, "borrow-only.py", probe);
			const result = await runCopied(interpreter.command, ["-I", "-B", "borrow-only.py", join(compiled.directory, "borrow-only.so")], interpreter.directory);
			assert.equal(result.stdout, "borrow-only-ok\n"); assert.equal(result.stderr, "");
			interpreters.push({ name: interpreter.name, typing: interpreter.typing, stdout: result.stdout });
		}
		observations.push({ mode, compiledLean: true, installedPackage: false
			, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component }
			, publicSha256: sha256(generated.valuesSource)
			, stubSha256: sha256(generated.stub)
			, conversionsSha256: sha256(generated.source), runtimeSha256: sha256(runtime)
			, nativeSha256: sha256(c.source), interpreters });
	}
	await saveLakeFile(resolve("build/owned-python-borrows"), "borrow-only.json", canonicalJson({ probe, probeSha256: sha256(probe), observations }));
});

for(const mode of ["ordinary", "reviewed"]) test(`Python borrowed results expire with original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	// The same independently authored ownership decisions used by C++ and Rust.
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustBorrowSource
		, evidenceName: `python-borrows-${mode}-inputs.json`
	});
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
	const generated = generateOwnedPythonConversions(c.layout.model.bindingIr, { transferredInputs: true, anchoredResults: true });
	const implementation = ownedRustBorrowNativeSource(c);
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-python-borrows.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = ownedPythonRuntime(c.values.prefix, { transferredInputs: true, anchoredResults: true });
	const probe = await readFile("tests/fixtures/structured-types/owned-python-borrows.py", "utf8");
	const mutants = [
		{ name: "unchecked-whole-value", path: "_owned.py", source: runtime
			, before: "            storage.lease.require()\n            return storage.value"
			, after: "            return storage.value" }
		, { name: "discarded-empty-owner", path: "_owned.py", source: runtime
			, before: "            result = object.__new__(cls)\n            result._storage = storage"
			, after: "            result = object.__new__(cls)\n            result._storage = None if value == () or value is None else storage" }
		, { name: "escaped-callback-frame", path: "_owned.py", source: runtime
			, before: "            self.scope.active = False"
			, after: "            self.scope.active = True" }
		, { name: "pointer-equality", path: "__init__.py"
			, source: generated.valuesSource
			, before: "        return self.same_identity(other)"
			, after: "        return self._handle == other._handle" }
		, { name: "late-whole-value-read", path: "_owned.py", source: runtime
			, before: "            return storage.value"
			, after: "            return self._storage.value" }
		, { name: "late-retain-storage-read", path: "_owned.py", source: runtime
			, before: "            return storage.copy(value, _whole=True)"
			, after: "            return self._storage.copy(value, _whole=True)" }
		, { name: "late-copy-storage-read", path: "_owned.py", source: runtime
			, before: "            result = object.__new__(type(self))\n            result._storage = storage"
			, after: "            result = object.__new__(type(self))\n            result._storage = self._storage" }
		, { name: "late-status-storage-read", path: "_owned.py", source: runtime
			, before: "            return storage is None or storage.lease.closed"
			, after: "            return storage is None or self._storage.lease.closed" }
	];
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(compiled.directory))
	{
		const root = join(interpreter.site, generated.packageDir);
		for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource
			, "__init__.pyi": generated.stub
			, "_owned.py": runtime, "_native.py": generated.source }))
			await saveLakeFile(root, path, source);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		let observed;
		try
		{ observed = await runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libowned-python-borrows.so")], interpreter.directory); }
		catch(error)
		{ throw new Error(JSON.stringify(error.details), { cause: error }); }
		assert.equal(observed.stderr, ""); const result = JSON.parse(observed.stdout);
		assert.ok(result.checks > 100); assert.equal(result.live, 0); assert.equal(result.identities, 0);
		assert.deepEqual(result.foreignCloseSchedules, ["array", "option", "nested"].flatMap(shape =>
			["get", "retain", "copy", "is_closed"].map(operation => `${shape}/${operation}`)));
		const rejectedMutations = [];
		for(const mutant of mutants)
		{
			assert.ok(mutant.source.includes(mutant.before), mutant.name);
			const changed = mutant.source.replaceAll(mutant.before, mutant.after);
			await saveLakeFile(root, mutant.path, changed);
			await runCopied(interpreter.command, ["-I", "-B", "-c", 'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec")', join(root, mutant.path)], interpreter.directory);
			await assert.rejects(() => runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libowned-python-borrows.so")], interpreter.directory), error => {
				assert.match(error.details.stderr, /AssertionError:/u);
				assert.doesNotMatch(error.details.stderr, /SyntaxError|ImportError|AttributeError|NameError/u);
				return true;
			});
			rejectedMutations.push({ name: mutant.name, compiled: true, sourceSha256: sha256(changed) });
			await saveLakeFile(root, mutant.path, mutant.source);
		}
		observations.push({ name: interpreter.name, typing: interpreter.typing, ...result, rejectedMutations });
		t.diagnostic(JSON.stringify(observations.at(-1)));
	}
	await saveLakeFile(resolve("build/owned-python-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observations
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component }
		, publicSha256: sha256(generated.valuesSource)
		, stubSha256: sha256(generated.stub)
		, conversionsSha256: sha256(generated.source), runtimeSha256: sha256(runtime)
		, probeSha256: sha256(probe), nativeSha256: sha256(implementation)
	}));
});
