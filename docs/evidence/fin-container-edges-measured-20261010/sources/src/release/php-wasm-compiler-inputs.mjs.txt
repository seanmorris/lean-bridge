/**
 * Prepared PHP-Wasm runtime and configured headers for checkout-free authors.
 * Packaging and verification run in Node without invoking a compiler.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { phpWasmCopiedPins as pins, phpWasmCopiedProfile as profile, readVerifiedPhpWasmCopiedRuntime } from "../build/php-wasm-copied-artifacts.mjs";
import { readReceiptBytes } from "./package-set-receipt.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";

export const phpWasmCompilerInputsName = "php-wasm-compiler-inputs.json";
export const phpWasmCompilerInputsKind = "lean-bridge-php-wasm-compiler-inputs";
export const phpWasmPhpLicenses = Object.freeze(["LICENSE", "TSRM/LICENSE", "Zend/LICENSE", "Zend/asm/LICENSE", "ext/bcmath/libbcmath/LICENSE", "ext/date/lib/LICENSE.rst", "ext/dom/lexbor/LICENSE", "ext/dom/lexbor/NOTICE", "ext/fileinfo/libmagic/LICENSE", "ext/mbstring/libmbfl/LICENSE", "ext/opcache/jit/ir/LICENSE", "ext/pib/CREDITS", "ext/standard/libavifinfo/LICENSE"]);
const runtimeNotices = ["NOTICE.txt", "lean.txt", "lean-bundled.txt", "emscripten.txt", "llvm.txt", "musl.txt", "libuv.txt"];
const installedRoot = fileURLToPath(new URL("../../", import.meta.url));
const configured = `${pins.phpCommit}:${pins.phpWasmCommit}:${pins.emscriptenCommit}\n`;
const requiredHeaders = ["main/php.h", "main/php_config.h", "main/php_version.h", "Zend/zend.h", "TSRM/TSRM.h"];
const fileLimit = 64 * 1024 ** 2, totalLimit = 512 * 1024 ** 2, pathLimit = 8192;
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-php-wasm-compiler-inputs" }); };
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const closed = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const safe = path => typeof path === "string" && path.length <= 240 && /^[A-Za-z0-9_.+/-]+$(?![\s\S])/.test(path)
	&& path.split("/").every(part => part && part !== "node_modules" && (!part.startsWith(".") || part === ".lean-bridge-configured"));
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const header = path => safe(path) && path.endsWith(".h") && (!path.includes("/") || /^(Zend|main|TSRM|ext)\//.test(path));
const inventory = files => Object.fromEntries([...files].map(([path, bytes]) => [path, identity(bytes)]));
const headerInventory = files => Object.fromEntries([...files].filter(([path]) => path.startsWith("php/") && header(path.slice(4))).map(([path, bytes]) => [path.slice(4), identity(bytes)]));
const allowed = path => path === "README.md" || path === "php/.lean-bridge-configured" || path === "notices/lean-bridge.txt" || path === "notices/php-wasm.txt"
	|| (path.startsWith("php/") && header(path.slice(4)))
	|| (path.startsWith("notices/php/") && phpWasmPhpLicenses.includes(path.slice(12)))
	|| (path.startsWith("notices/runtime/") && runtimeNotices.includes(path.slice(16)))
	|| /^runtime\/(runtime\.json|include\/[A-Za-z0-9_./-]+\.h|lib\/liblean_bridge_php_wasm_copied_[a-f0-9]{20}\.so)$(?![\s\S])/.test(path);

const read = async (root, path, signal, limit = fileLimit) => {
	if(!safe(path)) fail(`Unsafe PHP-Wasm compiler input path: ${path}`);
	let current = resolve(root);
	if(!(await lstat(current)).isDirectory()) fail("Compiler input root must be a regular directory");
	for(const part of path.split("/"))
	{
		current = join(current, part);
		if((await lstat(current)).isSymbolicLink()) fail(`Compiler inputs cannot contain symlinks: ${path}`);
	}
	try
	{ return await readReceiptBytes(current, signal, limit); }
	catch(error)
	{ if(error.code === "invalid-package-set-receipt") fail(`Invalid compiler input ${path}: ${error.message}`); throw error; }
};

// Bound traversal as well as file reads. Do not follow symlinks or special files.
const paths = async root => {
	const files = []; let entries = 0;
	const visit = async (prefix = "", depth = 0) => {
		if(depth > 16) fail("Compiler input tree is too deep");
		for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
		{
			if(++entries > pathLimit * 2) fail("Compiler input tree contains too many entries");
			const path = prefix ? `${prefix}/${entry.name}` : entry.name;
			if(!safe(path)) fail(`Unsafe PHP-Wasm compiler input path: ${path}`);
			if(entry.isDirectory()) await visit(path, depth + 1);
			else if(entry.isFile()) files.push(path);
			else fail(`Compiler inputs must be regular files: ${path}`);
		}
	};
	if(!(await lstat(root)).isDirectory()) fail("Compiler input root must be a regular directory");
	await visit();
	if(files.length > pathLimit) fail("Compiler input tree contains too many files");
	return files.sort();
};

/**
 * Select the same configured headers for raw and prepared PHP-Wasm builds.
 *
 * @param root - Configured PHP source or prepared header directory.
 */
export const phpWasmHeaderPaths = async root => {
	const result = (await readdir(root, { withFileTypes: true })).filter(entry => entry.name.endsWith(".h")).map(entry => entry.name);
	for(const subdir of ["Zend", "main", "TSRM", "ext"])
		result.push(...(await nativeArtifactPaths(join(root, subdir))).filter(path => path.endsWith(".h")).map(path => `${subdir}/${path}`));
	if(result.length > pathLimit || !result.every(header)) fail("Invalid configured PHP header inventory");
	return result.sort();
};

const checkHeaders = files => {
	for(const path of requiredHeaders) if(!files.has(`php/${path}`)) fail(`Missing configured PHP header: ${path}`);
	if(files.get("php/.lean-bridge-configured")?.toString() !== configured) fail("Configured PHP source pins differ from PHP-Wasm");
	const version = files.get("php/main/php_version.h").toString(), config = files.get("php/main/php_config.h").toString();
	if(!/^#define PHP_VERSION_ID 80401\r?$/m.test(version) || !/^#define SIZEOF_LONG 4\r?$/m.test(config)
		|| !/^#define SIZEOF_SIZE_T 4\r?$/m.test(config) || /^\s*#\s*define\s+ZTS\b/m.test(config)) fail("PHP-Wasm requires configured PHP 8.4.1 wasm32 NTS headers");
};

/**
 * Read a closed bundle into verified bytes before any build input is staged.
 * Its sidecar checks consistency, not publisher authentication.
 *
 * @param root - Extracted compiler-input directory.
 * @param options - Verification controls.
 * @param options.signal - Optional cancellation signal.
 */
export const readVerifiedPhpWasmCompilerInputs = async (root, { signal } = {}) => {
	const location = resolve(root), bytes = await read(location, phpWasmCompilerInputsName, signal, 4 * 1024 ** 2);
	const sidecar = await read(location, `${phpWasmCompilerInputsName}.sha256`, signal, 256);
	if(sidecar.toString() !== `${sha256(bytes)}  ${phpWasmCompilerInputsName}\n`) fail("PHP-Wasm compiler input manifest hash mismatch");
	const manifest = JSON.parse(bytes.toString());
	if(!closed(manifest, ["schemaVersion", "kind", "profile", "pins", "sourceDateEpoch", "runtimeIdentity", "phpHeadersSha256", "files"])
		|| manifest.schemaVersion !== 1 || manifest.kind !== phpWasmCompilerInputsKind || manifest.profile !== profile || !same(manifest.pins, pins)
		|| !Number.isSafeInteger(manifest.sourceDateEpoch) || manifest.sourceDateEpoch < 1 || manifest.sourceDateEpoch > 0o77777777777
		|| !hash(manifest.runtimeIdentity) || !hash(manifest.phpHeadersSha256)
		|| !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)
		|| !Object.keys(manifest.files).length || Object.keys(manifest.files).length > pathLimit) fail("Invalid PHP-Wasm compiler input manifest");
	let total = 0;
	for(const [path, entry] of Object.entries(manifest.files))
	{
		if(!safe(path) || !allowed(path) || !closed(entry, ["bytes", "sha256"]) || !Number.isSafeInteger(entry.bytes)
			|| entry.bytes < 0 || entry.bytes > fileLimit || !hash(entry.sha256)) fail(`Invalid PHP-Wasm compiler input entry: ${path}`);
		total += entry.bytes;
	}
	if(total > totalLimit) fail("PHP-Wasm compiler inputs exceed the size limit");
	if(!same(await paths(location), [...Object.keys(manifest.files), phpWasmCompilerInputsName, `${phpWasmCompilerInputsName}.sha256`].sort())) fail("Missing or unrecorded PHP-Wasm compiler input");
	const files = new Map();
	for(const [path, expected] of Object.entries(manifest.files))
	{
		const content = await read(location, path, signal, expected.bytes);
		if(!same(identity(content), expected)) fail(`PHP-Wasm compiler input drift: ${path}`);
		files.set(path, content);
	}
	checkHeaders(files);
	for(const path of ["README.md", "notices/lean-bridge.txt", "notices/php-wasm.txt", ...runtimeNotices.map(path => `notices/runtime/${path}`), ...phpWasmPhpLicenses.map(path => `notices/php/${path}`)])
		if(!files.get(path)?.length) fail(`Missing PHP-Wasm compiler input notice: ${path}`);
	if(sha256(canonicalJson(headerInventory(files))) !== manifest.phpHeadersSha256) fail("PHP-Wasm header identity mismatch");
	const runtime = await readVerifiedPhpWasmCopiedRuntime(join(location, "runtime"));
	if(runtime.identity !== manifest.runtimeIdentity) fail("PHP-Wasm compiler input runtime mismatch");
	files.set(phpWasmCompilerInputsName, bytes); files.set(`${phpWasmCompilerInputsName}.sha256`, sidecar);
	return { root: location, manifest, identity: sha256(bytes), files };
};

const readme = `# PHP-Wasm compiler inputs\n\nFor authors compiling ordinary Lean packages with Lean Bridge. Contains the prebuilt\n${profile} runtime and configured PHP ${pins.phpVersion} wasm32 NTS headers.\n\nSet LEAN_BRIDGE_PHP_INPUTS to this extracted directory, or use a CLI archive\nthat includes it. Separately install Lean 4.32.2 and Emscripten ${pins.emscriptenVersion};\nset LEAN_BRIDGE_LEAN_PREFIX and LEAN_BRIDGE_PHP_EMSDK to those installations.\nNo PHP source checkout, configure tools or Lean target archives are needed.\nConsumers install the resulting packages without any of these build inputs.\n\nThe manifest pins upstream sources and records runtime, compiler and file hashes.\nObtain the archive and its expected hash through your trusted release channel.\nThe adjacent hash file does not authenticate the publisher.\n\nPHP headers retain their license comments and notices/php/ contains their upstream\nlicenses. Runtime licenses and modification notices are in notices/runtime/.\nLean Bridge source and glue use the license in notices/lean-bridge.txt.\n`;

/**
 * Assemble a deterministic archive from prepared files without compiling them.
 *
 * @param options - Verified runtime, configured PHP source, source notices and new output.
 * @param options.runtimeRoot - Prebuilt copied-runtime directory.
 * @param options.phpSource - Configured PHP source tree, including its notices.
 * @param options.outputRoot - New directory for the bundle and archive.
 * @param options.projectRoot - Lean Bridge source containing retained runtime notices.
 * @param options.sourceDateEpoch - Fixed archive timestamp.
 * @param options.signal - Optional cancellation signal.
 */
export const buildPhpWasmCompilerInputs = async ({ runtimeRoot, phpSource, outputRoot, projectRoot = installedRoot, sourceDateEpoch = 1786261809, signal }) => {
	if(typeof outputRoot !== "string" || !outputRoot) fail("A new compiler input output directory is required");
	const output = resolve(outputRoot);
	if(await lstat(output).catch(error => { if(error.code === "ENOENT") return null; throw error; })) fail("Compiler input output already exists");
	if(!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 1 || sourceDateEpoch > 0o77777777777) fail("Invalid compiler input archive epoch");
	const files = new Map(); let total = 0;
	const add = async (root, path, destination) => {
		const bytes = await read(root, path, signal);
		total += bytes.length;
		if(total > totalLimit || files.size >= pathLimit) fail("PHP-Wasm compiler inputs exceed the size limit");
		files.set(destination, bytes);
	};
	for(const path of await paths(resolve(runtimeRoot))) await add(runtimeRoot, path, `runtime/${path}`);
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	for(const path of [...await phpWasmHeaderPaths(phpSource), ".lean-bridge-configured"]) await add(phpSource, path, `php/${path}`);
	for(const path of phpWasmPhpLicenses) await add(phpSource, path, `notices/php/${path}`);
	for(const path of runtimeNotices) await add(projectRoot, `notices/runtime/${path}`, `notices/runtime/${path}`);
	await add(projectRoot, "LICENSE", "notices/lean-bridge.txt");
	await add(projectRoot, "notices/php-wasm.txt", "notices/php-wasm.txt");
	files.set("README.md", Buffer.from(readme)); checkHeaders(files);
	const manifest = { schemaVersion: 1, kind: phpWasmCompilerInputsKind, profile, pins, sourceDateEpoch, runtimeIdentity: runtime.identity, phpHeadersSha256: sha256(canonicalJson(headerInventory(files))), files: inventory(files) };
	const bytes = Buffer.from(canonicalJson(manifest));
	files.set(phpWasmCompilerInputsName, bytes);
	files.set(`${phpWasmCompilerInputsName}.sha256`, Buffer.from(`${sha256(bytes)}  ${phpWasmCompilerInputsName}\n`));
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-php-inputs-"));
	try
	{
		for(const [path, bytes] of files)
		{
			const destination = join(staging, "php-wasm-compiler-inputs", path);
			await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes, { flag: "wx", mode: 0o644 });
		}
		const checked = await readVerifiedPhpWasmCompilerInputs(join(staging, "php-wasm-compiler-inputs"), { signal });
		const archiveName = `lean-bridge-php-wasm-inputs-${checked.identity.slice(0, 20)}.tgz`;
		const archive = createDeterministicTarGzFromFiles({ files: [...checked.files].map(([path, bytes]) => ({ path: `php-wasm-compiler-inputs/${path}`, bytes, mode: 0o644 })), sourceDateEpoch });
		await writeFile(join(staging, archiveName), archive, { flag: "wx" });
		await writeFile(join(staging, `${archiveName}.sha256`), `${sha256(archive)}  ${archiveName}\n`, { flag: "wx" });
		signal?.throwIfAborted();
		if(await lstat(output).catch(error => { if(error.code === "ENOENT") return null; throw error; })) fail("Compiler input output already exists");
		await rename(staging, output);
		return { output, directory: join(output, "php-wasm-compiler-inputs"), archive: join(output, archiveName), identity: checked.identity, runtimeIdentity: runtime.identity, phpHeadersSha256: manifest.phpHeadersSha256, archiveSha256: sha256(archive) };
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};
