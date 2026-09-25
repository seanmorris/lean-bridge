/**
 * Link both prepared APIs into one process, then remove every build input.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { compileCallableGraphPackageModel } from "../../src/backends/c/callable-graph-model.mjs";
import { nativeRecursiveCallableReviewedIr } from "./native-recursive-callable-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const source = headers => {
	const model = compileCallableGraphPackageModel(nativeRecursiveCallableReviewedIr(), ["c", "cpp"]);
	const call = model.functions.find(fn => fn.declaration.name === "callRecursive");
	const owned = model.functions.find(fn => fn.declaration.name === "makeRecursive").result.publicOwnedName;
	return headers.map(header => `#include "${header}"`).join("\n") + String.raw`
#include <cassert>
#include <cstdio>
#include <dlfcn.h>
namespace api = lean_bridge::structured;
static unsigned checks, callbacks;
static void check(bool test) { ++checks; assert(test); }
struct Snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static Snapshot snapshot() {
  auto read = reinterpret_cast<void (*)(Snapshot*)>(dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read"));
  check(read); Snapshot result{}; read(&result); return result;
}
static structured_status echo(void*, const structured_tree_t *value, structured_tree_t *out, structured_error *error) {
  ++callbacks; return structured_tree_t_copy(value, out, error);
}
int main(int argc, char**) {
  check(structured_initialize(nullptr) == STRUCTURED_STATUS_OK);
  if (argc > 1) return 0;
  const auto before = snapshot(); check(before.runs == 1 && before.components == 1 && before.identities == 0);
  for (unsigned i = 0; i < 32; ++i) {
    structured_tree_t input, output; structured_tree_t_init(&input); structured_tree_t_init(&output);
    check(structured_tree_t_select(&input, STRUCTURED_TREE_T_KIND_LEAF) == STRUCTURED_STATUS_OK);
    mpz_set_ui(input.cases.leaf.value, 1); mpz_mul_2exp(input.cases.leaf.value, input.cases.leaf.value, 257); mpz_add_ui(input.cases.leaf.value, input.cases.leaf.value, i);
    ${call.parameters[1].publicName} callback{echo, nullptr};
    check(structured_call_recursive(&input, &callback, &output, nullptr) == STRUCTURED_STATUS_OK);
    check(output.kind == STRUCTURED_TREE_T_KIND_LEAF && !mpz_cmp(input.cases.leaf.value, output.cases.leaf.value));
    api::Tree value = api::TreeLeaf{(api::Nat(1) << 257) + i};
    check(api::call_recursive(value, [](api::Tree value) { ++callbacks; return value; }) == value);
    ${owned} *c_closure = nullptr; check(structured_make_recursive(&input, &c_closure, nullptr) == STRUCTURED_STATUS_OK);
    auto cpp_closure = api::make_recursive(value); const auto active = snapshot();
    check(active.runtime == before.runtime && active.domain == before.domain && active.runs == 1 && active.components == 1 && active.identities == 2);
    check(${owned}_call(c_closure, true, &input, &output, nullptr) == STRUCTURED_STATUS_OK);
    check(output.kind == STRUCTURED_TREE_T_KIND_LEAF && !mpz_cmp(input.cases.leaf.value, output.cases.leaf.value));
    check(cpp_closure.call(true, api::TreeLeaf{0}) == value);
    ${owned}_dispose(&c_closure); cpp_closure.close(); check(!c_closure && cpp_closure.is_closed());
    structured_tree_t_clear(&input); structured_tree_t_clear(&output); check(snapshot().identities == 0);
  }
  const auto after = snapshot(); check(callbacks == 64);
  std::printf("{\"checks\":%u,\"iterations\":32,\"callbacks\":%u,\"runtimeInitializations\":%u,\"components\":%u,\"identities\":%u}\n", checks, callbacks, after.runs, after.components, after.identities);
}
`;
};

/**
 * Prepare both include orders. The returned verifier runs after archive/header deletion.
 *
 * @param options - Already installed original archives in a relocated workspace.
 * @param options.consumer - Test-owned consumer directory.
 * @param options.handoff - Original archive handoff to remove before verification.
 * @param options.packages - Exact package-set receipt entries for C and C++.
 */
export const prepareRecursiveCFamilyInstallation = async ({ consumer, handoff, packages }) => {
	const working = join(consumer, "mixed-build"), deployment = join(consumer, "mixed-runtime-only");
	await mkdir(join(deployment, "lib"), { recursive: true });
	const flags = [], installed = [], libraries = new Map();
	for(const profile of ["cpp", "c"])
	{
		const pkg = packages.find(item => item.target === profile && item.role === "component");
		const root = join(consumer, profile, `${pkg.name}-${pkg.version}-${profile}`); installed.push(root);
		const receipt = JSON.parse(await readFile(join(root, "lean-bridge-package.json")));
		const env = { ...copiedCleanEnvironment, PKG_CONFIG_LIBDIR: join(root, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		flags.push(...(await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, env)).stdout.trim().split(/\s+/u));
		for(const name of await readdir(join(root, "lib")))
		{
			if(!/\.so(?:\.|$)/u.test(name)) continue;
			const library = await readFile(join(root, "lib", name)), hash = sha256(library);
			if(libraries.has(name))
			{ assert.equal(libraries.get(name), hash, `C and C++ disagree on ${name}`); continue; }
			libraries.set(name, hash);
			await cp(join(root, "lib", name), join(deployment, "lib", name), { dereference: true, recursive: true });
		}
	}
	const observations = [];
	for(const headers of [["structured.h", "structured.hpp"], ["structured.hpp", "structured.h"]])
	{
		const name = headers[0].endsWith("hpp") ? "cpp-first" : "c-first", text = source(headers);
		await saveLakeFile(working, `${name}.cpp`, text);
		const executable = join(deployment, name);
		const args = ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, "-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all"
			, "-fno-omit-frame-pointer", "-no-pie"
			, `${name}.cpp`, ...flags.filter(flag => !flag.startsWith("-Wl,-rpath,"))
			, "-Wl,-rpath,$ORIGIN/lib", "-o", executable];
		await runCopied("/usr/bin/c++", args, working
			, { ...copiedCleanEnvironment, PATH: join(consumer, "cpp/tools") });
		observations.push({ name, executable, consumerSha256: sha256(text), executableSha256: sha256(await readFile(executable)) });
	}
	return async () => {
		await rm(working, { recursive: true, force: true });
		for(const file of [join(handoff, "package-set-receipt.json"), ...installed.map(root => join(root, "lean-bridge-package.json"))])
			await assert.rejects(readFile(file), { code: "ENOENT" });
		const env = { ...copiedCleanEnvironment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
			, LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1" };
		const reports = [];
		for(const { executable, ...observation } of observations)
		{
			const startup = await runCopied(executable, ["--startup-only"], deployment, env);
			const run = await runCopied(executable, [], deployment, env);
			const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(deployment, "<runtime-only>");
			assert.equal(normalize(run.stderr), normalize(startup.stderr));
			assert.doesNotMatch(run.stderr, /ERROR: AddressSanitizer|runtime error:/u);
			const observed = JSON.parse(run.stdout);
			assert.ok(observed.checks > 100); assert.equal(observed.iterations, 32); assert.equal(observed.callbacks, 64);
			assert.equal(observed.runtimeInitializations, 1); assert.equal(observed.components, 1); assert.equal(observed.identities, 0);
			reports.push({ ...observation, observed, startupLeakReport: normalize(startup.stderr) });
		}
		return { reports, libraries: Object.fromEntries(libraries)
			, sourceFreeExecution: true, compilerFreeExecution: true
			, archivesRemoved: true
			, sanitizers: ["address", "leak", "undefined"] };
	};
};
