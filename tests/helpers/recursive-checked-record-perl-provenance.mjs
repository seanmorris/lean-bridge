/**
 * Freeze the recursive checked-record Perl producer and its static source closure.
 *
 * @file
 */
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const recursiveCheckedRecordPerlProducer
	= "c8ac44f43022c7fd49d4bb98a17cf4ae43371909";
export const recursiveCheckedRecordPerlEvidence
	= "docs/evidence/recursive-checked-record-perl-20261016";
export const recursiveCheckedRecordPerlOriginalRoot
	= "build/vo1519-recursive-perl-c8ac44f";
export const recursiveCheckedRecordPerlEvidenceCases = Object.freeze([
	"ordinary-recursive"
	, "ordinary-mutual"
	, "reviewed-recursive"
	, "reviewed-mutual"
]);

/**
 * Read one exact file from the frozen producer commit.
 *
 * @param revision - Full Git commit identity.
 * @param path - Repository-relative file path.
 */
export const recursiveCheckedRecordPerlOriginal = (revision, path) => execFileSync(
	"git", ["show", `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 }
);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = recursiveCheckedRecordPerlOriginal(revision, path).toString("utf8");
		files.add(path);
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

/** Reconstruct all static producer/checker modules and declared tool inputs. */
export const recursiveCheckedRecordPerlEvidenceSources = async () => selectedSources
	??= Object.freeze([...new Set([
		...historicalClosure(recursiveCheckedRecordPerlProducer, [
			"scripts/check-recursive-checked-record-perl-ci.mjs"
			, "tests/helpers/recursive-checked-record-perl-installed-tests.mjs"
			, "tests/helpers/recursive-checked-record-perl-ci-report.mjs"
			, "tests/helpers/recursive-checked-record-perl-records.mjs"
			, "scripts/build-perl-toolchains.mjs"
		])
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-perl.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/run-recursive-checked-record-perl-ci.sh"
		, "tests/fixtures/recursive-checked-record-consumers/perl.pl"
		, ...[
			["recursive-checked-records", "RecursiveCheckedRecords.lean"]
			, ["mutual-checked-records", "MutualCheckedRecords.lean"]
		].flatMap(([directory, module]) => [
			"LICENSE", module, "lakefile.toml", "lean-toolchain", "package.json"
		].map(path => `tests/fixtures/onboarding/${directory}/${path}`))
		, "package.json", "package-lock.json", "lean-toolchain"
	])].sort());
