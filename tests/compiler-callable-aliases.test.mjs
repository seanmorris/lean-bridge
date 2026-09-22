/**
 * Copied alias preservation must not turn existing callables into copied values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("both compiler profiles retain callable ownership through checked alias chains", { skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1", timeout: 180_000 }, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-callable-aliases-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = (await processBuildRunner.capture({ command: join(root, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: root })).stdout.trim();
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const capture = args => processBuildRunner.capture({ command: lean, args
		, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` } });
	const source = ["namespace CallableAliases", "abbrev Word := UInt32"
		, "abbrev Unary := Word → Word", "abbrev Again := Unary"
		, "def echo (value : Again) : Again := value"
		, "def apply (callback : Again) (value : Word) : Word := callback value"
		, "abbrev Hidden := Array Again"
		, "def nested (value : Hidden) : Hidden := value"
		, "structure Bad where", "  callback : Again"
		, "def record (value : Bad) : Bad := value", "abbrev A0 := UInt32"
		, "structure Box where", "  label : String", "  value : UInt32"
		, "abbrev BoxAlias := Box", "abbrev BoxChain := BoxAlias"
		, "def echoBox (value : BoxChain) : BoxChain := value"
		, "def hiddenBoxes (value : Array BoxChain) : Array BoxChain := value"
		, ...Array.from({ length: 33 }, (_, i) => `abbrev A${i + 1} := A${i}`)
		, "abbrev LongUnary := A33 → UInt32"
		, "def deep (value : LongUnary) : LongUnary := value"
		, `abbrev DeepCopied := ${"Array (".repeat(33)}UInt32${")".repeat(33)}`
		, "def copiedDepth (value : DeepCopied) : DeepCopied := value"
		, "end CallableAliases"].join("\n");
	await saveLakeFile(directory, "CallableAliases.lean", source);
	await capture(["-o", "CallableAliases.olean", "CallableAliases.lean"]);
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, modules: [{ name: "CallableAliases", sourcePath: "CallableAliases.lean"
			, sourceSha256: sha256(source)
			, interfaceSha256: (await identifyLeanInterface(join(directory, "CallableAliases.olean"))).interfaceSha256 }] };
	const identities = [];
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const request = createMetadataRequest({ profile
			, modules: ["CallableAliases"], exportModules: ["CallableAliases"]
			, exports: ["echo", "apply", "nested", "record", "deep", "copiedDepth"].map(name => `CallableAliases.${name}`)
			, resources: []
			, arities: [["CallableAliases.echo", 1], ["CallableAliases.deep", 1]] }, context);
		await saveLakeFile(directory, "request.json", canonicalJson(request));
		const metadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
		validateElaboratedMetadata(metadata, request);
		const declarations = metadata.modules[0].declarations;
		for(const name of ["echo", "apply", "deep"])
		{
			const item = declarations.find(item => item.identity === `CallableAliases.${name}`);
			assert.equal(item.projection.status, "supported", canonicalJson(item.projection));
			const callback = item.projection.parameters[0].type;
			assert.equal(callback.kind, "callback");
			assert.equal(callback.parameters[0].kind, "primitive");
			assert.equal(callback.parameters[0].name, "uint32");
			assert.equal(callback.result.kind, "primitive");
			if(name !== "apply") assert.deepEqual(item.projection.result, callback);
		}
		for(const name of ["nested", "record", "copiedDepth"])
			assert.equal(declarations.find(item => item.identity === `CallableAliases.${name}`).projection.status, "unsupported", `${profile}/${name}`);
		const ir = createElaboratedSemanticModel({ metadata, request
			, component: { id: "callable-aliases@1.0.0", name: "callable-aliases", version: "1.0.0" }
			, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
		const echo = ir.declarations.find(item => item.name === "echo");
		assert.equal(echo.parameters[0].ownership, "borrow");
		assert.equal(echo.result.ownership, "lease");
		const deep = ir.declarations.find(item => item.name === "deep");
		assert.equal(deep.parameters[0].ownership, "borrow");
		assert.equal(deep.result.ownership, "lease");
		identities.push(sourceApiIdentity(ir).sha256);
	}
	assert.equal(identities[0], identities[1]);
	const resourceRequest = createMetadataRequest({ profile: "native-library-v1"
		, modules: ["CallableAliases"], exportModules: ["CallableAliases"]
		, exports: ["CallableAliases.echoBox", "CallableAliases.hiddenBoxes"]
		, resources: ["CallableAliases.Box"], arities: [] }, context);
	await saveLakeFile(directory, "request.json", canonicalJson(resourceRequest));
	const resourceMetadata = JSON.parse((await capture(["--run", extractor, "--metadata", "request.json"])).stdout);
	validateElaboratedMetadata(resourceMetadata, resourceRequest);
	const declarations = resourceMetadata.modules[0].declarations;
	const box = declarations.find(item => item.identity === "CallableAliases.echoBox").projection;
	assert.equal(box.status, "supported", canonicalJson(box));
	assert.equal(box.parameters[0].type.kind, "resource");
	assert.equal(box.result.kind, "resource");
	assert.equal(box.result.name, "CallableAliases.Box");
	assert.equal(declarations.find(item => item.identity === "CallableAliases.hiddenBoxes").projection.status, "unsupported");
});
