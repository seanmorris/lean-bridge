/** @file Prepare a normal Lean package with both bound CLR methods and real worker exports. */
import { appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

/**
 * Stage the authored host contract, application code and public selection.
 *
 * @param project - New author directory inside the caller's private workspace.
 */
export const prepareDotnetWorkerProject = async project => {
	await prepareNativeHostFixture(project,"dotnet");
	await copyFile(resolve("LICENSE"),join(project,"LICENSE"));
	await copyFile(resolve("tests/fixtures/dotnet-host-workers/Workers.lean"),join(project,"Workers.lean"));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Workers"\n');
	const file=join(project,"lean-bridge.exports.json"), config=JSON.parse(await readFile(file,"utf8"));
	const names=xs=>xs.map(s=>"Workers."+s);
	config.modules.push("Workers");
	config.taskExports=names(["echo","scalar","relay","recover","outcome","reject"]);
	config.taskIOErrors=names(["relay","recover"]);
	config.asyncIterators=["","IO"].map(s=>({open: "Workers.series"+s,next: "Workers.next"+s,close: "Workers.close"+s}));
	config.exports.push(...config.taskExports,...config.asyncIterators.map(p=>p.open),...names(["identityNow","identityBase"]));
	await writeFile(file,canonicalJson(config));
	return config;
};
