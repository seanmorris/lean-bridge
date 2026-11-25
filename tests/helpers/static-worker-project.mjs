/** @file Stage the same authored worker package for each static native host. */
import { appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

export const staticOwners = { c: ["C","c","CCallbackError"], cpp: ["Cpp","cpp","CppCallbackException"], rust: ["Rust","cargo","RustCallbackError"] };

/**
 * Prepare real task, cursor and mixed synchronous declarations in one Lake project.
 *
 * @param project - New project directory.
 * @param owner - Language whose generated members the Lean source imports.
 */
export const prepareStaticWorkerProject = async (project, owner) => {
	const [module]=staticOwners[owner], select=join(project,"lean-bridge.exports.json");
	await prepareNativeHostFixture(project,owner); await copyFile("LICENSE",join(project,"LICENSE"));
	const source=await readFile("tests/fixtures/static-host-workers/Jobs.lean","utf8");
	await writeFile(join(project,"Jobs.lean"),source.replace("LeanBridge.Host.Rust","LeanBridge.Host."+module));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Jobs"\n');
	const cfg=JSON.parse(await readFile(select,"utf8")), declared={open:"Jobs.series",next:"Jobs.next",close:"Jobs.close"};
	cfg.modules.push("Jobs"); cfg.taskExports=["Jobs.echo","Jobs.relay","Jobs.reject","Jobs.outcome"]; cfg.taskIOErrors=["Jobs.relay"];
	cfg.asyncIterators=[declared]; cfg.exports.push(...cfg.taskExports,declared.open);
	const save=()=>writeFile(select,canonicalJson(cfg)); await save();
	return {cfg,declared,save};
};
