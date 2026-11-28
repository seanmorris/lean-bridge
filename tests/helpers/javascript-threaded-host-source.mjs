/** @file Materialize the same authored Lake project for analyzer and installed runtime tests. */
import {copyFile,cp,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";

/**
 * Reuse the synchronous owner's contract and add the cursor's setter capability.
 *
 * @param project - Fresh author root.
 * @param fixture - Authored Lean source and export decisions to use with the shared class contract.
 */
export const prepareThreadedHostProject=async (project,fixture="javascript-threaded-host")=>{
	await cp(resolve("tests/fixtures/javascript-host-meter"),project,{recursive: true});
	await copyFile(resolve("tests/fixtures",fixture,"Workshop.lean"),join(project,"Workshop.lean"));
	const hostFile=join(project,"lean-bridge.hosts.json"),hosts=JSON.parse(await readFile(hostFile));
	const capability={id: "capability:meter.write",category: "runtime",requirement: "required",documentation: {summary: "Update a meter.",details: ""}};
	hosts.capabilities.push(capability);
	hosts.declarations.find(d=>d.kind==="property" && d.parameters.length).capabilities.push(capability.id);
	await writeFile(hostFile,canonicalJson(hosts));
	const name="lean-bridge.exports.json";
	await copyFile(resolve("tests/fixtures",fixture,name),join(project,name));
	const config=JSON.parse(await readFile(join(project,name)));
	return {config,capability};
};
