/**
 * Observe the shared broker without modifying installed component archives.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const source = `#include <php.h>
#include "lean_bridge_native_runtime.h"
ZEND_BEGIN_ARG_INFO_EX(observer_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(owned_installed_snapshot) {
  ZEND_PARSE_PARAMETERS_NONE();
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "runtimeState", snapshot.runtime_state);
  add_assoc_long(return_value, "runtimeInitRuns", snapshot.runtime_init_runs);
  add_assoc_long(return_value, "componentInitRuns", snapshot.component_init_runs);
  add_assoc_long(return_value, "attachedComponents", snapshot.attached_components);
  add_assoc_long(return_value, "liveIdentities", snapshot.live_identities);
}
static const zend_function_entry observer_functions[] = {
  ZEND_FE(owned_installed_snapshot, observer_args)
  PHP_FE_END
};
zend_module_entry observer_module_entry = {
  STANDARD_MODULE_HEADER, "owned_installed_observer", observer_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(observer)
`;

/**
 * Build a separate test observer; no diagnostic hooks enter published sources.
 *
 * @param options - Test-owned directory and verified pinned compiler inputs.
 */
export const buildOwnedPhpWasmObserver = async options => {
	const { directory, runtimeRoot, emsdkRoot, phpSource } = options;
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	await saveLakeFile(directory, "observer.c", source);
	const includes = [phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path)), join(runtimeRoot, "include")];
	const args = ["-O2", "-shared", "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']"
		, ...includes.flatMap(path => ["-I", path])
		, "observer.c", join(runtimeRoot, runtime.manifest.library)
		, "-o", "observer.so"];
	await runCopied(join(emsdkRoot, "upstream/emscripten/emcc"), args, directory
		, { ...process.env, EM_CONFIG: join(emsdkRoot, ".emscripten"), EMSDK: emsdkRoot });
	const bytes = await readFile(join(directory, "observer.so"));
	return { bytes
		, identity: { sourceSha256: sha256(source), binarySha256: sha256(bytes)
			, runtimeIdentity: runtime.identity, testOnly: true } };
};
