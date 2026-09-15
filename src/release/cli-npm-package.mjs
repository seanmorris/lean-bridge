/**
 * Creates a deterministic standalone CLI archive from a reviewed source allowlist.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "../capsule/node.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";
import { readVerifiedPhpWasmCompilerInputs } from "./php-wasm-compiler-inputs.mjs";

const installedRoot = fileURLToPath(new URL("../../", import.meta.url));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const forbiddenSegments = new Set([".env", ".git", ".npmrc", ".writing-rules.md", "bad-ledge-fill.png", "node_modules", ".toolchains"]);
const excludedRoots = new Set(["build", "demos", "site", "tests"]);
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/;

const fail = (code, message) => {
	throw Object.assign(new Error(message), { code });
};

const sourcePath = value => {
	if(typeof value !== "string" || value === "" || value.includes("\\") || value.includes("\0"))
		fail("invalid-cli-package-path", "CLI source paths must be portable relative file paths");
	const segments = value.split("/");
	if(excludedRoots.has(segments[0]) || segments.some(segment => segment === "" || segment === "." || segment === ".." || forbiddenSegments.has(segment) || segment.startsWith(".env.")))
		fail("invalid-cli-package-path", `CLI source path is excluded: ${value}`);
	return value;
};

const sourceFile = async (root, path) => {
	sourcePath(path);
	const segments = path.split("/");
	let location = root;
	for(const [index, segment] of segments.entries())
	{
		location = join(location, segment);
		const facts = await lstat(location);
		if(facts.isSymbolicLink() || (index < segments.length - 1 ? !facts.isDirectory() : !facts.isFile()))
			fail("unsafe-cli-package-source", `CLI source must be a regular file without symlink parents: ${path}`);
	}
	return readFile(location);
};

const readManifest = async root => {
	const config = JSON.parse(await sourceFile(root, "config/cli-package.v1.json"));
	if(config.schemaVersion !== 1 || !packageNamePattern.test(config.name) || !versionPattern.test(config.version))
		fail("invalid-cli-package-manifest", "CLI package identity or manifest version is invalid");
	if(!Number.isSafeInteger(config.sourceDateEpoch) || config.sourceDateEpoch < 1 || !Array.isArray(config.files))
		fail("invalid-cli-package-manifest", "CLI package requires an epoch and an explicit source file list");
	if(config.files.length === 0 || new Set(config.files).size !== config.files.length)
		fail("invalid-cli-package-manifest", "CLI package source list must be nonempty and contain no duplicates");
	for(const path of config.files) sourcePath(path);
	for(const required of ["LICENSE", "scripts/lean-bridge.mjs", "scripts/create-publication-signer-policy.mjs", "flake.nix", "flake.lock", "poc/lean-link-spike/graph-lock.json"])
		if(!config.files.includes(required)) fail("invalid-cli-package-manifest", `CLI source list is missing ${required}`);
	return config;
};

const packageReadme = (config, runtimeIncluded, phpWasmInputsIncluded) => `# Lean Bridge

Compile Lean libraries into packages with generated native-language APIs.

## Use the CLI

Run \`lean-bridge --help\` after installation. npm authors need Node 22, Git, and Nix or Docker for isolated compilation. Other targets use the tools listed in the author guide.

\`lean-bridge analyze --project . --target npm --check\` inspects an ordinary Lake project.

\`lean-bridge build --project . --target npm --output build/component\` compiles its supported exports.

\`lean-bridge verify --receipt /path/to/package-set-receipt.json\` checks a prepared multi-ecosystem archive set. Existing npm receipts remain supported. Signed archives additionally require the trusted policy, policy hash, archive path, signed subject and expected coordinate listed by \`lean-bridge verify --help\`. Verification requires only Node and the supplied files, without a project or build tools.

This candidate is \`${config.name}@${config.version}\`. ${runtimeIncluded ? "It includes the prebuilt JavaScript-Wasm runtime needed to prepare local component archives." : "It does not include the JavaScript-Wasm runtime."}

${phpWasmInputsIncluded ? "It includes the PHP-Wasm runtime and configured headers. PHP-Wasm authors need Lean 4.32.2 and the pinned Emscripten 3.1.68 SDK, but no Lean Bridge checkout or PHP configure tools." : "It does not include PHP-Wasm compiler inputs. Supply a prepared bundle through LEAN_BRIDGE_PHP_INPUTS to build that target."}

## Documentation

- [Author guide](https://seanmorris.github.io/lean-bridge/docs/lean/)
- [Verify a prepared release](https://seanmorris.github.io/lean-bridge/docs/consume/receive-package/)
- [Repository and issue tracker](https://github.com/seanmorris/lean-bridge)

## Release status

This archive is a local release candidate. Creating it does not publish a package or grant production approval. Registry ownership, bootstrap publication, builder distribution, runtime acceptance, and release approval remain separate checks.

## License

Lean Bridge source is distributed under the MIT license in LICENSE. Upstream runtime licenses and attribution are included in notices/runtime/.
`;

/**
 * Stages an allowlisted CLI and optional prebuilt runtime without running npm lifecycle scripts.
 *
 * @param root0 - Local packaging inputs; this operation never contacts a registry.
 * @param root0.projectRoot - Checkout containing the reviewed CLI source manifest.
 * @param root0.outputRoot - New directory reserved for the candidate and its inventory.
 * @param root0.runtimeRoot - Optional prepared directory containing main.mjs and main.wasm.
 * @param root0.phpWasmInputsRoot - Optional verified PHP-Wasm compiler-input directory.
 */
export const buildCliNpmPackage = async ({ projectRoot = installedRoot, outputRoot, runtimeRoot = null, phpWasmInputsRoot = null }) => {
	const root = await realpath(projectRoot);
	if(typeof outputRoot !== "string" || outputRoot === "") fail("cli-package-output-required", "A new CLI package output directory is required");
	const output = resolve(outputRoot);
	const relation = relative(output, root);
	if(relation === "" || (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)))
		fail("unsafe-cli-package-output", "CLI package output cannot replace the checkout or one of its parents");
	const config = await readManifest(root);
	const files = new Map();
	for(const path of config.files) files.set(path, await sourceFile(root, path));
	if(runtimeRoot !== null)
	{
		const runtime = await realpath(runtimeRoot);
		for(const path of ["main.mjs", "main.wasm"])
			files.set(`runtime/wasm/${path}`, await sourceFile(runtime, path));
		if(!WebAssembly.validate(files.get("runtime/wasm/main.wasm"))) fail("invalid-cli-runtime", "The supplied CLI runtime is not a valid WebAssembly module");
	}
	if(phpWasmInputsRoot !== null)
	{
		const inputs = await readVerifiedPhpWasmCompilerInputs(phpWasmInputsRoot);
		for(const [path, bytes] of inputs.files) files.set(`runtime/php-wasm/${path}`, bytes);
	}
	files.set("README.md", Buffer.from(packageReadme(config, runtimeRoot !== null, phpWasmInputsRoot !== null)));
	const manifest = {
		name: config.name
		, version: config.version
		, description: config.description
		, license: "MIT"
		, type: "module"
		, bin: { "lean-bridge": "scripts/lean-bridge.mjs", "lean-bridge-signing-policy": "scripts/create-publication-signer-policy.mjs" }
		, engines: { node: ">=22" }
		, repository: { type: "git", url: "git+https://github.com/seanmorris/lean-bridge.git" }
		, homepage: "https://seanmorris.github.io/lean-bridge/"
		, bugs: { url: "https://github.com/seanmorris/lean-bridge/issues" }
		, files: [...files.keys(), "cli-package-inventory.json"].sort()
		, publishConfig: { access: "public", tag: "next", registry: "https://registry.npmjs.org/" }
	};
	files.set("package.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
	const inventory = [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({
		path
		, bytes: bytes.length
		, sha256: digest(bytes)
		, mode: Object.values(manifest.bin).includes(path) ? 0o755 : 0o644
	}));
	const record = {
		schemaVersion: 1
		, kind: "lean-bridge-cli-package"
		, package: { name: config.name, version: config.version }
		, sourceDateEpoch: config.sourceDateEpoch
		, runtimeIncluded: runtimeRoot !== null
		, phpWasmInputsIncluded: phpWasmInputsRoot !== null
		, productionApproved: false
		, files: inventory
	};
	files.set("cli-package-inventory.json", Buffer.from(canonicalJson(record)));
	await mkdir(dirname(output), { recursive: true });
	await mkdir(output);
	try
	{
		const directory = join(output, "package");
		for(const [path, bytes] of files)
		{
			const destination = join(directory, path);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, bytes, { flag: "wx", mode: Object.values(manifest.bin).includes(path) ? 0o755 : 0o644 });
			await chmod(destination, Object.values(manifest.bin).includes(path) ? 0o755 : 0o644);
		}
		const archiveName = `${config.name.replace(/^@/, "").replace("/", "-")}-${config.version}.tgz`;
		const archive = await createDeterministicTarGz({ directory, archiveRoot: "package", sourceDateEpoch: config.sourceDateEpoch });
		await writeFile(join(output, archiveName), archive, { flag: "wx" });
		const report = {
			...record
			, archive: { path: archiveName, bytes: archive.length, sha256: digest(archive) }
			, inventorySha256: digest(canonicalJson(record))
			, externalRegistryWrites: false
		};
		await writeFile(join(output, "cli-package-report.json"), canonicalJson(report), { flag: "wx" });
		return { output, directory, archive: join(output, archiveName), report };
	} catch(error)
	{
		await rm(output, { recursive: true, force: true });
		throw error;
	}
};
