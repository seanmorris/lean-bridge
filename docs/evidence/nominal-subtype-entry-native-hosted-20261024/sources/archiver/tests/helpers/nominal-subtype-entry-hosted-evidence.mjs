/**
 * Retain and independently replay the original nominal Subtype entry artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import {
	copyFile, lstat, mkdir, mkdtemp, open, readFile, realpath, rm, stat
	, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, posix } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackSubtypeHostedDigest, extractCallbackSubtypeHostedArtifact
	, inspectCallbackSubtypeHostedArtifact
	, splitCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-archive.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	summarizeNominalSubtypeEntryHostedRun
} from "./nominal-subtype-entry-hosted-summary.mjs";

const contracts = Object.freeze({
	native: Object.freeze({
		workflow: ".github/workflows/nominal-subtype-entry-native.yml"
		, jobName: "Constructor and source entry in C with explicit C++ classification"
		, artifactPrefix: "nominal-subtype-entry-native"
		, acceptanceStep: "Measure both source routes and classify both API modes"
		, archiveStep: "Preserve original and partial measurement records"
		, enforceStep: "Enforce installed entry measurement"
		, profiles: Object.freeze(["c", "cpp"])
	})
	, browser: Object.freeze({
		workflow: ".github/workflows/nominal-subtype-entry-browser.yml"
		, jobName: "Constructor and source entry in Node and three browsers"
		, artifactPrefix: "nominal-subtype-entry-browser"
		, acceptanceStep: "Measure both source routes and classify both API modes"
		, archiveStep: "Preserve original and partial measurement records"
		, enforceStep: "Enforce installed entry measurement"
		, profiles: Object.freeze(["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"])
	})
});

export const nominalSubtypeEntryHostedLanes = Object.freeze(
	Object.keys(contracts));

const producerEntries = Object.freeze({
	native: Object.freeze([
		"scripts/check-nominal-subtype-entry-native-ci.mjs"
		, "tests/helpers/nominal-subtype-dispatch-tests.mjs"
		, "tests/helpers/nominal-subtype-native-installed-tests.mjs"
	])
	, browser: Object.freeze([
		"scripts/check-nominal-subtype-entry-browser-ci.mjs"
		, "tests/engine-execution-request.test.mjs"
		, "tests/helpers/nominal-subtype-entry-npm-tests.mjs"
		, "tests/helpers/nominal-subtype-entry-tests.mjs"
		, "tests/helpers/nominal-subtype-npm-installed-tests.mjs"
	])
});

const fixtureSources = [
	"LICENSE", "NominalSubtypes.lean", "lakefile.toml", "lean-toolchain"
	, "package.json"
].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`);
const producerCommon = Object.freeze([
	...fixtureSources, ".github/actions/bounded-apt/action.yml"
	, "lean-toolchain", "package-lock.json", "package.json"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
	, "src/analyze/NativeExports.lean", "src/backends/c/gmp.source.tar.xz"
	, "src/build/ResolveLakeWorkspace.lean"
]);
const producerAssets = Object.freeze({
	native: Object.freeze(["scripts/run-nominal-subtype-entry-native-ci.sh"])
	, browser: Object.freeze([
		"flake.lock", "flake.nix", "nix/wasm-toolchain.nix"
		, "scripts/build-lean-link-spike.sh"
		, "scripts/install-playwright-browsers.sh"
		, "scripts/run-nominal-subtype-entry-browser-ci.sh"
	])
});

const sourceCache = new Map();

const original = (revision, path) => {
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 256 * 1024 ** 2 }
	));
	return sourceCache.get(key);
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path); paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths];
};

const roleSources = (role, revision, paths) => [...new Set(paths)].sort()
	.map(path => Object.freeze({ role, revision, path }));

/**
 * Exact producer, checker and archiver source closure for one lane.
 *
 * @param lane - Native or browser lane.
 * @param revisions - Producer and archive/checker revisions.
 */
export const nominalSubtypeEntryHostedSources = (lane, revisions) => {
	assert.ok(nominalSubtypeEntryHostedLanes.includes(lane));
	assert.deepEqual(Object.keys(revisions).sort(), ["archive", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const contract = contracts[lane];
	const checkerPaths = closure(revisions.archive, [
		"tests/helpers/nominal-subtype-entry-hosted-summary.mjs"
	]);
	const archiverPaths = closure(revisions.archive, [
		"scripts/archive-nominal-subtype-entry-evidence.mjs"
	]);
	return Object.freeze([
		...roleSources("producer", revisions.producer, [
			...closure(revisions.producer, producerEntries[lane])
			, contract.workflow, ...producerCommon, ...producerAssets[lane]
		])
		, ...roleSources("checker", revisions.archive, checkerPaths)
		, ...roleSources("archiver", revisions.archive, archiverPaths)
	]);
};

const apiRecords = api => Object.fromEntries(Object.entries(api).map(
	([name, item]) => [name, {
		bytes: item.bytes.length, sha256: item.sha256
	}]
));

const assertApiBinding = (index, hosted) => {
	const { apiRecords: retainedApi, artifact: retainedArtifact, ...retainedRun }
		= index.hostedRun;
	const { members, parts, ...artifact } = retainedArtifact;
	assert.ok(Array.isArray(members)); assert.ok(Array.isArray(parts));
	assert.deepEqual({ ...retainedRun, artifact }, hosted.hostedRun);
	assert.deepEqual(retainedApi, apiRecords(hosted.api));
};

const reconstructArtifact = async (root, parts, target) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			await output.write(bytes, 0, bytes.length, offset);
			offset += bytes.length;
		}
		return offset;
	}
	finally
	{ await output.close(); }
};

const limitations = Object.freeze([
	"These are separate instrumented measurement packages, not unmodified release packages."
	, "Full ordinary and reviewed APIs measure public entry, validator, selected constructor, adapter and source behavior; result-only APIs retain explicit nonmeasurement classifications."
	, "Native measurement executes installed and relocated C packages and classifies C++ separately. Browser measurement executes source-free Node, strict TypeScript, page, React and worker packages in Chromium, Firefox and WebKit."
	, "The original artifact ZIP, GitHub API bytes and exact producer, checker and archiver sources are retained and independently replayed."
	, "External compilers, runtimes, package managers, browsers and operating-system distributions remain trusted recorded inputs."
]);

const expected = lane => {
	const contract = contracts[lane];
	return {
		workflow: contract.workflow, jobName: contract.jobName
		, artifactPrefix: contract.artifactPrefix
	};
};

const namedStep = (job, name) => {
	const matches = job.steps.filter(step => step.name === name);
	assert.equal(matches.length, 1, name);
	return matches[0];
};

/**
 * Require a successful measurement, retained artifact and skipped failure guard.
 *
 * @param lane - Native or browser lane.
 * @param bytes - Original job API bytes.
 */
export const assertNominalSubtypeEntryHostedSteps = (lane, bytes) => {
	const contract = contracts[lane], job = JSON.parse(bytes);
	assert.ok(Array.isArray(job.steps) && job.steps.length > 0);
	const acceptance = namedStep(job, contract.acceptanceStep);
	const archive = namedStep(job, contract.archiveStep);
	const enforce = namedStep(job, contract.enforceStep);
	assert.equal(acceptance.status, "completed");
	assert.equal(acceptance.conclusion, "success");
	assert.equal(archive.status, "completed");
	assert.equal(archive.conclusion, "success");
	assert.equal(enforce.conclusion, "skipped");
	assert.ok(acceptance.number < archive.number && archive.number < enforce.number);
	for(const step of job.steps)
		assert.ok(["success", "skipped"].includes(step.conclusion)
			, `Hosted step did not succeed: ${step.name}`);
};

const actualSummary = async (lane, root, hosted) => {
	const paths = await nativeArtifactPaths(root);
	return summarizeNominalSubtypeEntryHostedRun(lane, {
		name: hosted.hostedRun.artifact.name, producer: hosted.revision, paths
		, read: path => readFile(join(root, path))
	});
};

const descriptorMap = () => {
	const values = new Map();
	const put = (path, descriptor) => {
		assert.ok(!values.has(path), path); values.set(path, descriptor);
	};
	return { values, put };
};

/**
 * Write one immutable hosted measurement archive.
 *
 * @param options - Original API/ZIP paths and destination.
 */
export const writeNominalSubtypeEntryHostedEvidence = async options => {
	const { lane, selected, destination, archiveCommit } = options;
	assert.ok(nominalSubtypeEntryHostedLanes.includes(lane));
	assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
	await assert.rejects(lstat(destination), { code: "ENOENT" });
	const hosted = await inspectCallbackSubtypeHostedArtifact(
		selected, expected(lane));
	assertNominalSubtypeEntryHostedSteps(lane, hosted.api.job.bytes);
	const extracted = await extractCallbackSubtypeHostedArtifact(
		selected["artifact-zip"]);
	const partsRoot = await mkdtemp(join(
		tmpdir(), "lean-bridge-nominal-entry-parts-"));
	try
	{
		const summary = await actualSummary(lane, extracted.root, hosted);
		const { values, put } = descriptorMap();
		const putBytes = (path, value) => {
			const bytes = Buffer.from(value);
			put(path, { bytes: bytes.length, sha256: sha256(bytes), value: bytes });
		};
		const putFile = async (path, source) => {
			const information = await stat(source);
			assert.ok(information.isFile());
			put(path, { bytes: information.size
				, sha256: await callbackSubtypeHostedDigest(source), source });
		};
		for(const [name, item] of Object.entries(hosted.api))
			putBytes(`hosted/api/${name}.json`, item.bytes);
		const parts = await splitCallbackSubtypeHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
		const selectedSources = nominalSubtypeEntryHostedSources(lane, {
			producer: hosted.revision, archive: archiveCommit
		});
		for(const source of selectedSources)
			putBytes(`sources/${source.role}/${source.path}`
				, original(source.revision, source.path));
		const files = [...values].sort(([left], [right]) =>
			left.localeCompare(right)).map(([path, item]) => ({
			path, bytes: item.bytes, sha256: item.sha256
			}));
		const index = {
			schemaVersion: 1, kind: `nominal-subtype-entry-${lane}-hosted-v1`
			, lane, profiles: contracts[lane].profiles
			, producerCommit: hosted.revision, checkerCommit: archiveCommit
			, archiveCommit, summary
			, hostedRun: {
				...hosted.hostedRun
				, apiRecords: apiRecords(hosted.api)
				, artifact: {
					...hosted.hostedRun.artifact, members: extracted.entries
					, parts: parts.map(part => ({
						path: `hosted/artifact.zip.parts/${part.name}`
						, offset: part.offset, bytes: part.bytes
						, sha256: part.sha256
					}))
				}
			}
			, selectedSources, files, limitations
		};
		let created = false;
		try
		{
			await mkdir(destination); created = true;
			for(const [path, item] of values)
			{
				const target = join(destination, path);
				await mkdir(dirname(target), { recursive: true });
				if(item.source)
					await copyFile(item.source, target, constants.COPYFILE_EXCL);
				else await writeFile(target, item.value, { flag: "wx" });
			}
			await writeFile(join(destination, "index.json"), canonicalJson(index)
				, { flag: "wx" });
			return index;
		}
		catch(error)
		{
			if(created) await rm(destination, { recursive: true });
			throw error;
		}
	}
	finally
	{
		await rm(extracted.root, { recursive: true });
		await rm(partsRoot, { recursive: true });
	}
};

/**
 * Validate every retained byte and independently replay the original artifact.
 *
 * @param lane - Native or browser lane.
 * @param evidenceRoot - Immutable evidence directory.
 */
export const checkNominalSubtypeEntryHostedEvidence = async (
	lane, evidenceRoot
) => {
	assert.ok(nominalSubtypeEntryHostedLanes.includes(lane));
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.deepEqual(Object.keys(index).sort(), ["archiveCommit", "checkerCommit"
		, "files", "hostedRun", "kind", "lane", "limitations", "producerCommit"
		, "profiles", "schemaVersion", "selectedSources", "summary"].sort());
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, `nominal-subtype-entry-${lane}-hosted-v1`);
	assert.equal(index.lane, lane);
	assert.deepEqual(index.profiles, contracts[lane].profiles);
	assert.deepEqual(index.limitations, limitations);
	assert.equal(index.checkerCommit, index.archiveCommit);
	for(const key of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await nativeArtifactPaths(root)
		, ["index.json", ...index.files.map(file => file.path)].sort());
	for(const file of index.files)
	{
		const path = join(root, file.path);
		assert.equal((await stat(path)).size, file.bytes, file.path);
		assert.equal(await callbackSubtypeHostedDigest(path)
			, file.sha256, file.path);
	}
	const selectedSources = nominalSubtypeEntryHostedSources(lane, {
		producer: index.producerCommit, archive: index.archiveCommit
	});
	assert.deepEqual(index.selectedSources, selectedSources);
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(root
			, `sources/${source.role}/${source.path}`))
		, original(source.revision, source.path)
		, `${source.role}/${source.path}`);
	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-nominal-entry-evidence-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		const bytes = await reconstructArtifact(
			root, index.hostedRun.artifact.parts, zip);
		assert.equal(bytes, index.hostedRun.artifact.bytes);
		assert.equal(await callbackSubtypeHostedDigest(zip)
			, index.hostedRun.artifact.sha256);
		const api = name => join(root, `hosted/api/${name}.json`);
		const hosted = await inspectCallbackSubtypeHostedArtifact({
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		}, expected(lane));
		assert.equal(hosted.revision, index.producerCommit);
		assertApiBinding(index, hosted);
		assertNominalSubtypeEntryHostedSteps(lane, hosted.api.job.bytes);
		extracted = await extractCallbackSubtypeHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		assert.deepEqual(await actualSummary(lane, extracted.root, hosted)
			, index.summary);
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
	return index;
};
