/**
 * Reconstruct the frozen source closure behind hosted inherited checked-record
 * WIT production, checking, and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nominalSubtypeWitGenerator } from "./nominal-subtype-wit-generators.mjs";

const originals = new Map();
const allowedRoots = [
	".github/", "config/", "docs/", "schema/", "scripts/", "site/", "src/", "tests/"
];
const allowedFiles = new Set(["lean-toolchain", "package-lock.json", "package.json"]);
const sourceKey = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path)
		|| allowedRoots.some(root => path.startsWith(root)), path);
	return `${revision}:${path}`;
};

/**
 * Read one exact Git blob from a frozen revision.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Normalized repository-relative source path.
 */
export const inheritedCheckedRecordWitOriginal = (revision, path) => {
	const key = sourceKey(revision, path);
	if(!originals.has(key)) originals.set(key, execFileSync(
		"git", ["cat-file", "blob", key], { maxBuffer: 64 * 1024 ** 2 }
	));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = inheritedCheckedRecordWitOriginal(revision, path);
		paths.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

const fixture = [
	"LICENSE", "InheritedCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/inherited-checked-records/${path}`);
const caller = ["wit-wasi.c", "wit-values.h"].map(path =>
	`tests/fixtures/inherited-checked-record-consumers/${path}`);

/**
 * Select every frozen source whose bytes explain one hosted artifact.
 *
 * @param revisions - Independent producer, checker, and archiver revisions.
 */
export const inheritedCheckedRecordWitEvidenceSources = async revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const generator = await nominalSubtypeWitGenerator(revisions.producer);
	const roles = [
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/inherited-checked-record-wit-installed-tests.mjs"
				])
				, ...generator.paths, ...fixture, ...caller
				, ".github/actions/bounded-apt/action.yml"
				, ".github/workflows/inherited-checked-record-wit.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-inherited-checked-record-wit-ci.sh"
				, "lean-toolchain", "package-lock.json", "package.json"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker, [
				"scripts/check-inherited-checked-record-wit-ci.mjs"
			])
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-inherited-checked-record-wit-evidence.mjs"
				, "tests/helpers/inherited-checked-record-wit-evidence-tests.mjs"
			])
		}
	];
	return Object.freeze(roles.flatMap(({ role, revision, paths }) =>
		[...new Set(paths)].sort().map(path => Object.freeze({
			role, revision, path
		}))
	));
};
