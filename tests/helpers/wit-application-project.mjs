/** @file Exercise WIT member ownership and copied carriers in an actual Lake application. */
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";

/**
 * Reuse the scalar source corpus, then add a consumed parameter, an anchored
 * result, and a Lean function that selects the first of two guest errors.
 *
 * @param project - Staged WIT worker project.
 */
export const extendWitApplication = async project => {
	const corpus=resolve("tests/fixtures/cpp-host-workshop");
	const imports=JSON.parse(await readFile(join(corpus,"lean-bridge.hosts.json"),"utf8"));
	imports.types[0].host.targets=["wit-wasi"];
	const make=imports.declarations.find(m=>m.kind==="constructor");
	const echo=imports.declarations.find(m=>m.name==="identity");
	for(const name of ["keepOther","takeOther","anchored"])
	{
		const m=structuredClone(echo);
		m.name=name; m.id="host:meter.Box."+name; m.overloadKey=m.source.declaration="Box."+name;
		if(name==="anchored") m.result={...m.result,ownership: "borrow",lifetime: {scope: "receiver",anchor: "receiver"}};
		else m.parameters=[{...make.parameters[0],type: m.result.type,ownership: name==="takeOther"?"transfer":"lease",lifetime: {scope: "explicit",anchor: null}}];
		imports.declarations.push(m);
	}
	await writeFile(join(project,"lean-bridge.hosts.json"),canonicalJson(imports));
	const source=(await readFile(join(corpus,"Workshop.lean"),"utf8")).replaceAll("LeanBridge.Host.Cpp","LeanBridge.Host.WitWasi");
	const extra=await readFile("tests/fixtures/static-host-workers/wit-members.lean.in","utf8");
	await writeFile(join(project,"Workshop.lean"),source+"\n"+extra);
	const path=join(project,"lean-bridge.exports.json"),config=JSON.parse(await readFile(path,"utf8"));
	config.exports.push(...["readOnline","text","bytes","shift","natural","keepOther","takeOther","anchored","firstError","pickWide"].map(n=>"Workshop."+n));
	const jobs=join(project,"Jobs.lean");
	await writeFile(jobs,(await readFile(jobs,"utf8"))+"\n"+await readFile("tests/fixtures/static-host-workers/wit-success.lean.in","utf8"));
	const success=["Jobs.accept","Jobs.completed","Jobs.relayLate"];
	config.taskIOErrors.push("Jobs.relayLate");
	config.taskExports.push(...success);config.exports.push(...success);
	config.asyncIterators.push({open: "Jobs.finite",next: "Jobs.nextFinite",close: "Jobs.closeFinite"});
	config.exports.push("Jobs.finite","Jobs.cursorCounts","Jobs.cursorGate");
	await writeFile(path,canonicalJson(config));
};
