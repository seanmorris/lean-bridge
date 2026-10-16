/**
 * Frozen producer identity and source closures for recursive checked-record JVM packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const mutualCheckedRecordJvmEvidence
	= "docs/evidence/mutual-checked-record-jvm-20261016";
export const mutualCheckedRecordJvmProducer
	= "7215c1a3abaeaf62af412fa9f87ddef7406540dd";
export const mutualCheckedRecordJvmArchiveRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const mutualCheckedRecordJvmRecordRoots = Object.freeze({
	ordinary: "build/vo1516-mutual-jvm-ordinary-7215c1a-records/ordinary"
	, reviewed: "build/vo1516-mutual-jvm-reviewed-7215c1a-records/reviewed"
});

/**
 * Read one exact historical repository file.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative path.
 */
export const mutualCheckedRecordJvmOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.match(path, /^[A-Za-z0-9_.+/@-]+(?:\/[A-Za-z0-9_.+@-]+)*$/u);
	return execFileSync("git", ["show", `${revision}:${path}`], {
		maxBuffer: 64 * 1024 * 1024
	});
};

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = mutualCheckedRecordJvmOriginal(revision, path).toString();
		files.add(path);
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files].sort();
};

const producerEntries = Object.freeze([
	"tests/helpers/mutual-checked-record-jvm-installed-tests.mjs"
	, "tests/mutual-checked-record-jvm.test.mjs"
]);
const producerExtras = Object.freeze([
	"tests/fixtures/mutual-checked-record-consumers/java.java"
	, "tests/fixtures/mutual-checked-record-consumers/kotlin.kt"
	, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/mutual-checked-records/${path}`)
]);
const checkerEntries = Object.freeze([
	"scripts/archive-mutual-checked-record-jvm.mjs"
	, "tests/helpers/mutual-checked-record-jvm-evidence.mjs"
	, "tests/mutual-checked-record-jvm-evidence.test.mjs"
]);

/** Complete static producer module closure plus dynamic fixture inputs. */
export const mutualCheckedRecordJvmProducerSources = () => [
	...new Set([
		...historicalClosure(mutualCheckedRecordJvmProducer, producerEntries)
		, ...producerExtras
	])
].sort();

/**
 * Complete static archive/checker closure at the exact archive revision.
 *
 * @param revision - Exact archive Git revision.
 */
export const mutualCheckedRecordJvmCheckerSources = revision =>
	historicalClosure(revision, checkerEntries);
