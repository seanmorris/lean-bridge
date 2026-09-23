/**
 * Independent recursive Python conversion fixtures and isolated interpreters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";

/** Optional and result recursive records independently exercise pointer edges. */
export const pythonConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), template = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const root = { kind: "named", id: `lean:Recursive.${name}` };
		ir.types.push({ ...template, id: root.id, name
			, fields: [{ ...template.fields[0], name: "next"
				, type: { kind: "apply", constructor, arguments: [root, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] } }] });
		const fn = ir.declarations[0];
		ir.declarations.push({
			...structuredClone(fn)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`
			, overloadKey: `echo${name}`
			, parameters: [{ ...fn.parameters[0], type: root }]
			, result: { ...fn.result, type: root } });
	}
	return ir;
};

/** Public names must not shadow private conversion helpers. */
export const pythonBuiltinNamesIr = () => {
	const ir = pythonConversionIr();
	for(const [before, after] of [["Spine", "id"], ["Scalars", "UnicodeDecodeError"], ["EmptyRecord", "hasattr"], ["Link", "scope"], ["ResultLink", "value"]])
		ir.types.find(type => type.name === before).name = after;
	return ir;
};

/**
 * Generate separately compiled C and ctypes size, alignment and field probes.
 *
 * @param generated - Checked Python graph conversion model.
 */
export const pythonGraphLayouts = generated => {
	const raw = new Map(generated.rawTypes.map(node => [node.id, node])), c = [], python = [];
	for(const node of generated.layout.nodes)
	{
		const type = raw.get(node.id);
		c.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		python.push(`_c.sizeof(${type.name})`, `_c.alignment(${type.name})`);
		if(!node.aggregate) continue;
		const fields = [["_bridge_owner", "owner"], ["_bridge_release", "release"]];
		if(node.kind === "primitive" || node.element) fields.push(["data", "data"], ["length", "length"]);
		if(node.ref.name === "int") fields.push(["negative", "negative"]);
		if(node.kind === "variant") fields.push(["kind", "kind"], ["cases", "cases"]);
		if(node.kind === "option") fields.push(["has_value", "has_value"]);
		if(node.kind === "result") fields.push(["is_ok", "is_ok"]);
		for(const [j, field] of node.fields.entries()) fields.push([field.name, `field${j}`]);
		for(const [native, host] of fields)
		{
			c.push(`offsetof(${node.name}, ${native})`);
			python.push(`${type.name}.${host}.offset`);
		}
		for(const [j, branch] of node.cases.entries()) for(const [k, field] of branch.fields.entries())
		{
			c.push(`offsetof(${node.name}, cases.${branch.name}.${field.name})`);
			python.push(`${type.name}.cases.offset + _Case${type.index}_${j}.field${k}.offset`);
		}
	}
	return { count: c.length
		, c: `static const size_t layout[] = {${c.join(", ")}};\nsize_t graph_fixture_layout_count(void) { return sizeof(layout)/sizeof(*layout); }\nsize_t graph_fixture_layout(size_t index) { return layout[index]; }\n`
		, python: `_layout_values = [${python.join(", ")}]\n` };
};

/**
 * Build a private test module, without enabling the installed wheel backend.
 *
 * @param generated - Checked Python graph conversion model.
 */
export const pythonGraphProbeModule = generated => {
	const raw = new Map(generated.rawTypes.map(node => [node.id, node]));
	const types = generated.types.map(node => {
		const name = node.ref.kind === "named" ? node.publicType : node.kind === "primitive" ? node.ref.name : node.id;
		return `    ${JSON.stringify(name)}: (_graph_input${node.index}, _graph_output${node.index}, ${raw.get(node.id).name}),`;
	});
	const roots = generated.layout.roots.map(fn => `    ${JSON.stringify(fn.name.slice(generated.layout.prefix.length + 1))}: ([${fn.parameters.map(id => raw.get(id).name).join(", ")}], ${raw.get(fn.result).name}),`);
	return `${generated.valuesSource}\nclass LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
\n${generated.source}\n_types = {\n${types.join("\n")}\n}\n_roots = {\n${roots.join("\n")}\n}\n${pythonGraphLayouts(generated).python}`;
};

/**
 * Fresh supported Python environments, including the minimum typing backport.
 *
 * @param root - Test-owned temporary directory.
 */
export const pythonGraphInterpreters = async root => {
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const results = [];
	for(const [name, interpreter, typing] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const directory = join(root, name), command = join(directory, "venv/bin/python");
		await saveLakeFile(directory, ".fixture", "isolated copied graph probe\n");
		await runCopied(interpreter, ["-I", "-m", "venv", join(directory, "venv")], directory);
		if(typing)
		{
			const wheel = resolve(process.env.LEAN_BRIDGE_PYTHON_TYPING_WHEELS ?? "build/python-typing-wheels", typing, `typing_extensions-${typing}-py3-none-any.whl`);
			assert.equal(sha256(await readFile(wheel)), pythonTypingWheels[typing]);
			await runCopied(command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-cache-dir", "--no-compile", wheel], directory);
		}
		const site = (await runCopied(command, ["-I", "-c", 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], directory)).stdout.trim();
		assert.ok(site.startsWith(`${directory}/venv/`));
		results.push({ name, command, directory, site, typing });
	}
	return results;
};
