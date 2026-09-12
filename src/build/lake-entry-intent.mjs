/**
 * Capture generated public-module intent before compiler-owned signature discovery.
 *
 * @file
 */
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { captureLockedLakeProject } from "./lake-workspace.mjs";
import { readLakeDependencySnapshot, verifyLakeSnapshotProject, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { selectLakeEntryModules } from "./lake-entry-modules.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-lake-entry-intent" }); };
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
const absent = async path => {
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	fail("Generated entry input destination already exists");
};
const readIntent = async (inputRoot, signal) => {
	signal?.throwIfAborted();
	const root = resolve(inputRoot);
	if(await realpath(root) !== root || !(await lstat(root)).isDirectory()) fail("Generated entry input must be a directory without symlinks");
	const names = (await readdir(root)).sort();
	if(canonicalJson(names) !== canonicalJson(["lake", "lake-entry-intent.json"])) fail("Source-only requests cannot supply adapters, semantic metadata or extra files");
	const path = join(root, "lake-entry-intent.json"), before = await lstat(path);
	if(!before.isFile() || before.size > 16 * 1024 * 1024) fail("Generated entry intent must be a regular file no larger than 16 MiB");
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try
	{
		const stat = await file.stat();
		if(!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev || stat.size !== before.size) fail("Generated entry intent changed while opening it");
		const buffer = Buffer.alloc(stat.size + 1);
		let length = 0;
		while(length < buffer.length)
		{
			signal?.throwIfAborted();
			const { bytesRead } = await file.read(buffer, length, Math.min(65536, buffer.length - length), null);
			if(!bytesRead) break;
			length += bytesRead;
		}
		const after = await file.stat(), current = await lstat(path);
		if(length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs
			|| current.ino !== stat.ino || current.dev !== stat.dev || await realpath(path) !== path) fail("Generated entry intent changed while reading it");
		return buffer.subarray(0, length);
	} finally
	{ await file.close(); }
};

/**
 * Build source-only intent, preserving the original capture and requiring root recipes.
 *
 * @param options - Original project and optional release-gate capture.
 * @param options.projectRoot - Original project directory.
 * @param options.lakeSnapshot - Optional independently captured release source.
 * @param options.signal - Optional cancellation signal.
 */
export const prepareLakeEntryIntent = async ({ projectRoot, lakeSnapshot, signal }) => {
	const inventory = await inspectLeanProject(projectRoot, { signal });
	const configuration = inventory.configurationRecord.configuration;
	assertExportConfigurationCapabilities(configuration, { target: "npm", fields: ["modules", "exports", "generators"], targetFields: ["name", "version"] });
	const modules = selectLakeEntryModules(configuration, inventory.inputs);
	if(!modules.some(module => module.origin.kind === "generated")) fail("Source-only intent requires a generated public entry module");
	if(inventory.inputs.some(input => input.path.endsWith(".binding-ir.json"))) fail("Generated public entry signatures must come from fresh Lean metadata, not a supplied Binding IR");
	if(lakeSnapshot) await verifyLakeSnapshotProject({ snapshot: lakeSnapshot, projectRoot, signal });
	else lakeSnapshot = await captureLockedLakeProject({ projectRoot, inputs: inventory.inputs, signal });
	if(!lakeSnapshot) fail("Generated entry intent requires a complete locked capture");
	const facts = inventory.project;
	const id = `${facts.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "lean-project"}@${facts.version}`;
	const document = freeze({ schemaVersion: 1
		, kind: "lean-bridge-lake-entry-intent"
		, component: { id, name: facts.name, version: facts.version }
		, source: { inputs: inventory.inputs, treeSha256: inventory.sourceTreeSha256
			, toolchain: facts.toolchain, lakeSnapshotSha256: lakeSnapshot.sha256 }
		, modules });
	return Object.freeze({ document, sha256: sha256(canonicalJson(document)), lakeSnapshot });
};

/**
 * Write only original capture bytes and source intent into a new input directory.
 *
 * @param options - Independently captured intent and output destination.
 * @param options.intent - Complete source intent with its original capture.
 * @param options.outputRoot - New destination, never an original source tree.
 * @param options.signal - Optional cancellation signal.
 */
export const writeLakeEntryInputs = async ({ intent, outputRoot, signal }) => {
	signal?.throwIfAborted();
	await absent(outputRoot);
	await mkdir(dirname(outputRoot), { recursive: true });
	const staging = await mkdtemp(join(dirname(outputRoot), ".lean-bridge-entry-inputs-"));
	try
	{
		await writeLakeDependencySnapshot({ snapshot: intent.lakeSnapshot, outputRoot: join(staging, "lake"), signal });
		await writeFile(join(staging, "lake-entry-intent.json"), canonicalJson(intent.document), { flag: "wx", mode: 0o444, signal });
		signal?.throwIfAborted();
		await absent(outputRoot);
		await rename(staging, outputRoot);
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};

/**
 * Reconstruct intent from authenticated original bytes, without trusting serialized hints.
 *
 * @param options - Mounted source and externally retained intent identity.
 * @param options.inputRoot - Closed original source mount.
 * @param options.expectedSha256 - Intent digest retained in the engine request.
 * @param options.signal - Optional cancellation signal.
 */
export const readLakeEntryIntent = async ({ inputRoot, expectedSha256, signal }) => {
	const bytes = await readIntent(inputRoot, signal);
	if(sha256(bytes) !== expectedSha256) fail("Generated entry intent identity changed");
	const document = JSON.parse(bytes.toString("utf8"));
	if(document.schemaVersion !== 1 || document.kind !== "lean-bridge-lake-entry-intent") fail("Unsupported generated entry intent");
	const snapshot = await readLakeDependencySnapshot({ snapshotRoot: join(inputRoot, "lake"), expectedSha256: document.source?.lakeSnapshotSha256, signal });
	const reconstructed = await prepareLakeEntryIntent({ projectRoot: join(inputRoot, "lake/root"), lakeSnapshot: snapshot, signal });
	if(bytes.toString() !== canonicalJson(reconstructed.document)) fail("Generated entry intent differs from the captured project");
	return reconstructed;
};
