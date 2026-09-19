/**
 * C++ primitive callable admission, generated types and deferred lease cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compileCppPackageModel, generateCppBindingPackage, renderCppPackageLayout } from "../src/backends/cpp/generate.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("C++ callables expose exact integers, typed callbacks and move-only closures", () => {
	const ir = callableReviewedIr(), model = compileCppPackageModel(ir), files = generateCppBindingPackage(ir);
	assert.equal(model.surface.callbacks.size, 38); assert.equal(model.surface.functions.length, 58);
	const before = JSON.stringify([...model.surface.callbacks]);
	assert.deepEqual(renderCppPackageLayout(model), files);
	assert.equal(JSON.stringify([...model.surface.callbacks]), before);
	assert.deepEqual(files, generateCppBindingPackage(structuredClone(ir)));
	const header = files["include/callables.hpp"];
	assert.match(header, /using Nat = boost::multiprecision::cpp_int/);
	assert.match(header, /using Int = boost::multiprecision::cpp_int/);
	assert.match(header, /Nat must be nonnegative/);
	assert.match(header, /std::current_exception/); assert.match(header, /std::rethrow_exception/);
	assert.match(header, /LeanClosure\(const LeanClosure&\) = delete/);
	assert.match(header, /std::shared_ptr<detail::Lease>/);
	assert.match(header, /thread != thread_identity\(\)/);
	assert.match(header, /if \(process == ::getpid\(\)\) release\(\)/);
	assert.match(header, /std::same_as<std::invoke_result_t/);
	assert.match(header, /inline LeanClosure<Nat\(bool, Nat\)> make_nat/);
	assert.match(header, /std::vector<std::unique_ptr<Result>> results/);
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "nonprimitive callback": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "builtin collision": ir => { ir.declarations[0].name = "class"; }
})) test(`C++ callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir); assert.throws(() => compileCppPackageModel(ir));
});

test("C++ standalone dependency is complete and deferred close survives owner destruction", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-callable-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = callableReviewedIr();
	for(const [path, bytes] of Object.entries({ ...boostSources(), ...generateCBindingPackage(ir), ...generateCppBindingPackage(ir) })) await saveLakeFile(root, path, bytes);
	await saveLakeFile(root, "main.cpp", `#include "callables.hpp"
#include <cassert>
namespace api = lean_bridge::callables;
using Closure = api::LeanClosure<uint32_t(uint32_t)>;
extern "C" Closure* foreign_closure();
static Closure* current = nullptr;
static unsigned disposed = 0;
static void dispose(void** p) { assert(*p); ++disposed; *p = nullptr; }
static uint32_t invoke(api::detail::Lease& lease, uint32_t value) {
  assert(lease.active == 1 && !lease.closed); current->close(); current->close();
  assert(lease.pointer && lease.closed && disposed == 0); delete current; current = nullptr;
  assert(lease.pointer && disposed == 0); return value + 1;
}
int main() {
  auto lease = std::make_shared<api::detail::Lease>(dispose); lease->pointer = &disposed;
  current = new Closure(api::detail::ClosureFactory::make<uint32_t(uint32_t)>(lease, invoke));
  assert(current->call(41) == 42 && disposed == 1 && !lease->pointer && !lease->active);
  lease.reset(); assert(disposed == 1);
  static_assert(!std::is_copy_constructible_v<Closure> && std::is_nothrow_move_constructible_v<Closure>);
  api::Nat source = (api::Nat(1) << 1000) + 1;
  assert(source.str().size() == 302);
  std::unique_ptr<Closure> foreign(foreign_closure());
  assert(foreign->call(41) == 42); foreign->close(); assert(foreign->is_closed());
}
`);
	await saveLakeFile(root, "shared.cpp", `#include "callables.hpp"
namespace api = lean_bridge::callables;
using Closure = api::LeanClosure<uint32_t(uint32_t)>;
static unsigned token = 0;
static void dispose(void** pointer) { *pointer = nullptr; }
static uint32_t invoke(api::detail::Lease&, uint32_t value) { return value + 1; }
extern "C" __attribute__((visibility("default"))) Closure* foreign_closure() {
  auto lease = std::make_shared<api::detail::Lease>(dispose); lease->pointer = &token;
  return new Closure(api::detail::ClosureFactory::make<uint32_t(uint32_t)>(std::move(lease), invoke));
}
`);
	const options = ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-DBOOST_MP_STANDALONE", "-fvisibility=hidden", "-I", join(root, "include")];
	await runCopied("/usr/bin/c++", [...options, "-shared", "-fPIC", "shared.cpp", "-o", "libfixture.so"], root, { PATH: "/usr/bin:/bin" });
	await runCopied("/usr/bin/c++", [...options, "main.cpp", "-L", root, "-lfixture", "-Wl,-rpath,$ORIGIN", "-o", "consumer"], root, { PATH: "/usr/bin:/bin" });
	await runCopied(join(root, "consumer"), [], root);
});
