/**
 * Host-neutral runs of a Fin dispatch probe as GDB's own inferior against one verified deployment directory,
 * and the checks that bind an accepted run's record to its rows and to the verified definitions. Each host
 * supplies its probe command line; every run gets a new nonce, record, configuration and output files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nativeFinDefiners, nativeFinGdbIdentity, nativeFinGdbRecord, nativeFinGdbScript, readNativeFinGdbRecord } from "./native-fin-dispatch-gdb.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nativeFinGdbCommand = process.env.LEAN_BRIDGE_GDB ?? "/usr/bin/gdb";

/**
 * Prepare GDB instrumentation of one verified deployment directory. Every counted symbol's single defining
 * library is read from nm before anything runs. Results carry the probe's own exit status, stdout and
 * stderr; GDB's statuses 70-72 mean the inferior never produced trusted rows.
 *
 * @param root0 - Verified deployment and the probe command that loads it.
 * @param root0.probeRoot - Task-owned directory for the script, records and outputs.
 * @param root0.nativeDirectory - Directory that holds every verified library the host loads.
 * @param root0.componentId - Component identity that names the counted adapters.
 * @param root0.argv - Probe command line from { record, nonce, configSha256, definerIndices, mode }.
 * @param root0.cwd - Working directory for the probe.
 * @param root0.env - Clean environment that finds the installed package.
 * @param root0.definers - Optional per-column definer override, for refusal controls.
 */
export const observeNativeFinDispatch = async ({ probeRoot, nativeDirectory, componentId, argv, cwd, env, definers = null }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const libraries = (await readdir(nativeDirectory)).filter(name => /\.so(?:\.[0-9]+)*$/u.test(name)).sort();
	const listings = {};
	for(const name of libraries) listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(nativeDirectory, name)], nativeDirectory, tools)).stdout;
	const { identity, configSha256, definerIndices } = nativeFinGdbIdentity({ componentId, libraries, definers: definers ?? nativeFinDefiners(componentId, listings) });
	await saveLakeFile(probeRoot, "fin.gdb.py", nativeFinGdbScript);
	let runs = 0;
	/**
	 * One probe run; before() may plant a file at the record path first.
	 *
	 * @param root0 - Run options.
	 * @param root0.gdb - Run under GDB instrumentation.
	 * @param root0.mode - Optional probe mode.
	 * @param root0.root - Directory GDB treats as verified, normally the native directory.
	 * @param root0.nonce - Run nonce; fresh unless replayed by a control.
	 * @param root0.before - Optional hook given the record path.
	 * @param root0.inject - Test-only GDB failure injection, never used by acceptance runs.
	 * @param root0.extra - Test-only environment additions for stand-in controls.
	 */
	const run = async ({ gdb = true, mode = null, root = nativeDirectory, nonce = randomBytes(16).toString("hex"), before = null, inject = null, extra = {} } = {}) => {
		const stem = join(probeRoot, `run-${runs++}`), record = `${stem}.record`, armed = `${stem}.armed.json`;
		if(before) await before(record);
		const command = argv({ record, nonce, configSha256, definerIndices, mode });
		const config = { identity, configSha256, root, nonce, record, armed, argv: command, stdout: `${stem}.stdout`, stderr: `${stem}.stderr`, ...inject ? { inject } : {} };
		await writeFile(`${stem}.json`, canonicalJson(config), { flag: "wx" });
		const started = gdb
			? runCopied(nativeFinGdbCommand, ["-batch", "-q", "-nx", "-x", join(probeRoot, "fin.gdb.py")], cwd, { ...env, ...extra, LEAN_BRIDGE_FIN_GDB_CONFIG: `${stem}.json` })
			: runCopied(command[0], command.slice(1), cwd, { ...env, ...extra });
		let code = 0, stdout, stderr;
		try
		{ ({ stdout, stderr } = await started); }
		catch(error)
		{
			const status = /exited with status (\d+)/u.exec(error.message);
			if(!status) throw error;
			code = Number(status[1]); ({ stdout, stderr } = error.details);
		}
		const read = async path => (existsSync(path) ? readFile(path, "utf8") : null);
		// Under GDB the process streams carry GDB's own messages; the probe's streams are files.
		if(!gdb) return { record, nonce, armed, code, output: stdout + stderr, stdout, stderr };
		return { record, nonce, armed, code, output: stdout + stderr, stdout: await read(config.stdout), stderr: await read(config.stderr) };
	};
	return { identity, configSha256, definerIndices, listings, run };
};

/**
 * Require one accepted run's record and armed breakpoints to match its rows and verified definitions.
 *
 * @param observer - Result of observeNativeFinDispatch.
 * @param root0 - One run.
 * @param root0.record - Record path.
 * @param root0.nonce - This run's nonce.
 * @param root0.armed - Armed breakpoint list path.
 * @param observed - Parsed rows of the same run.
 */
export const assertNativeFinGdbRun = async (observer, { record, nonce, armed }, observed) => {
	const mapped = readNativeFinGdbRecord(await readFile(record)), { identity } = observer;
	assert.deepEqual([mapped.magic, mapped.version, mapped.columns, mapped.config, mapped.nonce, mapped.attached], [nativeFinGdbRecord.magic, 1, 6, observer.configSha256, nonce, 1]);
	assert.deepEqual([mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]);
	assert.deepEqual(mapped.definers, observer.definerIndices);
	// The entries the probe printed last are the record's bytes after the final call.
	assert.deepEqual(mapped.entries, observed.at(-1)[2]);
	// GDB kept the inferior PID, configuration and nonce outside the record when it armed.
	const manifest = JSON.parse(await readFile(armed, "utf8"));
	assert.deepEqual([manifest.configSha256, manifest.nonce], [observer.configSha256, nonce]);
	assert.ok(Number.isSafeInteger(manifest.pid) && manifest.pid > 0);
	assert.equal(mapped.pid, manifest.pid, "the record belongs to the instrumented inferior");
	// Each breakpoint sits exactly on its symbol's nm definition in the configured library.
	const breakpoints = manifest.breakpoints.map(({ symbol, library, offset }) => ({ symbol, library, offset }));
	assert.deepEqual(breakpoints.map(item => [item.symbol, item.library]), identity.columns.map((symbol, k) => [symbol, identity.definers[k]]));
	for(const { symbol, library, offset } of breakpoints)
	{
		const line = observer.listings[library].split("\n").find(entry => entry.trim().endsWith(` ${symbol}`));
		assert.equal(offset, Number.parseInt(line.trim().split(" ")[0], 16), symbol);
	}
	return breakpoints.map(({ symbol, library, offset }) => ({ symbol, library, offset: `0x${offset.toString(16)}` }));
};
