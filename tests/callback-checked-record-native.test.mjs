/**
 * Checked records crossing native C, C++ and Perl callbacks: the callable
 * graph carrier keeps the record's direction, host replies need a typed
 * record recovery, closure arguments run the exact constructor, and the
 * generated adapters compile without Lean headers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCallableCGraphPackage } from "../src/backends/c/callable-graph-package.mjs";
import { generateCallableCppGraphPackage } from "../src/backends/cpp/callable-graph-package.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { generateCallablePerlGraphPackage } from "../src/backends/perl/callable-graph-package.mjs";
import { generateCallablePerlGraphXs } from "../src/backends/perl/callable-graph-xs.mjs";
import { componentStructuredCallableLeanSource } from "../src/build/component-structured-callable-lean.mjs";
import { createNativeCallableGraphDescriptor, nativeCallableGraphCarrierAbi } from "../src/build/native-callable-graph.mjs";
import { generateCompiledCallbacks } from "../src/build/native-component.mjs";
import { containsCallbackSubtype } from "../src/build/native-graph-model.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { structuredCallableDirectionalCheckedRecordIr } from "./helpers/structured-callable-fixture.mjs";

const moduleName = "LeanBridge::Structured";
const initializer = "initialize_LeanBridgeNative0123456789abcdef";

test("native callable descriptors retain directional callback checked records in their authenticated keys", () => {
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const descriptor = createNativeCallableGraphDescriptor(ir);
	assert.deepEqual(descriptor.callbacks.find(type => type.id === host.id).refinements
		, host.source.extensions["lean-lang.org/refinements"]);
	assert.deepEqual(descriptor.callbacks.find(type => type.id === closure.id).refinements
		, closure.source.extensions["lean-lang.org/refinements"]);
	assert.deepEqual(descriptor.types.find(type => type.id === "lean:Structured.Interval").erased, ["ordered"]);
	assert.deepEqual(nativeCallableGraphCarrierAbi(descriptor, ir).callbacks, descriptor.callbacks);
	for(const type of [host, closure])
	{
		const changed = structuredClone(descriptor);
		delete changed.callbacks.find(value => value.id === type.id).refinements;
		assert.throws(() => nativeCallableGraphCarrierAbi(changed, ir), /differs/u);
	}
	// Moving the constructor across the direction changes the authenticated key.
	const moved = structuredClone(ir);
	const movedHost = moved.types.find(type => type.id === host.id);
	const hostTrees = host.source.extensions["lean-lang.org/refinements"];
	movedHost.source.extensions["lean-lang.org/refinements"] = { parameters: [hostTrees.result], result: null };
	assert.throws(() => createNativeCallableGraphDescriptor(moved), /direction/u);
});

test("callback checked records select the callable-graph carrier whether named or bare", () => {
	const nat = { kind: "primitive", name: "nat" };
	const record = { kind: "record", name: "Example.Interval", fields: [{ name: "lo", type: nat }, { name: "hi", type: nat }], erased: ["ordered"] };
	const checked = { kind: "refinement", base: record, predicate: { kind: "checked-record", constructor: "Example.mkInterval" } };
	const plain = { kind: "record", name: "Example.Pair", fields: [{ name: "lo", type: nat }, { name: "hi", type: nat }] };
	assert.equal(containsCallbackSubtype(checked), false);
	assert.equal(containsCallbackSubtype(record), false);
	assert.equal(containsCallbackSubtype({ kind: "callback", parameters: [record], result: checked }), true);
	assert.equal(containsCallbackSubtype({ kind: "callback", parameters: [checked], result: nat }), true);
	assert.equal(containsCallbackSubtype({ kind: "callback", parameters: [nat], result: record }), true);
	assert.equal(containsCallbackSubtype({ kind: "callback", parameters: [plain], result: plain }), false);
	const fin = { kind: "refinement", base: nat, predicate: { kind: "fin", bound: "3" } };
	assert.equal(containsCallbackSubtype({ kind: "callback", parameters: [fin], result: nat }), false);
});

test("native callback checked-record trampolines require a typed record recovery and refuse constructor failures", () => {
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const generated = generateNativeCallableGraphCalls(ir, descriptor, { initializer });
	const hostSignature = descriptor.callbacks.find(type => type.id === host.id);
	const closureSignature = descriptor.callbacks.find(type => type.id === closure.id);
	assert.match(generated.borrowsHeader, new RegExp(`${hostSignature.key}[^}]+const structured_interval_t \\*recovery;`, "su"));
	assert.doesNotMatch(generated.borrowsHeader, new RegExp(`${closureSignature.key}[^}]+recovery`, "su"));
	assert.match(generated.source, new RegExp(`ng_recovery_${hostSignature.key}`, "u"));
	assert.match(generated.source, new RegExp(`ng_reject_${hostSignature.key}`, "u"));
	assert.match(generated.source, new RegExp(`ng_borrow_${hostSignature.key}[^;]+ng_recovery_${hostSignature.key}[^;]+ng_reject_${hostSignature.key}`, "su"));
	assert.doesNotMatch(generated.source, new RegExp(`ng_recovery_${closureSignature.key}`, "u"));
	assert.equal(generated.closures.some(item => item.id === host.id), false);
	assert.equal(generated.closures.some(item => item.id === closure.id), true);
	assert.doesNotMatch(generated.source, new RegExp(`${hostSignature.key}_apply`, "u"));
	assert.match(generated.source, new RegExp(`${closureSignature.key}_apply`, "u"));
	assert.match(generated.source, /lean_array_size\(value\) == 0[^}]+ng_borrow_fail\(frame, NG_INVALID\)/su);
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const model = { copiedGraph: descriptor, bindingIr: ir, profile: "native-library-v1", pointerBits: 64, byteOrder: "little", schemaVersion: 4 };
	const callbacks = generateCompiledCallbacks(model);
	assert.match(callbacks, new RegExp(`${abi.exports[0].symbol}_structured_callback_controls`, "u"));
	assert.match(callbacks, /controls->recovery\(callback\.context\)/u);
	assert.match(callbacks, /controls->reject\(callback\.context, recovery\)/u);
});

test("the native structured callable adapter constructs host replies and closure arguments through record mirrors", () => {
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const declaration = bindingId => ir.declarations.find(item => item.id === bindingId).source.declaration;
	const exports = abi.exports.map((item, index) => ({
		bindingId: item.bindingId, symbol: item.symbol
		, wrapper: `export${index}`, sourceDeclaration: declaration(item.bindingId)
		, parameters: item.parameters.map(() => ({ leanType: "" }))
	}));
	const source = componentStructuredCallableLeanSource(abi, exports).join("\n");
	assert.doesNotMatch(source, /sorry|unsafeCast|axiom/u);
	assert.match(source, /structure LbErased\.Structured\.Interval where\n {2}«lo» : _root_\.Nat\n {2}«hi» : _root_\.Nat\n/u);
	assert.doesNotMatch(source, /«ordered»/u);
	assert.match(source, /def LbErased\.Structured\.Interval\.erase \(value : _root_\.Structured\.Interval\)/u);
	assert.match(source, /_root_\.Structured\.mkInterval a0 a1/u);
	const hostKey = descriptor.callbacks.find(type => type.id === host.id).key;
	const closureKey = descriptor.callbacks.find(type => type.id === closure.id).key;
	// The host reply is constructed and the Lean-produced argument erased; the closure
	// constructs its argument before its body runs.
	assert.match(source, new RegExp(`${hostKey}[\\s\\S]*LbErased\\.Structured\\.Interval\\.via_`, "u"));
	assert.match(source, new RegExp(`${hostKey}[\\s\\S]*LbErased\\.Structured\\.Interval\\.erase`, "u"));
	assert.match(source, new RegExp(`${closureKey}[\\s\\S]*LbErased\\.Structured\\.Interval\\.via_`, "u"));
});

test("C/GMP callback checked records expose a typed record recovery and compile without Lean headers", { timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-c-callback-checked-record-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const generated = generateCallableCGraphPackage(ir);
	const native = generateNativeCallableGraphCalls(ir, createNativeCallableGraphDescriptor(ir), { initializer });
	const hostType = generated.callbacks.get(host.id), closureType = generated.callbacks.get(closure.id);
	assert.equal(hostType.direction, "host");
	assert.equal(closureType.direction, "closure");
	const header = generated.files["gmp/include/detail/structured-gmp-api.h"];
	assert.match(header, new RegExp(`#define ${hostType.publicName.toUpperCase()}_REQUIRES_RECOVERY 1`, "u"));
	assert.match(header, new RegExp(`typedef struct ${hostType.gmpName} \\{ ${hostType.gmpName}_fn call; void \\*context; structured_gmp_interval_t const \\* recovery; \\}`, "u"));
	assert.match(header, new RegExp(`#define ${closureType.publicName.toUpperCase()}_REQUIRES_RECOVERY 0`, "u"));
	assert.doesNotMatch(header, new RegExp(`${closureType.gmpName}[^}]+recovery`, "su"));
	assert.doesNotMatch(header, new RegExp(hostType.gmpOwnedName, "u"));
	assert.match(header, new RegExp(`${closureType.gmpOwnedName}_call\\(const ${closureType.gmpOwnedName} \\*self, bool a0, structured_gmp_interval_t const \\*a1, mpz_ptr out`, "u"));
	const values = generated.files["gmp/include/detail/structured-gmp-graph-values.h"];
	assert.match(values, /struct structured_gmp_interval_t \{\n {2}void \*_bridge_owner;\n {2}void \(\*_bridge_release\)\(void \*owner, void \*root\);\n {2}structured_gmp_scalar_nat_t lo;\n {2}structured_gmp_scalar_nat_t hi;\n\};/u);
	assert.doesNotMatch(values, /ordered/u);
	const source = generated.files["gmp/src/structured_gmp.c"];
	assert.doesNotMatch(source, new RegExp(hostType.call, "u"));
	assert.match(source, new RegExp(closureType.call, "u"));
	assert.match(source, /_check\(a\d+->recovery, 0, 1, &state\.budget\)/u);
	assert.match(source, /_to\(a\d+->recovery, &recovery\d+, &views\)/u);
	const files = { ...generated.files
		, "include/detail/structured-graph-types.h": native.typesHeader
		, "include/detail/structured-callable-borrows.h": native.borrowsHeader
		, "include/detail/structured-graph.h": native.header + "\nint structured_graph_ready(void); void structured_graph_retire(void); uint32_t structured_graph_initialize(void);\n"
		, "include/lean_bridge_native_runtime.h": brokerHeader };
	for(const [path, text] of Object.entries(files)) await saveLakeFile(directory, path, text);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-Iinclude", "-Iinclude/detail", "-Igmp/include", "-Igmp/internal"
		, "-Igmp/include/detail"
		, "-c", "gmp/src/structured_gmp.c", "-o", "gmp.o"], directory
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
});

test("C++ callback checked records require an exact record recovery wrapper", { timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-cpp-callback-checked-record-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const generated = generateCallableCppGraphPackage(ir);
	const native = generateNativeCallableGraphCalls(ir, createNativeCallableGraphDescriptor(ir), { initializer });
	const hostType = generated.callbacks.get(host.id), closureType = generated.callbacks.get(closure.id);
	const header = generated.files["include/structured.hpp"];
	assert.match(header, /inline auto with_recovery\(/u);
	assert.match(header, new RegExp(`GraphAccepts${hostType.index} = graph_recovery_matches<std::remove_cvref_t<Function>, Interval>`, "u"));
	assert.doesNotMatch(header, new RegExp(`GraphAccepts${closureType.index} = graph_recovery_matches`, "u"));
	assert.doesNotMatch(header, new RegExp(`graph_invoke${hostType.index}\\(`, "u"));
	assert.match(header, new RegExp(`graph_invoke${closureType.index}\\(GraphLease& lease, const bool& a0, const Interval& a1\\)`, "u"));
	assert.match(generated.files["include/detail/structured-values.hpp"], /struct Interval \{\n {2}Nat lo\{\};\n {2}Nat hi\{\};\n/u);
	const files = { ...generated.files, ...boostSources()
		, "include/detail/structured-graph-types.h": native.typesHeader
		, "include/detail/structured-callable-borrows.h": native.borrowsHeader
		, "include/detail/structured-graph.h": native.header + '\nextern "C" { int structured_graph_ready(void); void structured_graph_retire(void); }\n'
		, "consumer.cpp": `#include "structured.hpp"
namespace api = lean_bridge::structured;
auto plain = [](const api::Interval& value) { return value; };
using Plain = decltype(plain);
using Recovered = decltype(api::with_recovery(plain, api::Interval{api::Nat{1}, api::Nat{3}}));
using Scalar = decltype(api::with_recovery(plain, api::Nat{1}));
static_assert(!api::detail::GraphAccepts${hostType.index}<Plain>);
static_assert(api::detail::GraphAccepts${hostType.index}<Recovered>);
static_assert(!api::detail::GraphAccepts${hostType.index}<Scalar>);
` };
	for(const [path, text] of Object.entries(files)) await saveLakeFile(directory, path, text);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.cpp"], directory);
});

test("Perl callback checked records copy a typed record recovery and keep the projection boundary", { timeout: 180_000 }, async t => {
	const { ir, host, closure } = structuredCallableDirectionalCheckedRecordIr();
	const projection = generateCallablePerlGraphXs(ir, moduleName);
	const hostType = projection.callbacks.get(host.id), closureType = projection.callbacks.get(closure.id);
	assert.equal(hostType.direction, "host");
	assert.equal(closureType.direction, "closure");
	assert.match(projection.valuesSource, /package LeanBridge::Structured::Runtime::Callback;/u);
	assert.match(projection.valuesSource, /package LeanBridge::Structured::Interval;[\s\S]*my @required = qw\(lo hi\);/u);
	assert.doesNotMatch(projection.valuesSource, /ordered/u);
	assert.match(projection.xs, /callback\d+_fields\[\] = \{"code", "recovery"\}/u);
	assert.match(projection.xs, new RegExp(`lpg_read${hostType.result.index}\\([^;]+recovery\\d+`, "u"));
	assert.match(projection.xs, new RegExp(`input\\d+ = \\{lpc_callback_${hostType.index}, lpc_callback_new\\([^}]+recovery\\d+\\}`, "u"));
	assert.doesNotMatch(projection.xs, new RegExp(`PACKAGE = ${hostType.publicType}`, "u"));
	assert.doesNotMatch(projection.source, new RegExp(hostType.call, "u"));
	assert.match(projection.source, new RegExp(closureType.call, "u"));
	const closureStart = projection.xs.indexOf(`PACKAGE = ${closureType.publicType}`);
	assert.notEqual(closureStart, -1);
	const closureSection = projection.xs.slice(closureStart, projection.xs.indexOf("\nMODULE =", closureStart + 1));
	assert.doesNotMatch(closureSection, /_fields\[\]|Runtime::Callback|recovery/u);
	const model = { bindingIr: ir, component: ir.component, moduleName
		, copiedGraph: projection.descriptor
		, sourceIdentity: { modules: [{ module: "Structured", source: { sha256: "a".repeat(64) } }] } };
	const receipt = { initializer
		, library: "libcomponent_0123456789abcdef0123.so"
		, nativeLibrary: { sha256: "b".repeat(64) }
		, runtimeIdentity: "c".repeat(64) };
	const files = generateCallablePerlGraphPackage(model, receipt);
	assert.match(files["lib/LeanBridge/Structured.pm"], /checked Lean Subtype or checked record must use/u);
	const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-checked-record-xs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "Component.xs", files["Component.xs"]);
	await runCopied("/usr/bin/perl", ["-MExtUtils::ParseXS", "-e"
		, 'ExtUtils::ParseXS::process_file(filename => "Component.xs", output => "Component.c", prototypes => 0)']
		, directory, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	for(const targets of [["c"], ["cpp"], ["cpan"], ["c", "cpp", "cpan"]])
		assert.ok(compileNativeGraphProjection(ir, targets, moduleName).layoutSha256);
	for(const target of ["pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi"])
		assert.throws(() => compileNativeGraphProjection(ir, [target], moduleName)
			, { code: "native-graph-projection-unavailable", message: /Callback checked records currently require C, C\+\+ or CPAN projections/u });
});
