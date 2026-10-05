/**
 * Verify Python's owned value layouts and conversions against compiled Lean.
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
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned Python values preserve nominal types and finite typed aliases", () => {
	const ir = ownedCppCompositionReviewedIr(), generated = generateOwnedPythonConversions(ir);
	assert.equal(generated.types.length, 41); assert.equal(generated.functions.length, 31);
	assert.match(generated.valuesSource, /class Ticket\(_OwnedResource\)/u);
	assert.match(generated.stub, /def retain\(self\) -> Ticket:/u);
	assert.match(generated.valuesSource, /BundleAlias: _TypeAlias = Bundle/u);
	assert.match(generated.valuesSource, /class ChainLink:/u);
	assert.match(generated.valuesSource, /Option = Some\[_T\] \| None/u);
	for(const name of ["dict", "_private", "Some"])
	{
		const changed = structuredClone(ir); changed.types.find(node => node.name === "Ticket").name = name;
		assert.throws(() => generateOwnedPythonConversions(changed));
	}
});

test("owned Python stubs enforce resource and constructor types", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 300000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-python-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateOwnedPythonConversions(ownedCppCompositionReviewedIr());
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	assert.match((await runCopied(checker, ["-I", "-m", "mypy", "--version"], root)).stdout, /^mypy 2\.3\.1\b/u);
	for(const interpreter of await pythonGraphInterpreters(root))
	{
		const pkg = join(interpreter.site, generated.packageDir);
		await saveLakeFile(pkg, "__init__.py", generated.valuesSource);
		await saveLakeFile(pkg, "__init__.pyi", generated.stub);
		await saveLakeFile(pkg, "_owned.py", ownedPythonRuntime(generated.c.prefix));
		await saveLakeFile(pkg, "py.typed", "");
		for(const suffix of ["typed", "invalid"])
			await saveLakeFile(interpreter.directory, `${suffix}.py`, await readFile(`tests/fixtures/structured-types/owned-python-${suffix}.py`, "utf8"));
		const check = path => runCopied(checker, ["-I", "-c"
			, 'import resource, runpy, sys; resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3)); sys.argv = ["mypy", *sys.argv[1:]]; runpy.run_module("mypy", run_name="__main__")'
			, "--strict", "--no-incremental", "--cache-dir=/dev/null"
			, "--python-executable", interpreter.command, path], interpreter.directory);
		const checked = await check("typed.py");
		assert.equal(checked.stderr, ""); assert.match(checked.stdout, /Success: no issues found/u);
		await assert.rejects(() => check("invalid.py"), error => {
			assert.equal(error.details.stderr, "");
			assert.match(error.details.stdout, /Found 13 errors in 1 file/u);
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/u);
			return true;
		});
		await runCopied(interpreter.command, ["-I", "-B", "typed.py"], interpreter.directory);
		t.diagnostic(`${interpreter.name}: strict types passed, 13 diagnostics reject 11 invalid operations`);
	}
});

for(const fixture of ["owned-cpp-composition", "owned-scalars"]) for(const reviewed of [false, true]) test(`Python ${fixture} values survive compiled conversion and allocation faults (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const scalar = fixture === "owned-scalars";
	const compiled = await compileOwnedAggregateFixture(t, { fixture
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...(reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}) });
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const generated = generateOwnedPythonConversions(c.values.native.model.bindingIr);
	if(scalar)
	{
		const fields = generated.types.find(node => node.name === "Scalars").fields;
		assert.equal(fields.length, 19); assert.equal(new Set(fields.map(field => field.type)).size, 19);
	}
	const layouts = [], expected = [];
	for(const node of generated.types)
	{
		layouts.push(`sizeof(${node.cName})`, `_Alignof(${node.cName})`);
		expected.push(`_c.sizeof(${node.raw})`, `_c.alignment(${node.raw})`);
		if(node.scalar || node.integer || node.identity) continue;
		const fields = [];
		if(node.element || node.kind === "primitive") fields.push(["data", "data"], ["length", "length"]);
		if(node.kind === "variant") fields.push(["kind", "kind"], ["cases", "cases"]);
		if(node.kind === "option") fields.push(["has_value", "has_value"]);
		if(node.kind === "result") fields.push(["is_ok", "is_ok"]);
		if(node.kind === "record" && !node.fields.length) fields.push(["empty", "empty"]);
		for(const [index, field] of node.fields.entries()) fields.push([field.name, `field${index}`]);
		for(const [native, python] of fields)
		{ layouts.push(`offsetof(${node.cName}, ${native})`); expected.push(`${node.raw}.${python}.offset`); }
		for(const [branchIndex, branch] of node.cases.entries()) for(const [index, field] of branch.fields.entries())
		{
			layouts.push(`offsetof(${node.cName}, cases.${branch.name}.${field.name})`);
			expected.push(`${node.raw}.cases.offset + _OwnedCase${node.index}_${branchIndex}.field${index}.offset`);
		}
	}
	for(const [native, python] of [["_mp_alloc", "allocated"], ["_mp_size", "size"], ["_mp_d", "data"]])
	{ layouts.push(`offsetof(__mpz_struct, ${native})`); expected.push(`_OwnedMpz.${python}.offset`); }
	for(const node of generated.callbackLayouts)
	{
		layouts.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		expected.push(`_c.sizeof(${node.raw})`, `_c.alignment(${node.raw})`);
		for(const field of node.fields)
		{ layouts.push(`offsetof(${node.name}, ${field})`); expected.push(`${node.raw}.${field}.offset`); }
	}
	layouts.push("sizeof(__mpz_struct)", "_Alignof(__mpz_struct)");
	expected.push("_c.sizeof(_OwnedMpz)", "_c.alignment(_OwnedMpz)");
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${c.source}
_Static_assert(GMP_NAIL_BITS == 0 && sizeof(mp_limb_t) == 8, "Python GMP ABI");
_Static_assert(sizeof(${c.values.prefix}_status) == 4, "Python status ABI");
static const size_t layouts[] = {${layouts.join(", ")}};
size_t owned_test_layout_count(void) { return sizeof(layouts) / sizeof(*layouts); }
size_t owned_test_layout(size_t index) { return layouts[index]; }
size_t owned_test_live(void) { return live; }
void owned_test_fail_after(ptrdiff_t point) { fail_after = point; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
`;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include"), "public-api.c"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-python.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	const probe = await readFile(`tests/fixtures/structured-types/owned-python-${scalar ? "scalars" : "values"}.py`, "utf8");
	const callbackProbe = scalar ? null : await readFile("tests/fixtures/structured-types/owned-python-callables.py", "utf8");
	const runtime = ownedPythonRuntime(c.values.prefix);
	const introspection = generated.types.map(node => `${JSON.stringify(node.name ?? node.id)}: (_owned_input${node.index}, _owned_output${node.index}, ${node.raw})`);
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(compiled.directory))
	{
		const root = join(interpreter.site, generated.packageDir);
		await saveLakeFile(root, "__init__.py", generated.valuesSource);
		await saveLakeFile(root, "__init__.pyi", generated.stub);
		await saveLakeFile(root, "_owned.py", runtime);
		await saveLakeFile(root, "_native.py", generated.source + `\n_layout = [${expected.join(", ")}]\n_types = {${introspection.join(", ")}}\n`);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		if(callbackProbe) await saveLakeFile(interpreter.directory, "callbacks.py", callbackProbe);
		for(const mode of scalar ? ["normal"] : ["normal", "malformed", "callbacks"])
		{
			const result = await runCopied(interpreter.command, ["-I", "-B"
				, mode === "callbacks" ? "callbacks.py" : "probe.py"
				, join(compiled.directory, "libowned-python.so")
				, mode], interpreter.directory);
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
			if(mode === "normal")
			{
				assert.ok(observed.checks > 250); assert.ok(observed.nativeFaults > 10);
				if(scalar)
				{
					assert.equal(observed.primitives, 19);
					assert.ok(observed.pythonCheckpoints > 0);
					assert.equal(observed.pythonFaults, observed.pythonCheckpoints);
				}
				else assert.ok(observed.pythonFaults > 30);
			}
			if(mode === "callbacks")
			{
				assert.ok(observed.checks > 100); assert.ok(observed.pythonFaults > 20);
				assert.equal(observed.pythonFaults, observed.pythonCheckpoints);
				assert.ok(observed.nativeFaults > 20);
				assert.ok(observed.boundedInvocations > 1 && observed.boundedInvocations < 10000);
			}
			observations.push({ name: interpreter.name, typing: interpreter.typing, mode, ...observed });
			t.diagnostic(JSON.stringify(observations.at(-1)));
		}
	}
	await saveLakeFile(resolve("build/owned-python-values"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, installedPackage: false
		, bindingIr: c.values.native.model.bindingIr
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, runtimeSha256: sha256(runtime), probeSha256: sha256(probe)
		, valuesSha256: sha256(generated.valuesSource)
		, conversionsSha256: sha256(generated.source)
		, ...callbackProbe ? { callbacksSha256: sha256(callbackProbe) } : {}
	}));
});
