/**
 * Compile captured Lake C inputs with an audited compiler-reported include closure.
 *
 * @file
 */
import { access, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { verifyLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const fail = (message, code = "lake-native-input-invalid") => { throw Object.assign(new Error(message), { code }); };
const identity = async path => { const bytes = await readFile(path); return { bytes: bytes.length, sha256: sha256(bytes) }; };
const inside = (root, path) => path === root || path.startsWith(`${root}${sep}`);
const portable = path => path.split(sep).join("/");
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const flagsFor = profile => ["-O2", "-g0", "-fPIC", "-Werror=date-time"
	, ...(profile === "side-module-2" ? ["-fwasm-exceptions", "-flto", "-ffp-contract=off"] : [])];

/**
 * Validate recorded C compilation before it enters downstream build evidence.
 *
 * @param document - Closed C compiler and include-closure record.
 * @param expected - Required snapshot and profile identities.
 * @param expected.snapshotSha256 - Authorized Lake snapshot digest.
 * @param expected.profile - Required native or WebAssembly profile.
 */
export const validateLakeNativeCompilation = (document, { snapshotSha256, profile }) => {
	const closed = (value, fields) => {
		if(!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), [...fields].sort())) fail("C compilation fields must be closed");
	};
	const hash = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);
	const path = value => typeof value === "string" && !value.includes("\\") && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) && !value.split("/").some(part => !part || part === "." || part === "..");
	const file = value => Number.isSafeInteger(value.bytes) && value.bytes >= 0 && hash(value.sha256);
	closed(document, ["schemaVersion", "profile", "compiler", "flags", "snapshotSha256", "objects"]);
	if(document.schemaVersion !== 1 || !["native-library-v1", "side-module-2"].includes(profile) || document.profile !== profile
		|| !hash(snapshotSha256) || document.snapshotSha256 !== snapshotSha256 || !same(document.flags, flagsFor(profile))) fail("C compilation profile or snapshot differs from the authorized build");
	closed(document.compiler, ["bytes", "sha256", "version"]);
	if(!file(document.compiler) || document.compiler.bytes < 1 || typeof document.compiler.version !== "string" || !document.compiler.version.length) fail("Invalid C compiler identity");
	if(!Array.isArray(document.objects) || !document.objects.length) fail("C compilation contains no objects");
	const sources = new Set();
	for(const [index, object] of document.objects.entries())
	{
		closed(object, ["source", "sourceSha256", "object", "bytes", "sha256", "inputs"]);
		if(!path(object.source) || !/^(root|packages\/[^/]+)\/.+\.c$/.test(object.source) || sources.has(object.source) || !hash(object.sourceSha256)
			|| object.object !== `${index}.o` || !file(object) || object.bytes < 1 || !Array.isArray(object.inputs) || !object.inputs.length) fail("Invalid compiled C object");
		sources.add(object.source);
		const paths = new Set();
		for(const input of object.inputs)
		{
			closed(input, ["path", "bytes", "sha256"]);
			if(!path(input.path) || !/^(snapshot|runtime-[0-9]+|system-[0-9]+)\//.test(input.path) || paths.has(input.path) || !file(input)) fail("Invalid C include identity");
			paths.add(input.path);
		}
		if(!object.inputs.some(input => input.path === `snapshot/${object.source}` && input.sha256 === object.sourceSha256)) fail("C object does not bind its source input");
	}
	return true;
};

/**
 * Collect each declared C translation unit once, in a stable order.
 *
 * @param resolution - Validated Lake ownership and source identities.
 */
export const lakeNativeInputs = resolution => {
	const inputs = new Map();
	for(const module of resolution.modules)
		for(const input of module.nativeInputs ?? []) inputs.set(input.path, input);
	return [...inputs.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
};

/**
 * Read the single dependency rule emitted by GCC/Clang with a fixed -MT value.
 *
 * @param text - Compiler-generated Make dependency text, never source code.
 */
export const parseNativeDependencyFile = text => {
	const prefix = "lean_bridge_native_input:";
	text = text.replace(/\\\r?\n/g, "");
	if(!text.startsWith(prefix)) fail("C compiler emitted an unexpected dependency target");
	const paths = [];
	let value = "";
	for(let i = prefix.length; i < text.length; i++)
	{
		const character = text[i];
		if(character === "\\")
		{
			if(++i === text.length || !" \\#:\t".includes(text[i])) fail("Unsupported escape in C dependency file");
			value += text[i];
		}
		else if(character === "$")
		{
			if(text[++i] !== "$") fail("Unescaped Make variable in C dependency file");
			value += "$";
		}
		else if(/[ \t\r\n]/.test(character))
		{
			if(value) paths.push(value);
			value = "";
		}
		else if(character === ":" || character === "#" || character.charCodeAt(0) < 32) fail("Unexpected rule or comment in C dependency file");
		else value += character;
	}
	if(value) paths.push(value);
	if(!paths.length) fail("C compiler emitted an empty dependency closure");
	return [...new Set(paths)];
};

const executable = async (command, environment) => {
	const candidates = command.includes(sep) ? [resolve(command)] : (environment.PATH ?? "").split(delimiter).filter(Boolean).map(path => join(path, command));
	for(const path of candidates)
		try
		{ await access(path, constants.X_OK); return await realpath(path); }
		catch(error)
		{ if(!["ENOENT", "EACCES", "ENOTDIR"].includes(error.code)) throw error; }
	fail("Selected native-input compiler is unavailable");
};

/**
 * Compile C sources from an immutable capture; check headers before and after.
 * System headers come from the selected compiler's own reported search roots.
 *
 * @param options - Selected profile, captured sources and controlled build tools.
 * @param options.snapshot - Authenticated complete Lake capture.
 * @param options.snapshotRoot - Private materialization of that capture.
 * @param options.inputs - Lake-declared, validated C input records.
 * @param options.outputRoot - New private directory for native object files.
 * @param options.compiler - Selected cc or emcc command.
 * @param options.profile - Native or WebAssembly compilation profile.
 * @param options.includeRoots - Named, trusted Lean/runtime header roots.
 * @param options.runner - Process runner for compiler commands.
 * @param options.environment - Tool environment, without author compiler flags.
 * @param options.signal - Optional cancellation signal.
 */
export const compileLakeNativeInputs = async ({
	snapshot
	, snapshotRoot
	, inputs
	, outputRoot
	, compiler
	, profile
	, includeRoots = []
	, runner = processBuildRunner
	, environment = process.env
	, signal
}) => {
	if(!["native-library-v1", "side-module-2"].includes(profile) || !Array.isArray(inputs) || !inputs.length) fail("Native input compilation requires a selected profile and C inputs");
	await verifyLakeDependencySnapshot({ snapshot, snapshotRoot, signal });
	const root = await realpath(snapshotRoot), output = resolve(outputRoot);
	if(inside(root, output)) fail("Native build output must be outside the captured source tree");
	const files = new Map([
		...snapshot.document.rootInputs.map(file => [`root/${file.path}`, file])
		, ...snapshot.document.packages.flatMap(pkg => pkg.files.map(file => [`${pkg.directory}/${file.path}`, file]))
	]);
	if(new Set(inputs.map(input => input.path)).size !== inputs.length || inputs.some(input => !files.has(input.path) || !input.path.endsWith(".c") || !same(files.get(input.path), input.source)))
		fail("Native C inputs differ from the authenticated snapshot");
	const tool = await executable(compiler, environment);
	const compilerIdentity = await identity(tool);
	// These variables inject include directories or flags outside the selected profile.
	const env = { ...environment, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
	for(const key of ["CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "OBJC_INCLUDE_PATH", "COMPILER_PATH", "GCC_EXEC_PREFIX", "LIBRARY_PATH", "CFLAGS", "CPPFLAGS", "LDFLAGS", "EMCC_CFLAGS", "CCC_OVERRIDE_OPTIONS", "DEPENDENCIES_OUTPUT", "SUNPRO_DEPENDENCIES"])
		delete env[key];
	const run = (args, cwd = output) => runner.capture({ command: tool, args, cwd, env, signal, timeoutMs: 120000 });
	await mkdir(output);
	try
	{
		const version = (await run(["--version"])).stdout.trim();
		const search = await run(["-E", "-x", "c", "-", "-v"]);
		const block = search.stderr.split("#include <...> search starts here:\n")[1]?.split("End of search list.")[0];
		if(!block) fail("C compiler did not report its system header search roots");
		const roots = [];
		for(const [index, path] of block.split(/\r?\n/).map(line => line.trim()).filter(Boolean).entries())
		{
			if(!isAbsolute(path)) fail("C compiler reported a non-absolute header search root");
			roots.push({ name: `system-${index}`, path: await realpath(path) });
		}
		for(const [index, path] of includeRoots.entries()) roots.unshift({ name: `runtime-${index}`, path: await realpath(path) });
		roots.unshift({ name: "snapshot", path: root });
		const flags = flagsFor(profile);
		const compileFlags = [...flags
			, ...roots.flatMap(entry => [`-ffile-prefix-map=${entry.path}=/lake-inputs/${entry.name}`, `-fmacro-prefix-map=${entry.path}=/lake-inputs/${entry.name}`])
			, `-ffile-prefix-map=${output}=/lake-inputs/objects`
			, ...includeRoots.flatMap(path => ["-I", path])];
		const checkedFiles = new Map();
		const dependencies = async path => {
			const records = [];
			for(const dependency of parseNativeDependencyFile(await readFile(path, "utf8")))
			{
				const absolute = await realpath(resolve(root, dependency));
				const owner = roots.find(entry => inside(entry.path, absolute));
				if(!owner) fail("Native C input includes a file outside its captured source or selected toolchain");
				const path = portable(relative(owner.path, absolute));
				const actual = await identity(absolute);
				if(checkedFiles.has(absolute) && !same(checkedFiles.get(absolute), actual)) fail("C header changed during compilation", "lake-source-drift");
				checkedFiles.set(absolute, actual);
				if(owner.name === "snapshot" && (!files.has(path) || files.get(path).sha256 !== actual.sha256 || files.get(path).bytes !== actual.bytes))
					fail("C include differs from its captured input", "lake-source-drift");
				records.push({ path: `${owner.name}/${path}`, ...actual });
			}
			return records.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
		};
		const objects = [], records = [];
		for(const [index, input] of inputs.entries())
		{
			const path = input.path, depfile = join(output, `${index}.d`), object = join(output, `${index}.o`);
			await run([...compileFlags, "-M", "-MT", "lean_bridge_native_input", "-MF", depfile, path], root);
			const before = await dependencies(depfile);
			if(!before.some(file => file.path === `snapshot/${input.path}`)) fail("Native dependency closure omitted its C source");
			await run([...compileFlags, "-MD", "-MT", "lean_bridge_native_input", "-MF", depfile, "-c", path, "-o", object], root);
			if(!same(before, await dependencies(depfile))) fail("C compiler input closure changed during compilation", "lake-source-drift");
			objects.push(object);
			const objectIdentity = await identity(object);
			checkedFiles.set(object, objectIdentity);
			records.push({ source: input.path, sourceSha256: input.source.sha256, object: `${index}.o`, ...objectIdentity, inputs: before });
			await rm(depfile);
		}
		const verify = async () => {
			await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: root, signal });
			if(!same(compilerIdentity, await identity(tool))) fail("Native-input compiler changed during compilation", "lake-source-drift");
			for(const [path, expected] of checkedFiles)
				if(!same(expected, await identity(path))) fail("Native object or include changed before release", "lake-source-drift");
		};
		await verify();
		const document = { schemaVersion: 1
			, profile
			, compiler: { ...compilerIdentity, version }
			, flags, snapshotSha256: snapshot.sha256, objects: records };
		validateLakeNativeCompilation(document, { snapshotSha256: snapshot.sha256, profile });
		return { objects, document, sha256: sha256(canonicalJson(document)), verify };
	} catch(error)
	{
		await rm(output, { recursive: true, force: true });
		throw error;
	}
};
