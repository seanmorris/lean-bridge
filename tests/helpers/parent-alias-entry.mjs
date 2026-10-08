/**
 * A test-only Lean entry built from the shipped extractor: the same index and resolver, run with a
 * chosen work limit, recording the request-wide discovery counters to a separate file. Normal
 * metadata never carries these counters, and no shipped CLI mode exposes them.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

const productionMain = "unsafe def main (args : List String) : IO UInt32 := do";
// The production main loads these indexes only when a request selects specializations.
const productionIndexes = ["LeanBridge.NativeExports.loadBuiltinIndex classExtension env", "LeanBridge.NativeExports.loadBuiltinIndex instanceExtension.ext env"];
const testMain = `
unsafe def main (args : List String) : IO UInt32 := do
  match args with
  | ["--metadata", path, limit, counters] =>
    let json ← IO.ofExcept <| Json.parse (← IO.FS.readFile path)
    let request ← IO.ofExcept <| fromJson? (α := LeanBridge.NativeExports.Request) json
    initSearchPath (← findSysroot)
    let mut env ← importModules (request.modules.map fun name => { module := name.toName }) {} 0
    -- The same built-in class and instance indexes production loads for specializations.
    if !(request.specializations.getD #[]).isEmpty then
      env ← LeanBridge.NativeExports.loadBuiltinIndex classExtension env
      env ← LeanBridge.NativeExports.loadBuiltinIndex instanceExtension.ext env
    let cache ← IO.mkRef ({ limit := limit.toNat! } : LeanBridge.NativeExports.ParentAliasCache)
    let record : IO Unit := do
      let state ← cache.get
      IO.FS.writeFile counters (Json.compress <| Json.mkObj [("attempts", toJson state.attempts), ("builds", toJson state.builds), ("scanned", toJson state.scanned),
        ("probes", toJson state.probes), ("hits", toJson state.hits), ("exhausted", toJson state.exhausted)])
    try
      let (metadata, _, _) ← (LeanBridge.NativeExports.extractMetadata request (some cache)).toIO
        { fileName := "<parent-alias-test>", fileMap := default } { env }
      record
      IO.println metadata.compress
      return 0
    catch error =>
      record
      throw error
  | _ => productionMain args
`;

/**
 * Write the test entry beside a scratch directory and return a runner that sends only the
 * extractor's metadata command to it.
 *
 * @param directory - Scratch directory for the entry and the counter file.
 * @param limit - Declarations the alias index may scan.
 */
export const parentAliasRunner = async (directory, limit) => {
	const source = await readFile("src/analyze/NativeExports.lean", "utf8");
	if(source.split(productionMain).length !== 2 || !productionIndexes.every(line => source.split(productionMain)[1].includes(line)))
		throw new Error("the extractor entry changed; update the test entry");
	const entry = join(directory, "ParentAliasEntry.lean"), counters = join(directory, "parent-alias-counters.json");
	await writeFile(entry, `${source.replace(productionMain, "unsafe def productionMain (args : List String) : IO UInt32 := do")}\n${testMain}`);
	const runner = { capture: command => {
		const [run, extractor, flag, request] = command.args ?? [];
		if(run === "--run" && extractor?.endsWith("src/analyze/NativeExports.lean") && flag === "--metadata")
			return processBuildRunner.capture({ ...command, args: ["--run", entry, "--metadata", request, String(limit), counters] });
		return processBuildRunner.capture(command);
	} };
	return { runner, counters: async () => JSON.parse(await readFile(counters, "utf8")) };
};
