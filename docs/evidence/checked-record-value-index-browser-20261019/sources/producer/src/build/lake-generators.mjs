/**
 * Run declared pure Lean text generators against an authenticated source capture.
 *
 * @file
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateLakeDependencySnapshotDocument, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const checker = fileURLToPath(new URL("../analyze/NativeExports.lean", import.meta.url));
const fail = (message, code = "invalid-lake-generator") => { throw Object.assign(new Error(message), { code }); };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const frozen = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(frozen); Object.freeze(value); }
	return value;
};
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const controls = text => [...text].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const name = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]*$(?![\s\S])/.test(value) && value.length <= 128;
const moduleName = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value) && value.length <= 256;
const pathName = value => typeof value === "string" && value.length <= 1024 && !controls(value) && !/[\\:*?]/.test(value)
	&& /^(root|packages\/[^/]+)\//.test(value) && value.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith(".lean-bridge-") && ![".git", ".lake", ".env", ".npmrc"].includes(part));
const closed = (value, keys, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} must have exactly the declared fields`);
};
const snapshotFiles = snapshot => new Map([
	...snapshot.document.rootInputs.map(file => [`root/${file.path}`, file])
	, ...snapshot.document.packages.flatMap(pkg => pkg.files.map(file => [`${pkg.directory}/${file.path}`, file]))
]);
const list = (value, label, minimum = 1) => {
	if(!Array.isArray(value) || value.length < minimum || value.length > 128) fail(`${label} must contain ${minimum} to 128 entries`);
};
const unique = (values, label) => { if(new Set(values).size !== values.length) fail(`Duplicate ${label}`); };
const utf8 = bytes => {
	const text = bytes.toString("utf8");
	if(!Buffer.from(text).equals(bytes)) fail("Generator sources and data must contain valid UTF-8 text");
	return text;
};

/**
 * Check a closed internal generator definition against the complete Lake capture.
 * The eventual Lake prerequisite selector supplies these explicit module paths.
 *
 * @param definition - Pure Lean tool, logical text inputs and exact output paths.
 * @param snapshot - Authenticated source snapshot and expected digest.
 */
export const validateLakeGeneratorDefinition = (definition, snapshot) => {
	validateLakeDependencySnapshotDocument(snapshot.document);
	if(snapshot.document.schemaVersion !== 2 || sha256(canonicalJson(snapshot.document)) !== snapshot.sha256) fail("Generators require a complete authenticated snapshot");
	closed(definition, ["schemaVersion", "profile", "name", "declaration", "modules", "inputs", "arguments", "outputs"], "Generator definition");
	if(definition.schemaVersion !== 1 || definition.profile !== "lean-text-v1" || !name(definition.name) || !moduleName(definition.declaration)) fail("Unsupported generator profile, name or declaration");
	list(definition.modules, "Generator modules");
	list(definition.inputs, "Generator inputs", 0);
	list(definition.arguments, "Generator arguments", 0);
	list(definition.outputs, "Generator outputs");
	if(definition.arguments.some(value => typeof value !== "string" || Buffer.byteLength(value) > 16384 || controls(value) || /[\uD800-\uDFFF]/u.test(value))) fail("Generator arguments must be bounded literal UTF-8 text");
	const files = snapshotFiles(snapshot);
	for(const source of definition.modules)
	{
		closed(source, ["module", "path"], "Generator module");
		if(!moduleName(source.module) || source.module === "LeanBridgeGeneratorMain" || !pathName(source.path) || !source.path.endsWith(".lean") || !files.has(source.path)) fail("Generator module must name a captured Lean source");
	}
	unique(definition.modules.map(source => source.module), "generator module name");
	unique(definition.modules.map(source => source.path), "generator source path");
	for(const input of definition.inputs)
	{
		closed(input, ["name", "path"], "Generator input");
		if(!name(input.name) || !pathName(input.path) || !files.has(input.path)) fail("Generator input must name a captured file");
	}
	unique(definition.inputs.map(input => input.name), "logical input name");
	unique(definition.inputs.map(input => input.path), "input path");
	const roots = ["root/", ...snapshot.document.packages.map(pkg => `${pkg.directory}/`)];
	for(const output of definition.outputs)
	{
		closed(output, ["name", "path"], "Generator output");
		if(!name(output.name) || !pathName(output.path) || !/\.(lean|c|h)$/.test(output.path) || !roots.some(root => output.path.startsWith(root))) fail("Generator outputs must be Lean, C or header files in a captured package");
		if([...files.keys()].some(path => path === output.path || path.startsWith(`${output.path}/`) || output.path.startsWith(`${path}/`))) fail("Generator output collides with a captured input");
	}
	unique(definition.outputs.map(output => output.name), "logical output name");
	unique(definition.outputs.map(output => output.path), "output path");
	if(definition.outputs.some(output => definition.outputs.some(other => other.path.startsWith(`${output.path}/`)))) fail("Generator outputs overlap");
	return true;
};

const fileIdentity = async (path, signal) => {
	signal?.throwIfAborted();
	const before = await lstat(path);
	if(!before.isFile() || await realpath(path) !== path) fail("Generator tool files must be regular files without symlinks");
	const hash = createHash("sha256");
	let bytes = 0;
	for await(const chunk of createReadStream(path, { signal }))
	{ hash.update(chunk); bytes += chunk.length; }
	const after = await lstat(path);
	if(bytes !== before.size || before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail("Generator tool changed while hashing", "lake-generator-drift");
	return { bytes, sha256: hash.digest("hex"), mode: before.mode & 0o111 ? 0o755 : 0o644 };
};

const treeFiles = async (root, signal) => {
	const files = [];
	const visit = async prefix => {
		signal?.throwIfAborted();
		const directory = join(root, prefix), before = await lstat(directory);
		if(!before.isDirectory() || await realpath(directory) !== directory) fail("Generator compiler library directories cannot be symlinked");
		for(const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => compare(left.name, right.name)))
		{
			const path = prefix ? `${prefix}/${entry.name}` : entry.name;
			if(entry.isDirectory()) await visit(path);
			else files.push({ path, ...await fileIdentity(join(root, path), signal) });
		}
		const after = await lstat(directory);
		if(before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail("Generator compiler library inventory changed", "lake-generator-drift");
	};
	await visit("");
	return files.sort((left, right) => compare(left.path, right.path));
};
const libraryIdentity = async (root, signal) => {
	const files = await treeFiles(root, signal);
	return { files: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0), sha256: sha256(canonicalJson(files)) };
};

/**
 * Recheck a recorded generator compiler and its complete library closure.
 *
 * @param options - Selected installation and previously authorized identity.
 * @param options.leanPrefix - Explicit compiler installation.
 * @param options.compiler - Validated compiler identity from a generator receipt.
 * @param options.signal - Optional cancellation signal.
 */
export const verifyLakeGeneratorCompiler = async ({ leanPrefix, compiler, signal }) => {
	const prefix = await realpath(leanPrefix), { version, ...expected } = compiler;
	void version;
	const actual = { ...await fileIdentity(join(prefix, "bin/lean"), signal), libraries: await libraryIdentity(join(prefix, "lib/lean"), signal) };
	if(!same(actual, expected)) fail("Generator compiler or library closure changed", "lake-generator-drift");
};

const driver = definition => `${definition.modules.map(source => `import ${source.module}`).join("\n")}
import Lean.Data.Json

private def generator : Array (String × String) → Array String → Except String (Array (String × String)) :=
  ${definition.declaration}

private structure GeneratorRequest where
  inputs : Array (String × String)
  arguments : Array String
  deriving Lean.FromJson

def main (args : List String) : IO Unit := do
  let [path] := args | throw <| IO.userError "Expected generator input JSON"
  let json ← IO.ofExcept <| Lean.Json.parse (← IO.FS.readFile path)
  let request ← IO.ofExcept (Lean.fromJson? json : Except String GeneratorRequest)
  let files ← IO.ofExcept (generator request.inputs request.arguments)
  IO.println (Lean.toJson files).compress
`;

/**
 * Materialize one generator's exact named text outputs, never author source files.
 *
 * @param definition - Closed internal generator definition.
 * @param entries - Result pairs returned by the compiled pure Lean function.
 */
export const validateLakeGeneratorResult = (definition, entries) => {
	list(entries, "Generated files");
	if(entries.some(entry => !Array.isArray(entry) || entry.length !== 2 || !name(entry[0]) || typeof entry[1] !== "string" || /[\uD800-\uDFFF]/u.test(entry[1]))) fail("Generator results must contain named UTF-8 text pairs");
	unique(entries.map(entry => entry[0]), "generated result name");
	if(!same(entries.map(entry => entry[0]).sort(), definition.outputs.map(output => output.name).sort())) fail("Generator result names differ from the declared outputs");
	const byName = new Map(entries);
	const files = definition.outputs.map(output => ({ path: output.path, content: Buffer.from(byName.get(output.name)) })).sort((left, right) => compare(left.path, right.path));
	if(files.some(file => file.content.length > 8 * 1024 * 1024) || files.reduce((total, file) => total + file.content.length, 0) > 16 * 1024 * 1024) fail("Generated files exceed the 8 MiB file or 16 MiB total limit", "lake-generator-limit");
	return files;
};

/**
 * Validate generator evidence against an independently supplied snapshot and recipe.
 * Output bytes are checked separately by the runner and eventual bundle reader.
 *
 * @param document - Recorded compiler, input, interface and output identities.
 * @param expected - Authorized snapshot and generator definition.
 * @param expected.snapshot - Expected complete source capture.
 * @param expected.definition - Expected closed generator definition.
 */
export const validateLakeGeneratorReceipt = (document, { snapshot, definition }) => {
	validateLakeGeneratorDefinition(definition, snapshot);
	closed(document, ["schemaVersion", "profile", "snapshotSha256", "definition", "compiler", "checker", "driverSha256", "requestSha256", "modules", "artifacts", "inputs", "outputs"], "Generator receipt");
	const hash = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);
	const file = value => {
		closed(value, ["bytes", "sha256", "mode"], "Generator file identity");
		if(!Number.isSafeInteger(value.bytes) || value.bytes < 0 || !hash(value.sha256) || ![0o644, 0o755].includes(value.mode)) fail("Invalid generator file identity");
	};
	if(document.schemaVersion !== 1 || document.profile !== "lean-text-v1" || document.snapshotSha256 !== snapshot.sha256 || !same(document.definition, definition)
		|| document.driverSha256 !== sha256(driver(definition)) || !hash(document.requestSha256)) fail("Generator receipt differs from its authorized definition or source");
	closed(document.compiler, ["bytes", "sha256", "mode", "libraries", "version"], "Generator compiler");
	const { libraries, version, ...compiler } = document.compiler;
	file(compiler); file(document.checker);
	closed(libraries, ["bytes", "files", "sha256"], "Generator compiler library inventory");
	if(!Number.isSafeInteger(libraries.bytes) || libraries.bytes < 1 || !Number.isSafeInteger(libraries.files) || libraries.files < 1 || !hash(libraries.sha256)
		|| typeof version !== "string" || !version.startsWith(`Lean (version ${snapshot.document.toolchain.replace("leanprover/lean4:v", "")},`)) fail("Invalid generator compiler library or version identity");
	const inputs = snapshotFiles(snapshot);
	if(!same(document.inputs, definition.inputs.map(input => ({ ...input, source: inputs.get(input.path) })))) fail("Generator receipt input identities differ from the capture");
	list(document.modules, "Compiled generator modules");
	if(document.modules.length !== definition.modules.length) fail("Generator receipt module count differs");
	for(const [index, module] of document.modules.entries())
	{
		closed(module, ["module", "source", "interface"], "Compiled generator module");
		const source = definition.modules[index];
		if(module.module !== source.module || !same(module.source, inputs.get(source.path))) fail("Generator receipt module source differs");
		file(module.interface);
	}
	if(!Array.isArray(document.artifacts) || !document.artifacts.length || document.artifacts.length > definition.modules.length * 4) fail("Invalid generator compiler artifact inventory");
	const allowed = new Set(definition.modules.flatMap(source => [".olean", ".olean.private", ".olean.server", ".ir"].map(suffix => source.module.replaceAll(".", "/") + suffix)));
	for(const artifact of document.artifacts)
	{
		closed(artifact, ["path", "bytes", "sha256", "mode"], "Generator compiler artifact");
		const { path, ...identity } = artifact;
		if(!allowed.has(path)) fail("Undeclared generator compiler artifact");
		file(identity);
	}
	unique(document.artifacts.map(artifact => artifact.path), "compiler artifact path");
	for(const module of document.modules)
	{
		const artifact = document.artifacts.find(artifact => artifact.path === `${module.module.replaceAll(".", "/")}.olean`);
		if(!artifact || !same(artifact, { path: artifact.path, ...module.interface })) fail("Generator interface differs from compiler artifacts");
	}
	list(document.outputs, "Generated output inventory");
	if(!same(document.outputs.map(output => output.path), definition.outputs.map(output => output.path).sort())) fail("Generated output paths differ from the definition");
	for(const output of document.outputs)
	{
		closed(output, ["path", "bytes", "sha256", "mode"], "Generated output");
		const { path, ...identity } = output;
		void path;
		file(identity);
		if(output.mode !== 0o644 || output.bytes > 8 * 1024 * 1024) fail("Generated output has an invalid mode or size");
	}
	if(document.outputs.reduce((total, output) => total + output.bytes, 0) > 16 * 1024 * 1024) fail("Generated outputs exceed the total size limit");
	return true;
};

/**
 * Compile and check a pure Lean tool, then execute it with only declared text data.
 * Compilation follows normal trusted-Lean rules, not an OS security sandbox.
 *
 * @param options - Authorized source capture, definition and selected Lean compiler.
 * @param options.snapshot - Opaque authenticated complete Lake snapshot.
 * @param options.definition - Explicit generator module order, data and output names.
 * @param options.leanPrefix - Selected Lean installation; no Elan invocation.
 * @param options.runner - Process runner used for fresh compilation and execution.
 * @param options.signal - Optional cancellation signal.
 */
export const runLakeGenerator = async ({ snapshot, definition, leanPrefix, runner = processBuildRunner, signal }) => {
	validateLakeGeneratorDefinition(definition, snapshot);
	// Freeze the caller's specification by value before any asynchronous work.
	definition = JSON.parse(canonicalJson(definition));
	const prefix = await realpath(leanPrefix), lean = join(prefix, "bin/lean"), libraries = join(prefix, "lib/lean");
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-generator-"));
	try
	{
		const capture = join(working, "capture"), sources = join(working, "source"), interfaces = join(working, "olean"), output = join(working, "output");
		await writeLakeDependencySnapshot({ snapshot, outputRoot: capture, signal });
		const files = snapshotFiles(snapshot), checkedSources = [];
		for(const [path, file] of files) await chmod(join(capture, path), file.mode === 0o755 ? 0o555 : 0o444);
		await mkdir(sources); await mkdir(interfaces); await mkdir(output);
		for(const source of definition.modules)
		{
			const path = `${source.module.replaceAll(".", "/")}.lean`;
			try
			{ await lstat(join(libraries, path.replace(/\.lean$/, ".olean"))); fail("Generator module shadows the selected compiler library"); }
			catch(error)
			{ if(error.code !== "ENOENT") throw error; }
			const bytes = await readFile(join(capture, source.path));
			utf8(bytes);
			await mkdir(dirname(join(sources, path)), { recursive: true });
			await writeFile(join(sources, path), bytes, { flag: "wx", mode: files.get(source.path).mode === 0o755 ? 0o555 : 0o444 });
			checkedSources.push({ ...files.get(source.path), path: join(sources, path) });
		}
		const data = [];
		for(const input of definition.inputs) data.push([input.name, utf8(await readFile(join(capture, input.path)))]);
		const env = { PATH: join(prefix, "bin"), LEAN_SYSROOT: prefix, LEAN_PATH: interfaces, LEAN_SRC_PATH: sources, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
		const run = args => runner.capture({ command: lean, args, cwd: sources, env, signal, timeoutMs: 120000 });
		const compiler = { ...await fileIdentity(lean, signal), libraries: await libraryIdentity(libraries, signal) };
		const checkerIdentity = await fileIdentity(checker, signal);
		const version = (await run(["--version"])).stdout.trim();
		const wantedVersion = snapshot.document.toolchain.replace("leanprover/lean4:v", "");
		if(!version.startsWith(`Lean (version ${wantedVersion},`)) fail("Generator compiler differs from the captured toolchain");
		const compiled = [];
		for(const source of definition.modules)
		{
			const path = source.module.replaceAll(".", "/"), olean = join(interfaces, `${path}.olean`);
			await mkdir(dirname(olean), { recursive: true });
			await run(["-R", sources, "-o", olean, `${path}.lean`]);
			compiled.push({ module: source.module, source: files.get(source.path), interface: await fileIdentity(olean, signal) });
		}
		const artifacts = await treeFiles(interfaces, signal);
		const allowedArtifacts = new Set(definition.modules.flatMap(source => [".olean", ".olean.private", ".olean.server", ".ir"].map(suffix => source.module.replaceAll(".", "/") + suffix)));
		if(artifacts.some(file => !allowedArtifacts.has(file.path))) fail("Generator compilation produced an undeclared artifact");
		const checkPath = join(working, "check.json");
		const checkRequest = canonicalJson({ modules: definition.modules.map(source => source.module), exports: [definition.declaration], resources: [], arities: [] });
		await writeFile(checkPath, checkRequest, { flag: "wx", mode: 0o444 });
		const checked = await run(["--run", checker, "--check-bodies", checkPath]);
		if(!same(JSON.parse(checked.stdout), { checked: [definition.declaration] })) fail("Generator body checker returned an unexpected result");
		const driverSource = driver(definition), driverPath = join(sources, "LeanBridgeGeneratorMain.lean"), requestPath = join(working, "input.json");
		await writeFile(driverPath, driverSource, { flag: "wx", mode: 0o444 });
		const request = canonicalJson({ inputs: data, arguments: definition.arguments });
		await writeFile(requestPath, request, { flag: "wx", mode: 0o444 });
		const result = await run(["--run", driverPath, requestPath]);
		let entries;
		try
		{ entries = JSON.parse(result.stdout); }
		catch
		{ fail("Generator did not return one JSON result", "lake-generator-result-invalid"); }
		const generated = validateLakeGeneratorResult(definition, entries), outputs = [];
		for(const file of generated)
		{
			await mkdir(dirname(join(output, file.path)), { recursive: true });
			await writeFile(join(output, file.path), file.content, { flag: "wx", mode: 0o444 });
			outputs.push({ path: file.path, bytes: file.content.length, sha256: sha256(file.content), mode: 0o644 });
		}
		const verify = async () => {
			await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: capture, signal });
			for(const source of checkedSources)
				if(!same({ bytes: source.bytes, sha256: source.sha256, mode: source.mode }, await fileIdentity(source.path, signal))) fail("Generator source changed", "lake-generator-drift");
			if(!same(artifacts, await treeFiles(interfaces, signal))) fail("Generator compiler artifacts changed", "lake-generator-drift");
			for(const [path, content] of [[requestPath, request], [driverPath, driverSource], [checkPath, checkRequest]])
				if(!same({ bytes: Buffer.byteLength(content), sha256: sha256(content), mode: 0o644 }, await fileIdentity(path, signal))) fail("Generator request or driver changed", "lake-generator-drift");
			const actual = await treeFiles(output, signal);
			if(!same(outputs, actual)) fail("Generated output inventory or contents changed", "lake-generator-drift");
			if(!same(compiler, { ...await fileIdentity(lean, signal), libraries: await libraryIdentity(libraries, signal) }) || !same(checkerIdentity, await fileIdentity(checker, signal))) fail("Generator compiler or body checker changed", "lake-generator-drift");
		};
		await verify();
		const document = frozen({ schemaVersion: 1, profile: "lean-text-v1"
			, snapshotSha256: snapshot.sha256, definition
			, compiler: { ...compiler, version }, checker: checkerIdentity
			, driverSha256: sha256(driverSource), requestSha256: sha256(request)
			, modules: compiled, artifacts
			, inputs: definition.inputs.map(input => ({ ...input, source: files.get(input.path) }))
			, outputs });
		validateLakeGeneratorReceipt(document, { snapshot, definition });
		return Object.freeze({ outputRoot: output, document, sha256: sha256(canonicalJson(document)), verify, dispose: () => rm(working, { recursive: true, force: true }) });
	} catch(error)
	{
		await rm(working, { recursive: true, force: true });
		throw error;
	}
};
