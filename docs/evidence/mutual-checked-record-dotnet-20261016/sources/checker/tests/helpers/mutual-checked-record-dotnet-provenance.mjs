/**
 * Frozen producer identity and source closures for recursive checked-record C#.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const mutualCheckedRecordDotnetEvidence
	= "docs/evidence/mutual-checked-record-dotnet-20261016";
export const mutualCheckedRecordDotnetProducer
	= "814d8d13b1c3ec4a5bdfea5d8bfafd6b5f48bf1c";
export const mutualCheckedRecordDotnetRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const mutualCheckedRecordDotnetRecordRoots = Object.freeze({
	ordinary: "build/vo1517-mutual-dotnet-ordinary-814d8d1-records/ordinary"
	, reviewed: "build/vo1517-mutual-dotnet-reviewed-814d8d1-records/reviewed"
});

/**
 * Read one exact historical repository file.
 *
 * @param revision - Exact Git revision.
 * @param path - Repository-relative path.
 */
export const mutualCheckedRecordDotnetOriginal = (revision, path) => {
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
		const source = mutualCheckedRecordDotnetOriginal(revision, path).toString();
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
	"tests/helpers/mutual-checked-record-dotnet-installed-tests.mjs"
	, "tests/mutual-checked-record-dotnet.test.mjs"
]);
const producerExtras = Object.freeze([
	"tests/fixtures/mutual-checked-record-consumers/dotnet.cs"
	, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/mutual-checked-records/${path}`)
]);
const checkerEntries = Object.freeze([
	"scripts/archive-mutual-checked-record-dotnet.mjs"
	, "tests/helpers/mutual-checked-record-dotnet-evidence.mjs"
	, "tests/mutual-checked-record-dotnet-evidence.test.mjs"
]);

/** Complete static producer module closure plus dynamic fixture inputs. */
export const mutualCheckedRecordDotnetProducerSources = () => [
	...new Set([
		...historicalClosure(mutualCheckedRecordDotnetProducer, producerEntries)
		, ...producerExtras
	])
].sort();

/**
 * Complete static archive/checker closure at the exact archive revision.
 *
 * @param revision - Exact archive Git revision.
 */
export const mutualCheckedRecordDotnetCheckerSources = revision =>
	historicalClosure(revision, checkerEntries);
