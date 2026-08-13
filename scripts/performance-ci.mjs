#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, statfs, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import {
	assemblePerformanceCiReport,
	performanceCiFamilies,
	renderPerformanceCiSummary,
} from "../src/performance/ci-report.mjs";
import { hashPerformanceWorkloadManifest } from "../src/performance/workloads.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const portable = value => value.replaceAll("\\", "/");

const parse = values => {
	const options = new Map();
	for(let index = 0; index < values.length; index += 1)
	{
		const name = values[index];
		if(!name.startsWith("--")) throw new Error(`invalid option ${name}`);
		const value = values[++index];
		if(value === undefined) throw new Error(`${name} requires a value`);
		const previous = options.get(name);
		options.set(name, previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value]);
	}
	return options;
};

const option = (options, name, fallback = null) => {
	const value = options.get(name);
	return Array.isArray(value) ? value.at(-1) : value ?? fallback;
};

const required = (options, name) => {
	const value = option(options, name);
	if(value === null) throw new Error(`${name} is required`);
	return value;
};

const list = (options, name) => {
	const value = options.get(name);
	if(value === undefined) return [];
	return Array.isArray(value) ? value : [value];
};

const json = async path => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const pathSize = async path => {
	try
	{
		const value = await stat(path);
		if(value.isFile()) return value.size;
		if(!value.isDirectory()) return 0;
		const entries = await readdir(path);
		const sizes = await Promise.all(entries.map(entry => pathSize(join(path, entry))));
		return sizes.reduce((sum, size) => sum + size, 0);
	} catch(error)
	{
		if(error.code === "ENOENT") return 0;
		throw error;
	}
};

const snapshot = async () => {
	const disk = await statfs(root);
	return Object.freeze({
		recordedAt: new Date().toISOString()
		, monotonicNs: process.hrtime.bigint().toString()
		, disk: Object.freeze({
			totalBytes: disk.blocks * disk.bsize
			, freeBytes: disk.bfree * disk.bsize
			, availableBytes: disk.bavail * disk.bsize
		})
		, workspaceBytes: await pathSize(root)
		, toolchainsBytes: await pathSize(join(root, ".toolchains"))
		, buildBytes: await pathSize(join(root, "build"))
		, evidenceBytes: await pathSize(join(root, "build/performance-ci"))
	});
};

const walk = async (path, output) => {
	const value = await stat(path);
	if(value.isDirectory())
	{
		const entries = await readdir(path);
		for(const entry of entries.sort()) await walk(join(path, entry), output);
		return;
	}
	if(!value.isFile()) return;
	const data = await readFile(path);
	output.push(Object.freeze({
		path: portable(relative(root, path))
		, bytes: data.byteLength
		, sha256: sha256(data)
	}));
};

const collectArtifacts = async () => {
	const roots = [
		"build/performance-wasm"
		, "build/performance-scale"
		, "build/lean-link-spike"
		, "poc/lean-link-spike/graph-lock.json"
		, "poc/lean-link-spike/bindings"
	];
	const output = [];
	for(const path of roots) await walk(join(root, path), output);
	output.sort((left, right) => left.path.localeCompare(right.path));
	return Object.freeze(output);
};

const identity = async path => {
	const data = await readFile(join(root, path));
	return Object.freeze({ path, bytes: data.byteLength, sha256: sha256(data) });
};

const source = () => Object.freeze({
	commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
	, dirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "."], { cwd: root, encoding: "utf8" }).trim().length > 0
});

const parsePins = text => Object.fromEntries([
	"ELAN_VERSION"
	, "ELAN_SHA256"
	, "LEAN_TOOLCHAIN"
	, "LEAN_COMMIT"
	, "EMSDK_VERSION"
	, "EMSDK_COMMIT"
	, "WASM_TOOLS_VERSION"
	, "WASM_TOOLS_SHA256"
	, "WABT_VERSION"
	, "WABT_SHA256"
].map(name => {
  const match = text.match(new RegExp(`^${name}=([^\\n]+)$`, "m"));
  if(!match) throw new Error(`bootstrap script does not define ${name}`);
  return [name, match[1].replace(/^"|"$/g, "")];
}));

const commandVersion = (command, args) => {
	try
	{
		return execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim().split("\n")[0];
	} catch
	{
		return null;
	}
};

const createManifest = async options => {
	const output = resolve(required(options, "--output"));
	const start = option(options, "--snapshot") ? await json(resolve(option(options, "--snapshot"))) : await snapshot();
	const bootstrapText = await readFile(join(root, "scripts/bootstrap-toolchains.sh"), "utf8");
	const pins = parsePins(bootstrapText);
	const workloads = await identity("poc/performance/workloads.v1.json");
	const workloadManifest = await json(join(root, workloads.path));
	const result = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-ci-manifest"
		, recordedAt: new Date().toISOString()
		, source: source()
		, workflow: Object.freeze({
			event: process.env.GITHUB_EVENT_NAME ?? "local"
			, repository: process.env.GITHUB_REPOSITORY ?? "local"
			, ref: process.env.GITHUB_REF ?? null
			, runId: process.env.GITHUB_RUN_ID ?? null
			, runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT ?? 1)
			, runnerImage: process.env.ImageOS ?? process.env.RUNNER_OS ?? `${os.platform()}-${os.release()}`
		})
		, toolchain: Object.freeze({
			node: process.version
			, npm: commandVersion("npm", ["--version"])
			, lean: commandVersion(join(root, ".toolchains/elan/bin/lean"), ["--version"])
			, emcc: commandVersion(join(root, ".toolchains/emsdk/upstream/emscripten/emcc"), ["--version"])
			, wasmTools: commandVersion(join(root, ".toolchains/wasm-tools/bin/wasm-tools"), ["--version"])
			, wasmObjdump: commandVersion(join(root, ".toolchains/wabt/bin/wasm-objdump"), ["--version"])
			, pins: Object.freeze(pins)
		})
		, identities: Object.freeze({
			workloads: Object.freeze({ ...workloads, semanticSha256: hashPerformanceWorkloadManifest(workloadManifest) })
			, corpus: await identity("poc/performance/corpus.v1.json")
			, methodology: await identity("poc/performance/methodology.v1.json")
			, graphLock: await identity("poc/performance/scale/graph.v1.json")
			, packageLock: await identity("package-lock.json")
			, flakeLock: await identity("flake.lock")
			, bootstrap: await identity("scripts/bootstrap-toolchains.sh")
		})
		, artifacts: await collectArtifacts()
		, resource: start
		, limitations: Object.freeze([
			"GitHub-hosted runner CPU models and neighboring workloads may change between jobs."
			, "Build and toolchain cache activity occurs outside timed benchmark regions."
			, "The first workflow version runs the complete suite on pushes so its cost can be measured before cadence is split."
		])
	});
	await writeJson(output, result);
};

const createJob = async options => {
	const id = required(options, "--id");
	const output = resolve(required(options, "--output"));
	const before = await json(resolve(required(options, "--snapshot")));
	const after = await snapshot();
	const results = [];
	for(const specification of list(options, "--result"))
	{
		const separator = specification.indexOf("=");
		if(separator === -1) throw new Error(`invalid --result ${specification}`);
		const role = specification.slice(0, separator);
		const path = resolve(specification.slice(separator + 1));
		const data = await readFile(path);
		const record = JSON.parse(data);
		results.push(Object.freeze({
			role
			, path: portable(relative(root, path))
			, bytes: data.byteLength
			, fileSha256: sha256(data)
			, sha256: sha256(canonicalizeJsonValue(record))
		}));
	}
	const cache = option(options, "--cache-hit", "unavailable");
	const accepted = option(options, "--accepted", "true") === "true";
	await writeJson(output, Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-ci-job"
		, id
		, recordedAt: new Date().toISOString()
		, accepted
		, exitCode: Number(option(options, "--exit-code", accepted ? "0" : "1"))
		, command: required(options, "--command")
		, cacheHit: cache === "true" ? true : cache === "false" ? false : null
		, durationMs: Number((BigInt(after.monotonicNs) - BigInt(before.monotonicNs)) / 1_000_000n)
		, resources: Object.freeze({ before, after })
		, results: Object.freeze(results)
	}));
};

const assemble = async options => {
	const input = resolve(required(options, "--input"));
	const output = resolve(required(options, "--output"));
	const summaryPath = resolve(required(options, "--summary"));
	const validationPath = resolve(required(options, "--validation"));
	const records = {};
	const files = {
		spatial: "spatial.json"
		, scaling: "scaling.json"
		, overhead: "overhead.json"
		, lifecycle: "lifecycle.json"
		, selfConsistency: "self-consistency.json"
		, buildReproducibility: "build-reproducibility.json"
	};
	for(const family of performanceCiFamilies)
	{
		try
		{
			records[family] = await json(join(input, files[family]));
		} catch(error)
		{
			if(error.code !== "ENOENT") throw error;
			records[family] = null;
		}
	}
	const jobs = [];
	for(const name of await readdir(input))
	{
		if(/^job-[a-z-]+\.json$/.test(name)) jobs.push(await json(join(input, name)));
	}
	jobs.sort((left, right) => left.id.localeCompare(right.id));
	const artifactName = option(options, "--artifact-name", "performance-evidence");
	const artifactUrl = option(options, "--artifact-url");
	let manifest = null;
	try
	{
		manifest = await json(join(input, "manifest.json"));
	} catch(error)
	{
		if(error.code !== "ENOENT") throw error;
	}
	const report = assemblePerformanceCiReport({
		manifest
		, records
		, jobs
		, artifact: {
			name: artifactName
			, retentionDays: Number(option(options, "--retention-days", "30"))
			, url: artifactUrl
		}
	});
	await writeJson(output, report);
	await writeJson(validationPath, report.validation);
	await mkdir(dirname(summaryPath), { recursive: true });
	await writeFile(summaryPath, renderPerformanceCiSummary(report));
	process.stdout.write(`${JSON.stringify({ accepted: report.accepted, issues: report.validation.issueCount, output, summary: summaryPath }, null, 2)}\n`);
	if(!report.accepted) process.exitCode = 1;
};

const [command, ...arguments_] = process.argv.slice(2);
const options = parse(arguments_);
if(command === "snapshot") await writeJson(resolve(required(options, "--output")), await snapshot());
else if(command === "manifest") await createManifest(options);
else if(command === "job") await createJob(options);
else if(command === "assemble") await assemble(options);
else throw new Error(`unknown performance CI command ${command ?? ""}`);
