/**
 * Generated C++ value and callback conversions executed against compiled Lean.
 * This suite exercises the public header, not prepared-package admission.
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
import { generateOwnedCppCallables } from "../src/backends/cpp/owned-callables.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const headers = async (directory, generated) => {
	const p = generated.c.prefix;
	for(const [path, source] of Object.entries({
		[`${p}.h`]: generated.c.header, [`${p}-values.hpp`]: generated.valuesHeader
		, [`${p}-conversions.hpp`]: generated.conversionsHeader
		, [`${p}.hpp`]: generated.header
		, ...boostSources()
	})) await saveLakeFile(directory, path, source);
};

const malformedProbe = generated => {
	const nodes = generated.types, primitive = name => nodes.find(node => node.kind === "primitive" && node.name === name);
	const tree = nodes.find(node => node.name === "Tree");
	const branches = tree.cases.find(branch => branch.name === "branch");
	const children = nodes.find(node => node.id === branches.fields[0].type);
	const array = nodes.find(node => node.kind === "array" && node.id !== children.id);
	const option = nodes.find(node => node.kind === "option"), nat = primitive("nat"), string = primitive("string");
	const body = [];
	const rejects = (node, setup, status = "MALFORMED_RESULT") => body.push("  {"
		, "    api::detail::OwnedBudget budget; api::detail::OwnedOutput output(state);"
		, `    ${setup}`
		, `    rejects([&] { (void)api::detail::owned_from${node.index}(value, 0, budget, output); }, OWNED_AGGREGATES_${status});`
		, "  }");
	rejects(string, `${string.cName} value{nullptr, 1};`);
	rejects(string, `${string.cName} value{"\\xc0\\x80", 2};`);
	rejects(string, `${string.cName} value{nullptr, SIZE_MAX};`, "LIMIT");
	rejects(nat, "__mpz_struct number{}; mp_limb_t limb = 1; mpz_srcptr value = mpz_roinit_n(&number, &limb, -1);");
	rejects(nat, "__mpz_struct number{}; number._mp_size = INT_MIN; mpz_srcptr value = &number;", "LIMIT");
	rejects(array, `${array.cName} value{nullptr, 1};`);
	rejects(array, `${array.cName} value{nullptr, SIZE_MAX};`, "LIMIT");
	rejects(option, `${option.cName} value{}; uint8_t invalid = 2; std::memcpy(&value.has_value, &invalid, 1);`);
	rejects(tree, `${tree.cName} value{}; std::underlying_type_t<decltype(value.kind)> invalid = 255; std::memcpy(&value.kind, &invalid, sizeof(invalid));`);
	rejects(tree, `${tree.cName} value{}; ${children.cName} loop{&value, 1}; value.kind = ${branches.tag}; value.cases.branch.children = &loop;`, "LIMIT");
	for(const name of ["bool", "unit"])
	{
		const node = primitive(name);
		if(node) rejects(node, `${node.cName} value{}; uint8_t invalid = 2; std::memcpy(&value, &invalid, 1);`);
	}
	return `\nstatic void test_malformed() {\n  auto state = api::detail::current_state();\n${body.join("\n")}\n}\n`;
};

test("C++ returned higher-order closures accept mutable host callbacks", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-cpp-higher-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = ownedAggregateReviewedIr();
	const factory = ir.declarations.find(item => item.name === "makeRecord");
	const callback = ir.declarations.find(item => item.name === "callbackRecord").parameters[1];
	const closure = ir.types.find(item => item.id === factory.result.type.id);
	closure.callable.parameters[0] = { ...callback, name: "arg0" };
	const generated = generateOwnedCppCallables(ir);
	await headers(directory, generated);
	await saveLakeFile(directory, "consumer.cpp", `#include "${generated.c.prefix}.hpp"
namespace api = lean_bridge::${generated.c.prefix};
void check(const api::Bundle& value) {
  auto dispatcher = api::make_record(value);
  auto callback = [count = 0](const api::Bundle& input) mutable {
    auto result = input; result.payload.count = ++count; return result;
  };
  (void)dispatcher(callback, value);
  (void)dispatcher([count = 0](const api::Bundle& input) mutable {
    auto result = input; result.payload.count = ++count; return result;
  }, value);
}
`);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-I", "include", "-fsyntax-only", "consumer.cpp"]
	, directory, { PATH: "/usr/bin:/bin" });
});

test("C++ owned conversions compile boxed optional recursion and nested options", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-cpp-boxes-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = ownedAggregateReviewedIr(), bundle = ir.types.find(item => item.name === "Bundle");
	const option = type => ({ kind: "apply", constructor: "option", arguments: [type] });
	bundle.fields.push({ ...bundle.fields[0], name: "next", type: option({ kind: "named", id: bundle.id }) });
	bundle.fields.push({ ...bundle.fields[0], name: "marker", type: option(option({ kind: "primitive", name: "bool" })) });
	const generated = generateOwnedCppCallables(ir);
	await headers(directory, generated);
	await saveLakeFile(directory, "consumer.cpp", `#include "${generated.c.prefix}.hpp"
namespace api = lean_bridge::${generated.c.prefix};
void check(api::Bundle value) {
  value.next.emplace(value); value.marker.emplace();
  (void)api::echo_record(value);
  value.marker->emplace(false);
  (void)api::echo_record(value);
}
`);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-I", "include", "-fsyntax-only", "consumer.cpp"]
	, directory, { PATH: "/usr/bin:/bin" });
});

for(const [fixture, review] of [["owned-aggregates", ownedAggregateReviewedIr], ["owned-host-callbacks", ownedHostCallbackReviewedIr]])
{
	test(`C++ owned call headers are deterministic and compile (${fixture})`, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-cpp-headers-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const ir = review(), before = structuredClone(ir), generated = generateOwnedCppCallables(ir);
		assert.deepEqual(ir, before);
		const reversed = structuredClone(ir); reversed.types.reverse();
		assert.equal(generateOwnedCppCallables(reversed).header, generated.header);
		await headers(directory, generated);
		await saveLakeFile(directory, "consumer.cpp", await readFile("tests/fixtures/structured-types/owned-cpp-callables.cpp", "utf8") + malformedProbe(generated));
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall"
			, "-Wextra", "-Werror", "-pthread"
			, ...fixture === "owned-aggregates" ? ["-DOWNED_FULL_SURFACE"] : []
			, "-I", "include", "-fsyntax-only", "consumer.cpp"]
		, directory, { PATH: "/usr/bin:/bin" });
	});
	for(const reviewed of [false, true]) test(`C++ owned exports and callbacks execute (${fixture}, ${reviewed ? "reviewed" : "ordinary"})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
	}, async t => {
		const compiled = await compileOwnedAggregateFixture(t, { fixture
			, hostCallbacks: true
			, ...(reviewed ? { reviewedIr: review() } : {}) });
		const generated = generateOwnedCPackage({ metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, hostCallbacks: true });
		const implementation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${generated.source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
		for(const [path, source] of Object.entries(generated.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
		const cpp = generateOwnedCppCallables(generated.layout.model.bindingIr);
		await headers(compiled.directory, cpp);
		const template = await readFile("tests/fixtures/structured-types/owned-cpp-callables.cpp", "utf8");
		const source = template + malformedProbe(cpp);
		await saveLakeFile(compiled.directory, "consumer.cpp", source);
		const environment = { PATH: "/usr/bin:/bin" };
		const compile = async sanitized => {
			const suffix = sanitized ? "-sanitized" : "", flags = sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"] : [];
			await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
				, "-Wextra", "-Werror", "-fPIC", ...flags
				, "-I", join(compiled.directory, "runtime/include")
				, "-c", "public-api.c", "-o", `public-api${suffix}.o`]
			, compiled.directory, environment);
			await runCopied("/usr/bin/cc", ["-shared", ...flags
				, `public-api${suffix}.o`, "Owned.o", "Carriers.o", "Witness.o"
				, "Callbacks.o"
				, "-L", join(compiled.directory, "runtime/lib")
				, "-llean_bridge_native", "-lleanshared", "-lgmp"
				, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
				, "-o", `libowned-cpp${suffix}.so`], compiled.directory, environment);
			await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
				, "-Wextra", "-Werror", "-pthread", ...flags
				, ...sanitized ? ["-no-pie"] : []
				, ...fixture === "owned-aggregates" ? ["-DOWNED_FULL_SURFACE"] : []
				, "-I", "include", "consumer.cpp", "-L", compiled.directory
				, `-l:libowned-cpp${suffix}.so`, "-lgmp"
				, "-Wl,--export-dynamic", "-Wl,-rpath," + compiled.directory
				, "-o", `consumer${suffix}`], compiled.directory, environment);
			return extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-cpp", join(compiled.directory, `consumer${suffix}`)], compiled.directory
				, { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", ...extra });
		};
		const normal = await (await compile(false))({}); assert.equal(normal.stderr, "");
		const result = JSON.parse(normal.stdout); assert.ok(result.checks > 200); assert.ok(result.allocationFailures > 30);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		const sanitized = await compile(true);
		const cold = await sanitized({ LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const checked = await sanitized({ LSAN_OPTIONS: "exitcode=0" });
		assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
		const sanitizedResult = JSON.parse(checked.stdout);
		// Sanitizer instrumentation can change allocation elision. Exhaust each
		// executable's allocation sites, then compare the non-fault assertions.
		for(const probe of [result, sanitizedResult])
		{
			assert.ok(probe.allocationFailures > 30);
			assert.equal(probe.faultChecks, probe.allocationFailures * 2 + 4);
			assert.equal(probe.live, 0); assert.equal(probe.identities, 0);
		}
		assert.equal(sanitizedResult.checks - sanitizedResult.faultChecks, result.checks - result.faultChecks);
		const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
		assert.doesNotMatch(checked.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		assert.equal(normalize(checked.stderr), normalize(cold.stderr));
		await saveLakeFile(resolve("build/owned-cpp-callables"), `${fixture}-${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
			result, sanitizedResult
			, sourceIdentitySha256: compiled.sourceIdentitySha256
			, headerSha256: sha256(cpp.header)
			, conversionsSha256: sha256(cpp.conversionsHeader)
			, valuesSha256: sha256(cpp.valuesHeader), probeSha256: sha256(source)
			, templateSha256: sha256(template)
			, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>")
		}));
		t.diagnostic(JSON.stringify({ result, sanitizedResult }));
	});
}
