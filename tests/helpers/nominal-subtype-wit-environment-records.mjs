/**
 * Reconcile one caller compilation and both source-free execution environments.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { nominalSubtypeWitDirectory, nominalSubtypeWitReceipt } from "./nominal-subtype-wit-package.mjs";
import { assertNominalSubtypeWitInterfaces } from "./nominal-subtype-wit-interface.mjs";
import { nominalSubtypeWitAbsolute, nominalSubtypeWitSuccessful } from "./nominal-subtype-wit-tool-records.mjs";

/**
 * Check the original tools, component projection, exact compile flags and ELF origin path.
 *
 * @param options - Original package, compiler and independent caller records.
 * @param options.read - Original selection-relative byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.packaged - Authenticated complete package file identities.
 * @param options.tools - Original tool identities.
 * @param options.caller - Independently reconstructed caller source.
 * @param options.projection - Generator projection from the frozen model and sources.
 */
export const checkNominalSubtypeWitEnvironmentRecords = async ({ read, json, packaged, tools, caller, projection }) => {
	const installation = await json("installation.json"), commands = await json("install-commands.json");
	assert.deepEqual(Object.keys(installation).sort(), ["callerSha256", "closure", "commands", "context"]);
	assert.deepEqual(installation.commands, commands); assert.equal(commands.length, 8);
	assert.equal(installation.callerSha256, sha256(caller));
	const context = installation.context;
	assert.deepEqual(Object.keys(context).sort(), ["executable", "receiptBytes", "root", "runtimeSearchPath"]);
	const root = context.root; nominalSubtypeWitAbsolute(root);
	assert.equal(context.receiptBytes, (await read("package/" + nominalSubtypeWitReceipt)).toString());
	const bytes = await read("consumer.bin");
	assert.deepEqual(bytes.subarray(0, 6), Buffer.from([127, 69, 76, 70, 2, 1]));
	assert.deepEqual(context.executable, { bytes: bytes.length, sha256: sha256(bytes) });
	const search = `$ORIGIN/${nominalSubtypeWitDirectory}/lib`;
	assert.equal(context.runtimeSearchPath, search);
	const expectedFiles = ["consumer", ...Object.keys(packaged.files).map(path => nominalSubtypeWitDirectory + "/" + path)].sort();
	const closure = { ...packaged.closure, executable: context.executable, consumerFileSetSha256: sha256(canonicalJson(expectedFiles)) };
	assert.deepEqual(installation.closure, closure);
	const roles = ["tar", "tar", "tar", "wasmTools", "wasmTools", "pkgConfig", "cc", "readelf"];
	const installed = posix.join(root, nominalSubtypeWitDirectory), component = posix.join(installed, "component/nominalsubtypes.wasm");
	const compileEnvironment = { ...copiedCleanEnvironment, PATH: posix.join(root, "tools"), PKG_CONFIG_LIBDIR: posix.join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	for(const [index, record] of commands.entries())
	{
		assert.deepEqual(Object.keys(record).sort(), ["args", "command", "cwd", "environment", "run"]);
		assert.equal(record.command, tools.commands[roles[index]].command); assert.equal(record.cwd, root);
		assert.deepEqual(record.environment, [5, 6].includes(index) ? compileEnvironment : copiedCleanEnvironment);
		nominalSubtypeWitSuccessful(record.run);
	}
	const archive = commands[0].args[2]; nominalSubtypeWitAbsolute(archive);
	assert.ok(archive.endsWith("/handoff/" + packaged.archive.path));
	const compression = `--use-compress-program=${tools.commands.gzip.command}`;
	assert.deepEqual(commands[0].args, [compression, "-xOf", archive, `${nominalSubtypeWitDirectory}/${nominalSubtypeWitReceipt}`]);
	assert.equal(commands[0].run.stdout, context.receiptBytes);
	assert.deepEqual(commands[1].args, [compression, "-tf", archive]);
	const listing = commands[1].run.stdout; assert.ok(listing.endsWith("\n"));
	assert.deepEqual(listing.slice(0, -1).split("\n").sort(), expectedFiles.filter(path => path !== "consumer"));
	assert.deepEqual(commands[2].args, [compression, "-xf", archive]); assert.equal(commands[2].run.stdout, "");
	assert.deepEqual(commands[3].args, ["validate", "--features", "component-model", component]); assert.equal(commands[3].run.stdout, "");
	assert.deepEqual(commands[4].args, ["component", "wit", component, "--json"]);
	assertNominalSubtypeWitInterfaces(JSON.parse(commands[4].run.stdout), projection);
	assert.deepEqual(commands[5].args, ["--cflags", "--libs", "nominalsubtypes-wit"]);
	const flags = commands[5].run.stdout.trim().split(/\s+/u);
	assert.equal(flags.length, 5);
	assert.deepEqual(flags.map(flag => {
		if(flag.startsWith("-I") || flag.startsWith("-L")) return flag.slice(0, 2) + posix.normalize(flag.slice(2));
		if(flag.startsWith("-Wl,-rpath,")) return "-Wl,-rpath," + posix.normalize(flag.slice(11));
		return flag;
	}), [`-I${installed}/include`, `-L${installed}/lib`, `-Wl,-rpath,${installed}/lib`, "-lnominalsubtypes_wasmtime", "-lwasmtime"]);
	const relative = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? "-Wl,-rpath," + search : flag);
	assert.deepEqual(commands[6].args, ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.c", ...relative, "-o", posix.join(root, "consumer")]);
	assert.equal(commands[6].run.stdout, "");
	assert.deepEqual(commands[7].args, ["--dynamic", posix.join(root, "consumer")]);
	assert.deepEqual([...commands[7].run.stdout.matchAll(/\((?:RUNPATH|RPATH)\)[^\n]*\[([^\]]*)\]/gu)].map(match => match[1]), [search]);
	return { root, closure };
};
