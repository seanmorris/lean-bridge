/**
 * Real C++ RAII cleanup over compiled ownership-aware Lean resources.
 * This is runtime support evidence, not prepared C++ package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedCppRuntime } from "../src/backends/cpp/owned-runtime.mjs";
import { generateOwnedCppValues } from "../src/backends/cpp/owned-values.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("C++ ownership support rejects injected package identifiers", () => {
	for(const name of ["Bad", "a__b", "a;\n#error injected", ""])
		assert.throws(() => ownedCppRuntime(name));
});

test("owned C++ values preserve aliases, named constructors and standard containers", () => {
	const ir = ownedAggregateReviewedIr(), original = structuredClone(ir), values = generateOwnedCppValues(ir);
	assert.deepEqual(ir, original);
	const repeated = generateOwnedCppValues(ir);
	assert.equal(repeated.header, values.header); assert.equal(repeated.c.header, values.c.header);
	assert.deepEqual(repeated.types, values.types); assert.deepEqual(repeated.layout, values.layout);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.equal(generateOwnedCppValues(reversed).header, values.header);
	assert.match(values.header, /using Ticket = Resource<detail::Identity[a-f0-9]+>;/u);
	assert.match(values.header, /using BundleAlias = Bundle;/u);
	assert.match(values.header, /using TicketRow = Value[a-f0-9]+;/u);
	assert.match(values.header, /std::variant<ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany>/u);
	assert.match(values.header, /std::vector<Tree>/u);
	assert.ok(values.types.find(node => node.name === "Bundle").fields.every(field => !field.boxed));
	for(const name of ["Resource", "Box", "Nat", "class", "ChoiceEmpty", "echo_record"])
	{
		const changed = structuredClone(ir); changed.types.find(node => node.name === "Payload").name = name;
		assert.throws(() => generateOwnedCppValues(changed), /name|reserved|collision/u);
	}
});

test("owned C++ recursive fields box nominal values and bound shared inline expansion", () => {
	const ir = ownedAggregateReviewedIr(), bundle = ir.types.find(node => node.name === "Bundle");
	const next = { kind: "apply", constructor: "option", arguments: [{ kind: "named", id: bundle.id }] };
	bundle.fields.push({ ...bundle.fields[0], name: "next", type: next });
	const recursive = generateOwnedCppValues(ir);
	assert.match(recursive.header, /std::optional<Box<Bundle>>/u);
	assert.doesNotMatch(recursive.header, /Box<std::optional/u);
	assert.equal(recursive.types.find(node => node.name === "Bundle").fields.at(-1).boxed, false);
	const shared = ownedAggregateReviewedIr(), template = shared.types.find(node => node.name === "Bundle");
	let previous = "lean:Owned.Ticket";
	for(let index = 0; index < 700; index++)
	{
		const id = `lean:Owned.Shared${index}`;
		const fields = ["left", "right"].map(name => ({ ...template.fields[0], name, type: { kind: "named", id: previous } }));
		shared.types.push({ ...template, id, name: `Shared${index}`, fields });
		previous = id;
	}
	const echo = shared.declarations.find(declaration => declaration.name === "echoRecord");
	echo.parameters[0].type = { kind: "named", id: previous };
	echo.result.type = { kind: "named", id: previous };
	const values = generateOwnedCppValues(shared);
	assert.ok(values.header.length < 400000, `Generated ${values.header.length} bytes`);
	assert.ok(values.types.some(node => node.fields.some(field => field.boxed)));
});

for(const reviewed of [false, true]) test(`C++ resource leases clean up on their owner thread (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-host-callbacks", hostCallbacks: true
		, ...(reviewed ? { reviewedIr: ownedHostCallbackReviewedIr() } : {}) });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true });
	const p = generated.values.prefix;
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
	const values = generateOwnedCppValues(generated.layout.model.bindingIr), header = values.header;
	for(const [path, source] of Object.entries(boostSources())) await saveLakeFile(compiled.directory, path, source);
	await saveLakeFile(compiled.directory, `${p}.hpp`, header);
	const template = await readFile("tests/fixtures/structured-types/owned-cpp-runtime.cpp", "utf8");
	const source = template.replaceAll("TICKET_KIND", values.types.find(node => node.name === "Ticket").identityTag);
	await saveLakeFile(compiled.directory, "consumer.cpp", source);
	const environment = { PATH: "/usr/bin:/bin" };
	const compile = async sanitized => {
		const suffix = sanitized ? "-sanitized" : "", flags = sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"] : [];
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-fPIC"
			, ...flags
			, "-I", join(compiled.directory, "runtime/include")
			, "-c", "public-api.c"
			, "-o", `public-api${suffix}.o`], compiled.directory, environment);
		// Match the installed C boundary. Linking leanshared directly into a GCC
		// C++ executable interposes Lean's unwinder ahead of libgcc_s.
		await runCopied("/usr/bin/cc", ["-shared", ...flags, `public-api${suffix}.o`
			, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", `libowned-cpp${suffix}.so`], compiled.directory, environment);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-pthread", ...flags
			, ...sanitized ? ["-no-pie"] : []
			, "-I", "include"
			, "consumer.cpp", "-L", compiled.directory
			, `-l:libowned-cpp${suffix}.so`, "-lgmp"
			, "-Wl,--export-dynamic", "-Wl,-rpath," + compiled.directory
			, "-o", `consumer${suffix}`], compiled.directory, environment);
		return extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-cpp", join(compiled.directory, `consumer${suffix}`)], compiled.directory
			, { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", ...extra });
	};
	const normal = await (await compile(false))({}); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); assert.ok(result.checks > 300);
	assert.deepEqual({ ...result, checks: 0 }, { checks: 0, allocationFailures: 4, valueCopyFailures: 3, live: 0, identities: 0 });
	const sanitized = await compile(true);
	const cold = await sanitized({ LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const checked = await sanitized({ LSAN_OPTIONS: "exitcode=0" });
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true }); assert.deepEqual(JSON.parse(checked.stdout), result);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.doesNotMatch(checked.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(checked.stderr), normalize(cold.stderr));
	await saveLakeFile(resolve("build/owned-cpp-runtime"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		result, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(header), probeSha256: sha256(source)
		, templateSha256: sha256(template)
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>")
	}));
	t.diagnostic(JSON.stringify(result));
});
