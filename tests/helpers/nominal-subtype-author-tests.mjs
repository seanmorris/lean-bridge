/**
 * Check native author examples against the documented source and current compiler.
 * Compiler checks do not establish installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compilerExportSelection, validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { projectionCheckedSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const example = async () => {
	const guide = await readFile("docs/lean/export-decisions.md", "utf8");
	const section = guide.split("### Select constructors in native records\n")[1].split("## Check each consumer representation")[0];
	return { section, source: section.match(/```lean\n([^]*?)\n```/u)[1] + "\n"
		, configuration: JSON.parse(section.match(/```json\n([^]*?)\n```/u)[1]) };
};

test("nominal Subtype author guides distinguish compilation, installed support and result direction", async () => {
	const author = await readFile("docs/lean/existing-package.md", "utf8"), { section } = await example();
	assert.doesNotMatch(author, /For a top-level `Subtype` parameter or result, provide|Name that constructor at every refined boundary site|Nominal-field and refined callback Subtypes remain unsupported/u);
	for(const text of ["Copied results do not need an input constructor"
		, "Browser, other native hosts and PHP-Wasm installed acceptance for these additions remains pending"
		, "nominal-subtype-npm-acceptance-20261011.md"
		, "shared component compiler no longer requires a result constructor selection"
		, "its constructor-selection syntax does not accept a null constructor"
		, "nominal-subtype-native-20261011.md", "subtype-result-20261011.md"
		, "component-nominal-subtype-20261011.md"])
		assert.ok(author.includes(text), text);
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row);
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 2);
		assert.ok(row.includes("Node installed; browser pending"));
		assert.ok(row.includes("Node and C/C++ ordinary/reviewed installed"));
	}
	assert.ok(section.includes("`NominalSubtypes.lean`"));
	assert.ok(section.includes("`lean-bridge.exports.json`"));
	assert.ok(section.includes("Only the active case runs its constructors"));
	assert.ok(section.includes("nominal-subtype-native-acceptance-20261011.md"));
	assert.ok(section.includes("Other native hosts and PHP-Wasm nominal acceptance remains pending"));
});

test("the native nominal author configuration selects only the input and preserves its Fin sibling", async () => {
	const { configuration } = await example();
	validateExportConfiguration(configuration);
	await assertJsonSchema("lean-export-configuration", configuration);
	assert.deepEqual(configuration.targets, { c: { name: "nominal-subtypes", version: "1.0.0" } });
	assert.deepEqual(configuration.exports, ["NominalSubtypes.echoPacket", "NominalSubtypes.producePacket"]);
	const selection = compilerExportSelection(configuration), contract = selection.contracts["NominalSubtypes.echoPacket"];
	assert.deepEqual(contract.parameters[0].refinement, {
		kind: "record", name: "NominalSubtypes.Packet"
		, fields: [{ name: "count", refinement: { constructor: "NominalSubtypes.checkedPositive" } }, { name: "digit", refinement: null }]
	});
	assert.deepEqual(contract.result, { ownership: "copy", lifetime: null });
	assert.equal(selection.contracts["NominalSubtypes.producePacket"], undefined);
	const invalid = structuredClone(configuration);
	invalid.contracts["NominalSubtypes.echoPacket"].result.refinement = { constructor: null };
	assert.throws(() => validateExportConfiguration(invalid), { code: "invalid-export-configuration" });
});

const enabled = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_AUTHOR_TEST === "1"
	|| process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_TEST === "1"
	|| (process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",") ?? []).includes("c");

test("fresh Lean compiles the exact native nominal author example and its generated checks", { skip: !enabled, timeout: 600_000 }, async t => {
	const { source, configuration } = await example();
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-author-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed author-example artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_AUTHOR_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean"), commands = [];
	const environment = { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const run = async args => {
		try
		{
			const result = await promisify(execFile)(lean, args, { cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024, signal: t.signal });
			commands.push({ command: "lean", arguments: args.map(value => value === extractor ? "src/analyze/NativeExports.lean" : value), ...result });
			return result;
		}
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	await writeFile(join(directory, "NominalSubtypes.lean"), source);
	assert.deepEqual(await run(["-o", "NominalSubtypes.olean", "NominalSubtypes.lean"]), { stdout: "", stderr: "" });
	const identity = await identifyLeanInterface(join(directory, "NominalSubtypes.olean"));
	const olean = await readFile(join(directory, "NominalSubtypes.olean"));
	const context = {
		toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [{ name: "NominalSubtypes", sourcePath: "NominalSubtypes.lean", sourceSha256: sha256(source), interfaceSha256: identity.interfaceSha256 }]
	};
	const request = createMetadataRequest({
		profile: "native-library-v1", modules: configuration.modules
		, exportModules: configuration.modules, resources: [], arities: []
		, exports: configuration.exports
		, ...compilerExportSelection(configuration)
	}, context);
	const requestPath = join(directory, "request.json");
	await writeFile(requestPath, canonicalJson(request));
	const extracted = await run(["--run", extractor, "--metadata", requestPath]);
	assert.equal(extracted.stderr, "");
	const report = JSON.parse(extracted.stdout);
	await assertJsonSchema("elaborated-export-metadata", report);
	validateElaboratedMetadata(report, request);
	const declarations = report.modules.flatMap(module => module.declarations.filter(item => item.selected));
	assert.equal(declarations.length, 2);
	for(const item of declarations)
	{
		assert.equal(item.projection.status, "supported", item.identity);
		assert.equal(projectionCheckedSelection(item.projection.result), null);
	}
	const version = await run(["--version"]), leanCommit = /commit ([a-f0-9]{40})/u.exec(version.stdout)?.[1];
	assert.ok(leanCommit);
	const modules = [{
		module: "NominalSubtypes"
		, source: { path: "NominalSubtypes.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) }
		, interface: { bytes: olean.length, sha256: sha256(olean), interfaceSha256: identity.interfaceSha256 } }];
	const configurationSource = canonicalJson(configuration);
	const sourceIdentity = {
		leanVersion: "4.32.2", leanCommit
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, sourceTreeSha256: sha256(canonicalJson(modules)), modules, request
		, exportConfigurationSource: configurationSource
		, exportConfigurationSha256: sha256(configurationSource)
	};
	const model = createNativeModel({ metadata: report, sourceIdentity, component: { id: "nominal-subtypes@1.0.0", ...configuration.targets.c } }, { refinements: true });
	const generated = generateNativeLeanAdapters(model);
	const call = name => `${generated.module}.f_${model.exports.find(item => item.name === `NominalSubtypes.${name}`).symbol}`;
	const checks = [
		`example : ((${call("echoPacket")} ⟨4, 2⟩).map fun value => value.count) = some 4 := by decide`
		, `example : ((${call("echoPacket")} ⟨4, 2⟩).map fun value => value.digit) = some 2 := by decide`
		, `example : (${call("echoPacket")} ⟨0, 2⟩).isNone = true := by decide`
		, `example : (${call("echoPacket")} ⟨4, 3⟩).isNone = true := by decide`
		, `example : (${call("producePacket")} 120).count = 121 := by decide`
		, `example : (${call("producePacket")} 120).digit = 2 := by decide`
	];
	const adapter = generated.leanSource + "\n" + checks.join("\n") + "\n";
	await writeFile(join(directory, "AuthorAdapters.lean"), adapter);
	assert.deepEqual(await run(["AuthorAdapters.lean"]), { stdout: "", stderr: "" });
	if(reports) for(const [name, value] of [
		["NominalSubtypes.lean", source]
		, ["lean-bridge.exports.json", configurationSource]
		, ["request.json", canonicalJson(request)]
		, ["metadata.json", extracted.stdout], ["AuthorAdapters.lean", adapter]
		, ["report.json", canonicalJson({ schemaVersion: 1, context, commands, leanAssertions: checks.length, installedSupport: false })]
	]) await writeFile(join(reports, name), value, { flag: "wx" });
	complete = true;
});
