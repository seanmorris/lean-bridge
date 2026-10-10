/**
 * Eight-column edge instrumentation using the existing GDB arming and sticky-failure logic.
 * The historical ten-column script and record remain unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerGdbScript, finContainerGdbCommand } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEdgeColumns } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation } from "./fin-container-edge-observer.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const substitutions = [
	["the ten FinContainers columns", "the eight Fin container edge columns"]
	, ["LEAN_BRIDGE_FIN_CONTAINER_GDB_CONFIG", "LEAN_BRIDGE_FIN_EDGE_GDB_CONFIG"]
	, ["WIDTH = 10", "WIDTH = 8"]
	, ["10Q10i10I10Q", "8Q8i8I8Q"]
	, ["LBFCOGDB", "LBFEDGDB"]
	, ['"fin-container-entry"', '"fin-container-edge"']
	, ["not ten distinct columns", "not eight distinct columns"]
];
/** Only layout and identity change; every original observer failure path remains. */
export const finContainerEdgeGdbScript = substitutions.reduce((source, [before, after]) => {
	assert.equal(source.split(before).length, 2, `one edge instrumentation template site: ${before}`);
	return source.replace(before, after);
}, finContainerGdbScript);

/**
 * Prepare an observer of exact native bytes. No preloading or loader changes are used.
 *
 * @param options - Model, verified native root and Ruby process selection.
 * @param options.model - Verified native model.
 * @param options.component - Original component identity.
 * @param options.nativeDirectory - Exact deployment directory.
 * @param options.libraries - Every shared-library basename and SHA-256 in the deployment.
 * @param options.probeRoot - Fresh instrumentation directory outside the deployment.
 * @param options.argv - Caller receiving record, nonce, config digest and definer indices.
 * @param options.cwd - Host process working directory.
 * @param options.env - Explicit host environment, without preload injection.
 */
export const prepareFinContainerEdgeGdb = async ({ model, component, nativeDirectory, libraries, probeRoot, argv, cwd, env }) => {
	assert.equal(await realpath(nativeDirectory), resolve(nativeDirectory));
	await assertFinContainerEdgeProbeLocation(nativeDirectory, probeRoot);
	assert.equal(env.LD_PRELOAD, undefined, "never preload native libraries into GDB");
	libraries = Object.freeze({ ...libraries });
	const columns = finContainerEdgeColumns(model, component), names = Object.keys(libraries).sort();
	assert.ok(names.length > 0);
	const verifyLibraries = async () => {
		assert.equal(await realpath(nativeDirectory), resolve(nativeDirectory));
		assert.deepEqual((await readdir(nativeDirectory)).filter(name => /\.so(?:\.[0-9]+)*$/u.test(name)).sort(), names);
		for(const name of names)
		{
			assert.match(name, /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u);
			assert.match(libraries[name], /^[a-f0-9]{64}$/u);
			assert.equal(await realpath(join(nativeDirectory, name)), join(nativeDirectory, name));
			assert.equal(sha256(await readFile(join(nativeDirectory, name))), libraries[name], `native library drift: ${name}`);
		}
	};
	await verifyLibraries();
	const listings = {};
	for(const name of names)
	{
		listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(nativeDirectory, name)], cwd, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" })).stdout;
	}
	const definers = columns.map(symbol => {
		const owners = names.filter(name => listings[name].split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim())));
		assert.equal(owners.length, 1, `one verified definition of ${symbol}`);
		return owners[0];
	});
	const identity = { schemaVersion: 1, kind: "fin-container-edge", platform: "x86_64-linux-gnu", instrument: "gdb-breakpoints", componentId: component.id, columns, libraries: names, definers };
	const configSha256 = sha256(canonicalJson(identity)), definerIndices = definers.map(name => names.indexOf(name));
	await mkdir(probeRoot);
	await mkdir(join(probeRoot, "cache"));
	await saveLakeFile(probeRoot, "edge.gdb.py", finContainerEdgeGdbScript);
	let serial = 0;
	const run = async ({ gdb = true, root = nativeDirectory, inject = null, before = null, script = finContainerEdgeGdbScript, overrideDefiners = null } = {}) => {
		await verifyLibraries();
		const stem = join(probeRoot, `run-${serial++}`), record = `${stem}.record`, nonce = randomBytes(16).toString("hex");
		const command = argv({ record, nonce, configSha256, definerIndices });
		const config = {
			identity: overrideDefiners ? { ...identity, definers: overrideDefiners } : identity
			, configSha256, root, nonce, record
			, armed: `${stem}.armed.json`, stdout: `${stem}.stdout`
			, stderr: `${stem}.stderr`, argv: command
			, ...inject ? { inject } : {} };
		if(before) await before(record);
		await saveLakeFile(probeRoot, `${stem.slice(probeRoot.length + 1)}.json`, canonicalJson(config));
		await saveLakeFile(probeRoot, `${stem.slice(probeRoot.length + 1)}.py`, script);
		let code = 0, output;
		try
		{
			const result = gdb
				? await runCopied(finContainerGdbCommand, ["-batch", "-q", "-nx", "-x", `${stem}.py`], cwd, { ...env, XDG_CACHE_HOME: join(probeRoot, "cache"), LEAN_BRIDGE_FIN_EDGE_GDB_CONFIG: `${stem}.json` })
				: await runCopied(command[0], command.slice(1), cwd, env);
			output = result;
		}
		catch(error)
		{
			const match = /exited with status (\d+)/u.exec(error.message);
			if(!match) throw error;
			code = Number(match[1]); output = error.details;
		}
		await verifyLibraries();
		const text = async path => readFile(path, "utf8").catch(error => { if(error.code === "ENOENT") return null; throw error; });
		return { code, record, nonce, armed: config.armed
			, output: output.stdout + output.stderr
			, stdout: gdb ? await text(config.stdout) : output.stdout
			, stderr: gdb ? await text(config.stderr) : output.stderr };
	};
	return { identity, configSha256, definerIndices, listings, run };
};

/**
 * Independently match final record, addresses and defining ELF offsets to the caller's rows.
 *
 * @param observer - Prepared observer.
 * @param run - Completed process result.
 * @param rows - Complete validated Ruby transcript.
 */
export const assertFinContainerEdgeGdbRun = async (observer, run, rows) => {
	assert.equal(run.code, 0, run.output); assert.equal(run.stderr, "");
	const bytes = await readFile(run.record); assert.equal(bytes.length, 328);
	assert.equal(bytes.toString("ascii", 0, 8), "LBFEDGDB");
	assert.equal(bytes.readUInt32LE(8), 1); assert.equal(bytes.readUInt32LE(12), 8);
	assert.equal(bytes.toString("ascii", 16, 80), observer.configSha256);
	assert.equal(bytes.toString("ascii", 80, 112), run.nonce);
	assert.deepEqual([120, 124, 128, 132].map(offset => bytes.readUInt32LE(offset)), [1, 255, 0, 0]);
	assert.deepEqual(Array.from({ length: 8 }, (_, index) => Number(bytes.readBigUInt64LE(136 + index * 8))), Array(8).fill(1));
	assert.deepEqual(Array.from({ length: 8 }, (_, index) => bytes.readInt32LE(200 + index * 4)), observer.definerIndices);
	assert.deepEqual(Array.from({ length: 8 }, (_, index) => bytes.readUInt32LE(232 + index * 4)), Array(8).fill(0));
	assert.deepEqual(Array.from({ length: 8 }, (_, index) => Number(bytes.readBigUInt64LE(264 + index * 8))), rows.at(-1)[3]);
	const manifest = JSON.parse(await readFile(run.armed));
	assert.equal(manifest.configSha256, observer.configSha256); assert.equal(manifest.nonce, run.nonce);
	assert.ok(Number.isSafeInteger(manifest.pid) && manifest.pid > 0);
	assert.equal(Number(bytes.readBigInt64LE(112)), manifest.pid);
	assert.deepEqual(manifest.breakpoints.map(item => [item.symbol, item.library]), observer.identity.columns.map((symbol, index) => [symbol, observer.identity.definers[index]]));
	const bases = new Map();
	for(const item of manifest.breakpoints)
	{
		const row = observer.listings[item.library].split("\n").find(line => line.trim().endsWith(` ${item.symbol}`));
		assert.equal(item.offset, Number.parseInt(row.trim().split(" ")[0], 16));
		assert.ok(Number.isSafeInteger(item.address) && item.address > item.offset);
		const base = item.address - item.offset;
		assert.equal(base % 4096, 0, "mapped ELF base must be page-aligned");
		if(bases.has(item.library)) assert.equal(base, bases.get(item.library), "all definitions in one ELF share a mapping base");
		bases.set(item.library, base);
	}
	return manifest;
};
