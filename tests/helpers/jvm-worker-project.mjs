/** @file Stage the application and a real nominal JVM worker contract for the Maven publisher. */
import { appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

/**
 * Create independent author source in a private test directory.
 *
 * @param project - Destination for the Lean source and author selections.
 */
export const prepareJvmWorkerProject = async project => {
	await prepareNativeHostFixture(project, "jvm");
	await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
	await copyFile(resolve("tests/fixtures/jvm-host-workers/Jobs.lean"), join(project, "Jobs.lean"));
	await appendFile(join(project, "lakefile.toml"), '\n[[lean_lib]]\nname = "Jobs"\n');
	const file = join(project, "lean-bridge.exports.json"), cfg = JSON.parse(await readFile(file));
	cfg.modules.push("Jobs");
	cfg.taskExports = ["echo", "scalar", "relay", "recover", "refuse", "outcome"].map(n => "Jobs." + n);
	cfg.taskIOErrors = ["Jobs.relay", "Jobs.recover"];
	cfg.asyncIterators = [{open: "Jobs.boxes", next: "Jobs.next", close: "Jobs.close"}
		, {open: "Jobs.ioBoxes", next: "Jobs.ioNext", close: "Jobs.ioClose"}];
	cfg.exports.push(...cfg.taskExports, ...cfg.asyncIterators.map(p => p.open));
	await writeFile(file, canonicalJson(cfg));
	return cfg;
};
