/**
 * Authorize owned JavaScript outputs from captured source, before compilation.
 *
 * @file
 */
import { join } from "node:path";
import { captureSourceNotices } from "../release/source-notices.mjs";
import { readLakeGeneratorRecipes } from "./lake-generator-prerequisites.mjs";
import { javascriptWasmTargetHeaders } from "./javascript-wasm-toolchain.mjs";

/**
 * Derive the complete output set without trusting compiler-produced inventories.
 * Notice payload names come from captured source hashes, not engine output.
 *
 * @param options - Independently checked source-only request inputs.
 * @param options.intent - Reconstructed owned JavaScript source intent.
 * @param options.inputRoot - Read-only input mount containing the Lake capture.
 * @param options.signal - Optional cancellation signal.
 */
export const ownedJavaScriptOutputContract = async ({ intent, inputRoot, signal }) => {
	const snapshotRoot = join(inputRoot, "lake");
	const notices = await captureSourceNotices({ projectRoot: join(snapshotRoot, "root")
		, projectName: intent.document.component.name
		, inputs: intent.document.source.inputs
		, sourceTreeSha256: intent.document.source.treeSha256
		, snapshot: intent.lakeSnapshot, snapshotRoot });
	const generators = (await readLakeGeneratorRecipes({ snapshot: intent.lakeSnapshot, snapshotRoot, signal })).recipes.length > 0;
	const files = ["artifacts.json", "binding-ir.json", "component.h"
		, "generated.lean", "metadata.json", "model.json"
		, "javascript-wasm-component.json", "private-abi.json"
		, "lib/component.so.wasm", "compiler/notices/lean.txt"
		, ...javascriptWasmTargetHeaders.map(name => `compiler/include/lean/${name}`)
		, "owned/carriers.h", "owned/owned-values.h", "owned/owned-values-codec.h"
		, "owned/owned-leases.h", "owned/owned-js-layout.h"
		, "owned/lean_bridge_native_runtime.h"
		, "owned/callbacks.c", "owned/allocation-guard.h", "owned/component.c"
		, ...notices.files.keys()
		, ...(generators ? ["lake-generated-sources.json"] : [])].sort();
	return { files, notices };
};
