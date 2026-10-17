/**
 * Freeze the hosted recursive checked-record native PHP producer, verifier and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { assertRecursiveCheckedRecordPhpCiTap } from "./recursive-checked-record-php-ci-report.mjs";
import { recursiveCheckedRecordPhpGenerator } from "./recursive-checked-record-php-generators.mjs";

export const recursiveCheckedRecordPhpEvidenceProducer
	= "dd9af401088a52e701c8cfa684a56c4a6f9be2df";
// The independent checker ran in the same hosted checkout as the producer.
export const recursiveCheckedRecordPhpEvidenceVerifier
	= recursiveCheckedRecordPhpEvidenceProducer;
export const recursiveCheckedRecordPhpEvidence
	= "docs/evidence/recursive-checked-record-php-20261017";
export const recursiveCheckedRecordPhpEvidenceLoadCeiling = 8;
export const recursiveCheckedRecordPhpEvidenceFloor = "2.38";
export const recursiveCheckedRecordPhpEvidenceRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.39"
});
/** Serial hosted order: fixtures outer, routes inner. */
export const recursiveCheckedRecordPhpEvidenceSelections = Object.freeze([
	["ordinary", "recursive"], ["reviewed", "recursive"]
	, ["ordinary", "mutual"], ["reviewed", "mutual"]
]);
export const recursiveCheckedRecordPhpEvidenceToolsSha256
	= "03905bce48293f328da50a3283e4b9901c038ac4d5bc832a7484fb2ac2ef20f5";
export const recursiveCheckedRecordPhpEvidenceToolchainLogSha256
	= "7926b41a9740600f0a09dd86fc8c25997da414d88981a2fe93d35c2d5e65efe9";
export const recursiveCheckedRecordPhpHostedArtifact = Object.freeze({
	repository: "seanmorris/lean-bridge"
	, workflow: "recursive-checked-record-php.yml"
	, runId: 39_012_313_034
	, jobId: 117_337_259_681
	, artifactId: 12_093_239_183
	, artifactName: "recursive-checked-record-php-dd9af401088a52e701c8cfa684a56c4a6f9be2df"
	, artifactBytes: 205_962_606
	, artifactDigest: "sha256:9efa373f82836eb879bb4ddd889fb422b092e1e6fcba5a404e2afa5ac307c500"
	, runnerImage: "ubuntu-24.04"
	, startedAt: "2026-10-17T07:05:28Z"
	, completedAt: "2026-10-17T07:14:32Z"
});

/**
 * Require the exact independently measured hosted PHP and Composer record.
 *
 * @param tools - Parsed canonical hosted tools.json record.
 */
export const assertRecursiveCheckedRecordPhpEvidenceTools = tools => {
	assert.equal(sha256(canonicalJson(tools))
		, recursiveCheckedRecordPhpEvidenceToolsSha256);
	assert.deepEqual(tools.selected, {
		composer: "/usr/bin/composer", composerVersion: "2.7.1"
		, php: "/usr/bin/php8.3", phpVersion: "8.3.6"
	});
	assert.deepEqual({
		command: tools.command, composer: tools.composer
		, runtimeFlags: tools.runtimeFlags
		, php: tools.interpreter.php
	}, {
		command: "/usr/bin/php8.3", composer: "/usr/bin/composer"
		, runtimeFlags: ["-n", "-d", "extension=/usr/lib/php/20230831/ffi.so", "-d", "ffi.enable=1"]
		, php: {
			arch: "x86_64", directory: "/usr/lib/php/20230831", integerBytes: 8
			, modules: ["Core", "date", "libxml", "openssl", "pcre", "zlib", "filter"
				, "hash", "json", "pcntl", "random", "Reflection", "SPL", "session"
				, "standard", "sodium"]
			, os: "Linux", sapi: "cli", version: "8.3.6", zts: 0
		}
	});
	assert.deepEqual(tools.tools, {
		"/usr/bin/composer": { bytes: 3_156, sha256: "5cf51f9912671912136317d889df7a5b8219f2a77f2b311b9a100989106847e2" }
		, "/usr/bin/php8.3": { bytes: 5_784_016, sha256: "1c564e6bafa56d03359c3774be6f4c77d0edecabd2075e18556940a56747c8d7" }
		, "/usr/lib/php/20230831/ctype.so": { bytes: 14_600, sha256: "2865fdd0589a6bf2029a1f436a06ac3072cdf50477f8384146181fe56ef5de51" }
		, "/usr/lib/php/20230831/ffi.so": { bytes: 178_440, sha256: "8202552d21044032e251383c3ffdc64cf2c5db3719a893dee0765d048a537263" }
		, "/usr/lib/php/20230831/iconv.so": { bytes: 51_464, sha256: "79ba2593b71ee8277b3a8e2a530c542f901129c78016b7a87d39fe4c2a50ea24" }
		, "/usr/lib/php/20230831/mbstring.so": { bytes: 1_209_216, sha256: "a6086c078f33dfe34a25b2f9ceb33bae5e08e0d789f61af88c4298d2dbeb7a63" }
		, "/usr/lib/php/20230831/phar.so": { bytes: 293_128, sha256: "eec9a6756cfe51253b0aa53c7a2751236db2292c6ea4e7e599f3cbe7e930b3cb" }
		, "/usr/lib/php/20230831/tokenizer.so": { bytes: 35_080, sha256: "df382431be0c4ceb5cd99df184f40b7522b0718d6f9db1260097dd2c28fb95ee" }
	});
	return tools;
};

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const recursiveCheckedRecordPhpEvidenceOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
		&& !path.startsWith("/") && posix.normalize(path) === path
		&& path.split("/").every(part => part && part !== "." && part !== "..")
	, path);
	const key = `${revision}:${path}`;
	if(!sources.has(key)) sources.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 64 * 1024 * 1024 }
	));
	return Buffer.from(sources.get(key));
};

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = recursiveCheckedRecordPhpEvidenceOriginal(revision, path).toString("utf8");
		files.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files];
};

let selectedSources;

/** Reconstruct every static producer/verifier module and dynamic generator input. */
export const recursiveCheckedRecordPhpEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = [
		...["LICENSE", "RecursiveCheckedRecords.lean", "lakefile.toml", "lean-toolchain", "package.json"]
			.map(path => `tests/fixtures/onboarding/recursive-checked-records/${path}`)
		, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml", "lean-toolchain", "package.json"]
			.map(path => `tests/fixtures/onboarding/mutual-checked-records/${path}`)
	];
	const producer = new Set([
		...closure(recursiveCheckedRecordPhpEvidenceProducer, [
			"tests/helpers/recursive-checked-record-php-installed-tests.mjs"
			, "scripts/select-nominal-subtype-php-ci-tools.mjs"
		])
		, ...(await recursiveCheckedRecordPhpGenerator(
			recursiveCheckedRecordPhpEvidenceProducer
		)).paths
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-php.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/run-recursive-checked-record-php-ci.sh"
		, "src/analyze/NativeExports.lean"
		, "tests/fixtures/recursive-checked-record-consumers/php-native.php"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	]);
	const verifier = new Set([
		...closure(recursiveCheckedRecordPhpEvidenceVerifier, [
			"tests/helpers/recursive-checked-record-php-controls.mjs"
			, "tests/helpers/recursive-checked-record-php-ci-report.mjs"
			, "scripts/check-recursive-checked-record-php-ci.mjs"
		])
	]);
	const shared = [...producer].filter(path => verifier.has(path));
	const record = (role, revision, path) => Object.freeze({ role, revision, path });
	selectedSources = Object.freeze([
		...[...producer].filter(path => !verifier.has(path)).sort()
			.map(path => record("producer", recursiveCheckedRecordPhpEvidenceProducer, path))
		, ...[...verifier].filter(path => !producer.has(path)).sort()
			.map(path => record("verifier", recursiveCheckedRecordPhpEvidenceVerifier, path))
		, ...shared.sort().map(path => record("shared", recursiveCheckedRecordPhpEvidenceProducer, path))
	]);
	return selectedSources;
};

/**
 * Require one accepted hosted cell's complete TAP stream and both author roots.
 *
 * @param source - Complete one-cell TAP output.
 * @param route - Ordinary source or independent review.
 * @param fixture - Recursive or mutual module.
 */
export const assertRecursiveCheckedRecordPhpEvidenceTap = (source, route, fixture) => {
	assertRecursiveCheckedRecordPhpCiTap(source, route, fixture);
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)].map(match => match[1])
		, [0, 1].map(attempt => `${route} ${fixture} author ${attempt}: reproducible Composer package`));
	for(const match of source.matchAll(/^# Waiting for (.+)$/gmu))
		assert.match(match[1], /^host load below 8 before the next recursive PHP phase: [0-9]+(?:\.[0-9]+)?$/u);
};
