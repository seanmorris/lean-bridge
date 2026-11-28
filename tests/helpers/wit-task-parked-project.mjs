/** @file Add a gated Lean worker and its completion witness to the Depot package. */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { writeWitLeaseProject } from "./wit-task-lease-project.mjs";

/**
 * Prepare the lifetime test's independent ordinary or reviewed application.
 *
 * @param project - Test-owned source directory.
 * @param review - Reviewed public IR when rebuilding the same declarations.
 */
export const writeWitParkedProject=async (project,review)=>{
	await writeWitLeaseProject(project,"Depot",review);
	const config=join(project,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(config));
	cfg.taskExports.push("Depot.combined","Depot.parked","Depot.unlock","Depot.witness");
	await appendFile(join(project,"Depot.lean"),"\n"+await readFile(resolve("tests/fixtures/wit-task-package/parked-leases.lean"),"utf8"));
	await writeFile(config,canonicalJson(cfg));
};
