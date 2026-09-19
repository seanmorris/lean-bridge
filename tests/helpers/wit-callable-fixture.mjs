/**
 * Component Model probes use synthetic native imports, not installed Lean code.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { callableSignatures } from "./callable-fixture.mjs";

export const witCallableSignatures = [...callableSignatures
	, { name: "Callables.wide", parameters: ["uint32", { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } }], result: "uint32" }
	, { name: "Callables.makeWide", parameters: ["uint32"], result: { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } } }
	, { name: "Callables.mixed", parameters: ["uint8", "string", "uint64", "float64", "int", "nat", "bytes", "usize", "uint32", "string", ...Array.from({ length: 2 }, () => ({ callback: { parameters: ["uint32"], result: "uint32" } }))], result: "uint32" }];

/**
 * Bind independent C ownership probes to generated interface names and tags.
 *
 * @param model - Staged callable projection.
 */
export const witCallableComponentProbe = async model => {
	const tag = ref => model.resources.findIndex(resource => resource.type.id === ref.id) + 1;
	const functions = model.functions.map(fn => {
		let op, resource;
		if(fn.resource)
		{ op = "INVOKE"; resource = tag(fn.resource.type); }
		else
		{
			const name = fn.declaration.name;
			op = name === "wordBits" ? "BITS" : name === "mixed" ? "MIXED" : name === "wide" ? "WIDE" : name === "makeWide" ? "MAKE_WIDE" : name.startsWith("make") ? "MAKE" : name.startsWith("twice") ? "TWICE" : "CALL";
			resource = tag(op === "MAKE" || op === "MAKE_WIDE" ? fn.declaration.result.type : fn.declaration.parameters.at(-1)?.type ?? {});
		}
		return `  {"${fn.witName}", ${op}, ${resource}, ${fn.parameters.length}}`;
	});
	const source = await readFile(new URL("../fixtures/callable-consumers/wit-component.c", import.meta.url), "utf8");
	return source.replace("/* INTERFACES */", `#define IMPORT_NAME "${model.importName}"\n#define EXPORT_NAME "${model.exportName}"`)
		.replace("/* RESOURCES */", model.resources.map(resource => `  {"${resource.witName}", ${resource.type.callable.parameters.length}}`).join(",\n"))
		.replace("/* FUNCTIONS */", functions.join(",\n"));
};
