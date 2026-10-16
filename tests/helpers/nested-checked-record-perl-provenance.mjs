/**
 * Freeze the nested checked-record Perl producer and its static source closure.
 *
 * @file
 */
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const nestedCheckedRecordPerlProducer
	= "902e5a399b777c466844b3fc09add71742e149b2";
export const nestedCheckedRecordPerlEvidence
	= "docs/evidence/nested-checked-record-perl-20261016";
export const nestedCheckedRecordPerlOriginalRoot
	= "build/vo1505-nested-record-perl-902e5a3";
export const nestedCheckedRecordPerlEvidenceCases = Object.freeze([
	"ordinary-full"
	, "ordinary-result-only"
	, "reviewed-full"
	, "reviewed-result-only"
]);

/**
 * Read one exact file from the frozen producer commit.
 *
 * @param revision - Full Git commit identity.
 * @param path - Repository-relative file path.
 */
export const nestedCheckedRecordPerlOriginal = (revision, path) => execFileSync(
	"git", ["show", `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 }
);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordPerlOriginal(revision, path).toString("utf8");
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
export const nestedCheckedRecordPerlEvidenceSources = async () => selectedSources
	??= Object.freeze([...new Set([
		...historicalClosure(nestedCheckedRecordPerlProducer, [
			"scripts/check-nested-checked-record-perl-ci.mjs"
			, "tests/helpers/nested-checked-record-perl-installed-tests.mjs"
			, "tests/helpers/nested-checked-record-perl-ci-report.mjs"
			, "scripts/build-perl-toolchains.mjs"
		])
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/nested-checked-record-perl.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/run-nested-checked-record-perl-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/perl.pl"
		, ...["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
			, "lean-toolchain", "package.json"]
			.map(path => `tests/fixtures/onboarding/nested-checked-records/${path}`)
		, "package.json", "package-lock.json", "lean-toolchain"
	])].sort());
