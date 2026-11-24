/** @file Prepare independent, compiler-readable Depot or Peer sources for WIT lease checks. */
import { appendFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";

/**
 * Make an ordinary or explicitly reviewed source package using the shared Lean definition.
 *
 * @param project - New directory owned by this test.
 * @param module - Depot creates and observes Tickets; Peer mutates them independently.
 * @param review - Optional complete prior binding IR.
 * @param changed - Change the defining module without changing its public field layout.
 * @param retained - Add Peer tasks that borrow a Ticket while calling the host.
 */
export const writeWitLeaseProject=async (project,module,review=null,changed=false,retained=false)=>{
	if(!["Depot","Peer"].includes(module)) throw new Error("Unknown WIT lease fixture");
	const depot=module==="Depot",name=module.toLowerCase();
	const fixture=resolve("tests/fixtures/javascript-wasm-resource-tasks");
	await mkdir(project,{recursive: true});
	for(const file of ["lean-toolchain","Shared.lean",module+".lean"])
		await cp(join(fixture,file),join(project,file),{force: false,errorOnExist: true});
	if(depot) await appendFile(join(project,"Depot.lean"),"\n"+await readFile(resolve("tests/fixtures/wit-task-package/lease-jobs.lean"),"utf8"));
	if(retained && !depot) await appendFile(join(project,"Peer.lean"),"\n"+await readFile(resolve("tests/fixtures/wit-task-package/retained-lease.lean"),"utf8"));
	if(changed) await appendFile(join(project,"Shared.lean"),"\n-- Independent rebuild of a changed nominal source.\n");
	await writeFile(join(project,"lakefile.toml"),`name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Shared"\n[[lean_lib]]\nname = "${module}"\n`);
	const settings={name,version: "1.0.0"};
	const cfg={schemaVersion: 1,modules: [module]
		, resources: depot?["Shared.Badge","Shared.Ticket"]:["Shared.Ticket"]
		, taskExports: depot?["Depot.checked","Depot.issue","Depot.tag","Depot.view"]:["Peer.bump"]
		, ...depot?{asyncIterators: [{open: "Depot.stream",next: "Depot.next",close: "Depot.close"}]}:{}
		, targets: {"wit-wasi": settings}};
	if(retained && !depot) {
		cfg.taskExports.push("Peer.drive","Peer.inspect");
		cfg.taskIOErrors=["Peer.drive","Peer.inspect"];
	}
	await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
	if(review) await writeFile(join(project,"public.binding-ir.json"),canonicalJson(review));
	return settings;
};
