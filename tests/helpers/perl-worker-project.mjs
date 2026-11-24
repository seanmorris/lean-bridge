/** @file Stage a CPAN author project with live application objects in actual Lean workers. */
import { appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

/**
 * Preserve the ordinary synchronous host methods beside the tasks and cursors.
 *
 * @param project - Isolated author directory.
 * @param peer - Compile an independent package with a distinguishable scalar result.
 */
export const preparePerlWorkerProject = async (project,peer=false) => {
	await prepareNativeHostFixture(project,"perl");
	const file=join(project,"lean-bridge.exports.json"), cfg=JSON.parse(await readFile(file));
	const module=peer?"PeerJobs":"Jobs", jobs=join(project,module+".lean"), lake=join(project,"lakefile.toml");
	await copyFile(resolve("tests/fixtures/perl-host-workers/Jobs.lean"),jobs);
	await appendFile(lake,'\n[[lean_lib]]\nname = "'+module+'"\n');
	if(peer)
	{
		cfg.targets.cpan.module="LeanBridge::Peer";
		await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop-peer"'));
		await writeFile(jobs,(await readFile(jobs,"utf8")).replaceAll("namespace Jobs","namespace PeerJobs")
			.replaceAll("end Jobs","end PeerJobs").replace("Task.pure (n + 1)","Task.pure (n + 37)"));
	}
	cfg.modules.push(module);
	const op=n=>module+"."+n;
	cfg.taskExports=["echo","scalar","relay","recover","refuse","outcome"].map(op);
	cfg.taskIOErrors=["relay","recover"].map(op);
	cfg.asyncIterators=[{open: op("boxes"),next: op("next"),close: op("close")}
		, {open: op("ioBoxes"),next: op("ioNext"),close: op("ioClose")}];
	cfg.exports.push(...cfg.taskExports,...cfg.asyncIterators.map(p=>p.open));
	await writeFile(file,canonicalJson(cfg));
	return cfg;
};
