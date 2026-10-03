/**
 * Reconstruct nine shared archive targets and the raw installed CPAN matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJvmCallbackCombinedRelease } from "./owned-jvm-callback-result-combined-evidence.mjs";
import { assertOwnedPerlCallbackPackageArtifacts, assertOwnedPerlCallbackInstalled } from "./owned-perl-callback-result-package-evidence.mjs";

const hash = value => sha256(canonicalJson(value));
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
const targets = ["c", "cpp", "cargo", "pypi", "rubygems", "npm", "nuget", "maven", "cpan"];
const top = [
	"browser", "built", "cProbeSha256", "cli", "cliFilesVerified"
	, "cliVerification"
	, "cliVerificationExecution", "cmake", "compilerFreeConsumerEnvironment"
	, "compilerInputsIdentity", "cppCmake", "cppDocumentation", "cppManifest"
	, "cppProbeSha256", "documentation", "independentProducerBuild", "installedC"
	, "installedCpp", "installedDotnet", "installedJvm", "installedPerl"
	, "installedPython", "installedRuby", "installedRust", "installedTypeScript"
	, "inventory", "jsProbeSha256", "manifest", "mode", "native", "nativeInput"
	, "nativeRuntime", "observed", "producerAndCliRemovedBeforeInstall"
	, "rawExecutions", "receipt", "rubyAdapter", "rustDocumentation"
	, "rustManifest"
	, "savedHandoff", "schemaVersion", "sourceUnchanged", "wasm", "wasmInput"
];

const response = (command, project, result, perls = []) => ({
	cache: { directory: null, policy: project ? "use" : "off" }, command
	, configuration: {
		path: null
		, sources: {
			cacheDirectory: "default", cachePolicy: "default", format: "cli"
			, progress: "default", project: project ? "cli" : "default"
			, targets: project ? "cli" : "default"
		}
	}
	, diagnostics: [], exitCode: 0, interactive: false, mode: "execute"
	, nextActions: []
	, progress: {
		mode: "none"
		, events: [
			["command", "started", command + " started"]
			, ...project ? [
				["build", "started", "Building the canonical artifact and package closure"]
				, ["build", "info", "Compiling owned Lean exports with pinned-author-sdk"]
				, ["build", "info", "Compiling checked native Lean exports"]
				, ...perls.map(perl => ["build", "info", "Compiling XS for " + perl])
				, ["build", "completed", "Canonical build completed"]
			] : []
			, ["command", "completed", command + " ok"]
		].map(([phase, state, message], index) => ({
			command, current: null, message, phase, schemaVersion: 1
			, sequence: index + 1, state, total: null, type: "progress"
		}))
	}
	, project, prompts: [], result, schemaVersion: 2
	, selection: { allTargets: !project, targets: project ? [...targets].sort() : [] }
	, status: "ok"
});

// These CLI entries are generated, not copied from checkout source files.
const cliGeneratedFiles = (config, filePaths) => ({
	"README.md": `# Lean Bridge

Compile Lean libraries into packages with generated native-language APIs.

## Use the CLI

Run \`lean-bridge --help\` after installation. Copied-value npm authors need Node 22, Git, and Nix or Docker for isolated compilation. Owned-value npm authors use Lean 4.32.2 and the pinned Emscripten 6.0.6 SDK. Other targets use the tools listed in the author guide.

\`lean-bridge analyze --project . --target npm --check\` inspects an ordinary Lake project.

\`lean-bridge build --project . --target npm --output build/component\` compiles its supported exports.

\`lean-bridge verify --receipt /path/to/package-set-receipt.json\` checks a prepared multi-ecosystem archive set. Existing npm receipts remain supported. Signed archives additionally require the trusted policy, policy hash, archive path, signed subject and expected coordinate listed by \`lean-bridge verify --help\`. Verification requires only Node and the supplied files, without a project or build tools.

This candidate is \`${config.name}@${config.version}\`. It includes the prebuilt JavaScript-Wasm runtime needed to prepare local component archives.

It includes the pinned JavaScript-Wasm Lean headers. Set LEAN_BRIDGE_LEAN_PREFIX and LEAN_BRIDGE_JS_EMSDK to your author SDK installations; no Lean Bridge checkout or Lean target build is needed.

It does not include PHP-Wasm compiler inputs. Supply a prepared bundle through LEAN_BRIDGE_PHP_INPUTS to build that target.

## Documentation

- [Author guide](https://seanmorris.github.io/lean-bridge/docs/lean/)
- [Verify a prepared release](https://seanmorris.github.io/lean-bridge/docs/consume/receive-package/)
- [Repository and issue tracker](https://github.com/seanmorris/lean-bridge)

## Release status

This archive is a local release candidate. Creating it does not publish a package or grant production approval. Registry ownership, bootstrap publication, builder distribution, runtime acceptance, and release approval remain separate checks.

## License

Lean Bridge source is distributed under the MIT license in LICENSE. Upstream runtime licenses and attribution are included in notices/runtime/.
`
	, "package.json": JSON.stringify({
		name: config.name, version: config.version, description: config.description
		, license: "MIT", type: "module"
		, bin: { "lean-bridge": "scripts/lean-bridge.mjs", "lean-bridge-signing-policy": "scripts/create-publication-signer-policy.mjs" }
		, engines: { node: ">=22" }
		, repository: { type: "git", url: "git+https://github.com/seanmorris/lean-bridge.git" }
		, homepage: "https://seanmorris.github.io/lean-bridge/"
		, bugs: { url: "https://github.com/seanmorris/lean-bridge/issues" }
		, files: [...filePaths, "cli-package-inventory.json"].sort()
		, publishConfig: { access: "public", tag: "next", registry: "https://registry.npmjs.org/" }
	}, null, 2) + "\n"
});

const rawEvidence = item => {
	assert.equal(item.rawExecutions.length, 42);
	const raw = item.rawExecutions, author = raw[0].cwd, root = dirname(author);
	assert.ok(isAbsolute(root)); assert.equal(basename(author), item.mode + "-author");
	const node = raw[2].command;
	assert.ok(isAbsolute(node)); assert.ok(["node", "nodejs"].includes(basename(node)));
	const consumer = join(root, item.mode + "-consumer");
	const source = join(root, item.mode + "-source"), cli = join(author, "node_modules/.bin/lean-bridge");
	for(const execution of raw)
	{
		keys(execution, ["command", "args", "cwd", "code", "stdout", "stderr"]);
		assert.equal(execution.code, 0); assert.equal(typeof execution.stdout, "string");
		assert.equal(typeof execution.stderr, "string");
		assert.doesNotMatch(execution.stdout + execution.stderr, /segmentation fault|core dumped|double free/iu);
	}
	const command = (index, executable, args, cwd, stdout) => {
		const execution = raw[index];
		assert.equal(execution.command, executable); assert.deepEqual(execution.args, args);
		assert.equal(execution.cwd, cwd); assert.equal(execution.stderr, "");
		if(stdout !== undefined) assert.equal(execution.stdout, stdout);
		return execution;
	};
	command(0, "npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"], author);
	const perls = item.installedPerl.observations.filter(value => value.mode === "prebuilt-only").map(value => value.perl);
	assert.deepEqual(item.built, response("build", source, item.built.result, perls));
	command(1, cli, [
		"build", "--project", source
		, ...targets.flatMap(target => ["--target", target])
		, "--output", join(root, item.mode + "-release"), "--json"
	], author, canonicalJson(item.built));
	const verified = response("verify", null, {
		archives: item.receipt.packages.reduce((sum, pkg) => sum + pkg.artifacts.length, 0)
		, authenticated: false, component: item.native.model.component.id
		, packages: item.receipt.packages.map(({ ecosystem, target, name, version }) => ({ ecosystem, target, name, version }))
		, profiles: item.receipt.profiles.map(profile => profile.id)
		, receiptSha256: hash(item.receipt)
		, verificationType: "local-package-set", verified: true
	});
	assert.deepEqual(item.cliVerification, verified);
	command(2, node, [cli, "verify", "--receipt", join(root, item.mode + "-handoff/package-set-receipt.json"), "--json"], author, canonicalJson(verified));
	const { code, stdout, stderr } = raw[2];
	assert.deepEqual(item.cliVerificationExecution, { code, stdout, stderr });
	for(const [profile, index, compiler, output] of [["c", 3, "C", "callback-results-installed:219\n"], ["cpp", 6, "CXX", "owned-cpp-callback-results-installed:76\n"]])
	{
		const path = join(consumer, profile);
		command(index, "/usr/bin/cmake", [
			"-S", path, "-B", "cmake-build", "-G", "Unix Makefiles"
			, `-DCMAKE_${compiler}_COMPILER=/usr/bin/${profile === "c" ? "cc" : "c++"}`
			, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
			, `-DCMAKE_PREFIX_PATH=${join(root, item.mode + "-relocated-" + profile)}`
		], path);
		command(index + 1, "/usr/bin/cmake", ["--build", "cmake-build"], path);
		command(index + 2, join(path, "cmake-build/consumer"), [], path, output);
	}
	const cpp = join(consumer, "cpp"), rust = join(consumer, "rust");
	command(9, "/usr/bin/pkg-config", ["--cflags", "--libs", item.cppManifest.pkgConfig], cpp);
	command(10, "/usr/bin/c++", [
		"-std=c++20", "-Wall", "-Wextra", "-Werror", "documented.cpp"
		, ...raw[9].stdout.trim().split(/\s+/u), "-o", "documented"
	], cpp, "");
	command(11, join(cpp, "documented"), [], cpp, "42\n");
	const cargo = item.receipt.packages.find(pkg => pkg.target === "cargo");
	for(const [index, path] of [[12, cargo.artifacts[0].path], [13, item.installedRust.dependencies.archive]])
		command(index, "/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(root, item.mode + "-handoff", path)], rust, "");
	for(const index of [14, 15])
	{
		assert.match(raw[index].command, /\/rust-1\.90\.0\/bin\/cargo$/u);
		assert.equal(raw[index].cwd, rust); assert.equal(raw[index].stdout, "");
	}
	assert.equal(raw[14].command, raw[15].command);
	assert.deepEqual(raw[14].args, ["generate-lockfile", "--offline"]);
	assert.deepEqual(raw[15].args, ["build", "--offline", "--locked", "--bins", "--features", "combined"]);
	command(16, join(rust, "target/debug/documentation"), [], rust, "42\n");
	for(const [index, python] of item.installedPython.entries())
	{
		const path = join(consumer, "python-" + python.name), executable = join(path, "venv/bin/python"), offset = 17 + index * 5;
		const first = command(offset, executable, ["-I", "-B", "consumer.py"], path);
		assert.deepEqual(JSON.parse(first.stdout), python.loader.consumer);
		const loaded = command(offset + 1, executable, ["-I", "-B", "loader-probe.py"], path);
		assert.deepEqual(JSON.parse(loaded.stdout), python.loader);
		command(offset + 2, executable, ["-I", "-c", "import pathlib, lean_owned_aggregates as api; print(pathlib.Path(api.__file__).parent)"], path);
		assert.ok(raw[offset + 2].stdout.trim().startsWith(path + "/venv/"));
		assert.ok(isAbsolute(raw[offset + 3].command));
		command(offset + 3, raw[offset + 3].command, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", executable, "documentation.py"], path, "Success: no issues found in 1 source file\n");
		command(offset + 4, executable, ["-I", "-B", "documentation.py"], path, "42\n42\n");
		const relocated = join(root, item.mode + "-relocated-python-" + python.name);
		command(33 + index, join(relocated, "venv/bin/python"), ["-I", "-B", "consumer.py"], relocated, first.stdout);
	}
	const npm = join(consumer, "npm");
	command(32, "npm", [
		"install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"
		, ...item.receipt.packages.filter(pkg => pkg.target === "npm").map(pkg => join(root, item.mode + "-handoff", pkg.artifacts[0].path))], npm);
	for(const index of [36, 37]) command(index, join(root, item.mode + "-relocated-rust"), [], root, "owned-rust-callback-results:118\n");
	const js = command(38, node, ["call.mjs"], npm);
	assert.deepEqual(JSON.parse(js.stdout), item.observed);
	assert.match(raw[39].args[0], /\/node_modules\/typescript\/bin\/tsc$/u);
	command(39, node, [raw[39].args[0], "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"], npm, "");
	command(40, node, ["documentation.mjs"], npm, "42n\ntrue\n42n\n");
	assert.equal(raw[41].args.length, 8);
	for(const [index, name] of ["react", "react-dom", "scheduler"].entries())
		assert.match(raw[41].args[index + 5], new RegExp(`^\\./framework/${name}-[0-9]+\\.[0-9]+\\.[0-9]+\\.tgz$`, "u"));
	command(41, "npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...raw[41].args.slice(5)], npm);
	return root;
};

/**
 * Validate actual nine-target contracts without synthesizing an eight-target report.
 *
 * @param name - Canonical mode-specific report name.
 * @param item - Complete original shared release report.
 * @param readSource - Current source or independently authenticated source reader.
 */
export const assertOwnedPerlCallbackCombinedRelease = async (name, item, readSource = readFile) => {
	keys(item, top);
	assert.equal(name, `${item.mode}-combined-release.json`);
	const { model } = await assertOwnedJvmCallbackCombinedRelease(item, readSource, { cpan: true, independentRebuild: false });
	const config = JSON.parse((await readSource("config/cli-package.v1.json")).toString());
	const generated = cliGeneratedFiles(config, item.cli.files.map(file => file.path).filter(path => path !== "package.json"));
	for(const [path, bytes] of Object.entries(generated))
		assert.deepEqual(item.cli.files.find(file => file.path === path), {
			path, mode: 0o644, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes)
		});
	const perl = item.installedPerl;
	keys(perl, ["archives", "bindingManifest", "componentReceipt", "consumerSha256", "limitations", "manifest", "model", "observations", "runtimeManifest"]);
	assert.deepEqual(perl.model, model); assert.deepEqual(perl.componentReceipt, item.native.receipt);
	assert.deepEqual(perl.limitations, ["no native adapter owner or allocation counters"]);
	await assertOwnedPerlCallbackPackageArtifacts({ ...perl, input: item.nativeInput }, model, readSource);
	assert.equal(hash(perl.bindingManifest), perl.manifest.files["binding-manifest.json"]);
	const packages = [];
	for(const [index, role] of ["runtime", "component"].entries())
	{
		const manifest = role === "runtime" ? perl.runtimeManifest : perl.manifest;
		const selected = item.receipt.packages.filter(pkg => pkg.target === "cpan" && pkg.role === role);
		assert.equal(selected.length, 1); const pkg = selected[0];
		assert.deepEqual(pkg, {
			artifacts: pkg.artifacts, ecosystem: "cpan", name: manifest.distribution
			, profile: "native-library-v1", role
			, runtimeIdentity: item.native.receipt.runtimeIdentity
			, requires: role === "runtime" ? [] : [{ ecosystem: "cpan", name: perl.runtimeManifest.distribution, version: perl.runtimeManifest.version }]
			, runtimeDelivery: role === "runtime" ? "provided" : "dependency"
			, target: "cpan", version: manifest.version
		});
		assert.equal(pkg.artifacts.length, 1); const artifact = pkg.artifacts[0];
		assert.equal(artifact.path, `profiles/native/archives/${manifest.distribution}-${manifest.version}.tar.gz`);
		const archive = { archive: basename(artifact.path), bytes: artifact.bytes, sha256: artifact.sha256 };
		assert.deepEqual(perl.archives[index], archive); packages.push(archive);
	}
	assert.equal(perl.archives.length, 2);
	const root = rawEvidence(item);
	await assertOwnedPerlCallbackInstalled(perl, join(root, item.mode + "-perl-installed"), packages, readSource);
	assert.ok(isAbsolute(item.savedHandoff));
	assert.match(basename(item.savedHandoff), new RegExp(`^${item.mode}-combined-release-handoff-[A-Za-z0-9]+$`, "u"));
};
