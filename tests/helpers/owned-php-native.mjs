/**
 * Fresh Lean and authenticated pinned native libraries for PHP public-call probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpCalls } from "../../src/backends/php/owned-calls.mjs";
import { copiedPhpLoader } from "../../src/backends/php/copied-assets.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Compile the generated C callback wrappers without replacing their conversions.
 *
 * @param t - Test context that owns and removes the fresh compilation directory.
 * @param options - Authored fixture and optional independent reviewed contract.
 */
export const compileOwnedPhpFixture = async (t, options = {}) => {
	const compiled = await compileOwnedAggregateFixture(t, { ...options, hostCallbacks: true });
	const transferredInputs = Boolean(options.transferredInputs);
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component
		, hostCallbacks: true, transferredInputs });
	const model = generateOwnedPhpCalls(c.values.native.model.bindingIr, { transferredInputs });
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(transferredInputs) assert.equal(c.source.split(handoff).length, 2);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;${transferredInputs ? "\nstatic size_t handoffs = 0;" : ""}
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${transferredInputs ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
${model.nativeSource}
size_t owned_test_live(void) { return live; }
${transferredInputs ? "size_t owned_test_handoffs(void) { return handoffs; }\n" : ""}\
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-php.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	await copyFile(join(compiled.directory, "libowned-php.so"), join(compiled.directory, "runtime/lib/libowned-php.so"));
	for(const [path, source] of Object.entries({ ...model.files, ...bundledBrickMath() })) await saveLakeFile(compiled.directory, path, source);
	await saveLakeFile(compiled.directory, "loader.php", copiedPhpLoader);
	await saveLakeFile(compiled.directory, "probe-model.json", canonicalJson({ functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }));
	const loadOrder = ["libleanshared.so", "liblean_bridge_native.so", "libowned-php.so"], libraries = {};
	for(const name of loadOrder) libraries[name] = sha256(await readFile(join(compiled.directory, "runtime/lib", name)));
	await saveLakeFile(compiled.directory, "native-evidence.json", canonicalJson({ libraries
		, loadOrder, library: "libowned-php.so"
		, componentId: compiled.model.component.id
		, runtimeIdentity: sha256(canonicalJson(loadOrder.slice(0, 2).map(name => libraries[name])))
		, identity: sha256(implementation) }));
	const originalHelpers = await readFile("tests/fixtures/structured-types/owned-php-calls-probe.php", "utf8");
	const helpers = transferredInputs ? originalHelpers
		.replace("size_t owned_test_live(void);", "size_t owned_test_live(void);\\nsize_t owned_test_handoffs(void);")
		.replace("global $model;", "global $model, $visited; $visited[$name] = true;") : originalHelpers;
	await saveLakeFile(compiled.directory, "probe.php", helpers);
	const execute = async (source, mode = "normal") => {
		await saveLakeFile(compiled.directory, "consumer.php", source);
		const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "consumer.php", mode], compiled.directory);
		assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
	};
	return { ...compiled, model, implementation, helpers, execute };
};
