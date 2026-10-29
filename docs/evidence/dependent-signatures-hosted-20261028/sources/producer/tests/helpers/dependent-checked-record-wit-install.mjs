/**
 * Compile the dependent checked-record checked-record caller once against an authenticated archive, then replay without build inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { assertNominalSubtypeWitInterfaces } from "./nominal-subtype-wit-interface.mjs";
import { assertDependentCheckedRecordWitIdentity, inspectDependentCheckedRecordWitPackage, dependentCheckedRecordWitComponent, dependentCheckedRecordWitDirectory, dependentCheckedRecordWitPkgConfig, dependentCheckedRecordWitReceipt } from "./dependent-checked-record-wit-package.mjs";

/**
 * Parse pkg-config's shell-escaped stdout into literal argv entries without
 * invoking a shell. In particular, pkg-config escapes spaces in a relocated
 * prefix with a backslash; splitting on whitespace corrupts that path.
 *
 * @param source - Complete pkg-config stdout.
 */
export const parseDependentCheckedRecordWitPkgConfigFlags = source => {
	assert.equal(typeof source, "string");
	const flags = [];
	let flag = "", quote = null, started = false;
	for(let index = 0; index < source.length; index++)
	{
		const character = source[index];
		if(quote !== null)
		{
			if(character === quote)
			{
				quote = null;
				continue;
			}
			if(character === "\\" && quote === '"')
			{
				assert.ok(index + 1 < source.length, "pkg-config ends in an escape");
				flag += source[++index];
				continue;
			}
			flag += character;
			continue;
		}
		if(/\s/u.test(character))
		{
			if(started)
			{
				flags.push(flag);
				flag = "";
				started = false;
			}
			continue;
		}
		started = true;
		if(character === "'" || character === '"')
		{
			quote = character;
			continue;
		}
		if(character === "\\")
		{
			assert.ok(index + 1 < source.length, "pkg-config ends in an escape");
			flag += source[++index];
			continue;
		}
		flag += character;
	}
	assert.equal(quote, null, "pkg-config contains an unterminated quote");
	if(started) flags.push(flag);
	return flags;
};

/**
 * Require the same archive-owned files and consumer executable, with no source or tools.
 *
 * @param context - Original receipt and executable identities, plus the current real root.
 */
export const verifyDependentCheckedRecordWitEnvironment = async context => {
	const { root, receiptBytes, executable } = context;
	assert.equal(await realpath(root), resolve(root));
	const packageClosure = await verifyFinContainerEdgeFileClosure({ installed: join(root, dependentCheckedRecordWitDirectory), receiptBytes, receiptPath: dependentCheckedRecordWitReceipt });
	for(const path of ["consumer.c", "tools"]) await assert.rejects(access(join(root, path)), { code: "ENOENT" });
	const bytes = await readFile(join(root, "consumer"));
	assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, executable);
	const files = await nativeArtifactPaths(root);
	const packageFiles = [...Object.keys(JSON.parse(receiptBytes).files), dependentCheckedRecordWitReceipt];
	assert.deepEqual(files, ["consumer", ...packageFiles.map(path => `${dependentCheckedRecordWitDirectory}/${path}`)].sort());
	return { ...packageClosure, executable, consumerFileSetSha256: sha256(canonicalJson(files)) };
};

/**
 * Authenticate originals before extraction, validate the component and compile only the C caller.
 * Remove caller source and the task-owned assembler/linker directory before the first execution.
 *
 * @param options - Explicit archive, tool and independent caller selections.
 * @param options.root - Existing empty consumer directory.
 * @param options.archive - Original complete package archive.
 * @param options.pkg - Verified package-set component.
 * @param options.model - Reproduced compiler model.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Independently inspected command and C API identities.
 * @param options.caller - Complete independent C caller.
 * @param options.output - Retained record directory outside the consumer tree.
 */
export const installDependentCheckedRecordWit = async ({ root, archive, pkg, model, floor, tools, caller, output }) => {
	assert.equal(await realpath(root), resolve(root)); assert.deepEqual(await readdir(root), []);
	const artifact = pkg.artifacts[0], bytes = await readFile(archive);
	assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, { bytes: artifact.bytes, sha256: artifact.sha256 });
	const commands = [];
	const capture = async (role, args, environment = copiedCleanEnvironment) => {
		const command = tools.commands[role].command, run = await runCopied(command, args, root, environment);
		commands.push({ command, args, cwd: root, environment, run });
		await saveLakeFile(output, "install-commands.json", canonicalJson(commands));
		assert.equal(run.stderr, ""); return run;
	};
	const compression = `--use-compress-program=${tools.commands.gzip.command}`;
	const receiptBytes = (await capture("tar", [compression, "-xOf", archive, `${dependentCheckedRecordWitDirectory}/${dependentCheckedRecordWitReceipt}`])).stdout;
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes, canonicalJson(receipt));
	assertDependentCheckedRecordWitIdentity(receipt, pkg, model, floor);
	const expected = [...Object.keys(receipt.files), dependentCheckedRecordWitReceipt].map(path => `${dependentCheckedRecordWitDirectory}/${path}`).sort();
	for(const path of expected) assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
	const listing = (await capture("tar", [compression, "-tf", archive])).stdout.trimEnd().split("\n");
	assert.deepEqual(listing.sort(), expected, "Archive must contain exactly the original receipt and files");
	await capture("tar", [compression, "-xf", archive]);
	const installed = join(root, dependentCheckedRecordWitDirectory);
	const packaged = await inspectDependentCheckedRecordWitPackage({ installed, receiptBytes, pkg, model, floor, tools, output });
	const component = join(installed, dependentCheckedRecordWitComponent);
	assert.equal((await capture("wasmTools", ["validate", "--features", "component-model", component])).stdout, "");
	const projected = await capture("wasmTools", ["component", "wit", component, "--json"]);
	assertNominalSubtypeWitInterfaces(JSON.parse(projected.stdout), compileCopiedWitModel(model.bindingIr, { name: pkg.name, version: pkg.version }, { callables: true }));
	const buildTools = join(root, "tools"); await mkdir(buildTools);
	for(const [name, role] of [["as", "assembler"], ["ld", "linker"]]) await symlink(tools.commands[role].command, join(buildTools, name));
	const environment = { ...copiedCleanEnvironment, PATH: buildTools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = parseDependentCheckedRecordWitPkgConfigFlags((await capture(
		"pkgConfig", ["--cflags", "--libs", dependentCheckedRecordWitPkgConfig]
		, environment)).stdout);
	assert.equal(flags.filter(flag => flag.startsWith("-Wl,-rpath,")).length, 1);
	const runtimeSearchPath = `$ORIGIN/${dependentCheckedRecordWitDirectory}/lib`;
	const relativeFlags = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,${runtimeSearchPath}` : flag);
	await saveLakeFile(root, "consumer.c", caller); await saveLakeFile(output, "consumer.c", caller);
	await capture("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.c", ...relativeFlags, "-o", join(root, "consumer")], environment);
	const dynamic = await capture("readelf", ["--dynamic", join(root, "consumer")]);
	assert.deepEqual([...dynamic.stdout.matchAll(/\((?:RUNPATH|RPATH)\)[^\n]*\[([^\]]*)\]/gu)].map(match => match[1]), [runtimeSearchPath]);
	const executableBytes = await readFile(join(root, "consumer"));
	const executable = { bytes: executableBytes.length, sha256: sha256(executableBytes) };
	await saveLakeFile(output, "consumer.bin", executableBytes);
	assert.equal(await readFile(join(root, "consumer.c"), "utf8"), caller);
	await rm(join(root, "consumer.c")); await rm(buildTools, { recursive: true });
	const context = { root, receiptBytes, executable, runtimeSearchPath };
	const closure = await verifyDependentCheckedRecordWitEnvironment(context);
	await saveLakeFile(output, "installation.json", canonicalJson({ context, closure, commands, callerSha256: sha256(caller) }));
	return { context, packaged };
};
