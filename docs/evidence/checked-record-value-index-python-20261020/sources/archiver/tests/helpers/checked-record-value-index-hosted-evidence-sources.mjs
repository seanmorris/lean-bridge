/**
 * Reconstruct the exact source closures behind hosted value-index browser and
 * native production, consumption, checking and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

const originals = new Map();
const allowedRoots = [
	".github/", "config/", "poc/", "schema/", "scripts/", "site/", "src/"
	, "tests/"
];
const allowedFiles = new Set([
	"LICENSE", "lean-toolchain", "package-lock.json", "package.json"
]);

/**
 * Read one exact Git blob without consulting mutable worktree bytes.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Normalized repository-relative path.
 */
export const checkedRecordValueIndexHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path)
		|| allowedRoots.some(root => path.startsWith(root)), path);
	const key = `${revision}:${path}`;
	if(!originals.has(key)) originals.set(key, execFileSync(
		"git", ["cat-file", "blob", key], { maxBuffer: 64 * 1024 ** 2 }
	));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = checkedRecordValueIndexHostedOriginal(revision, path);
		paths.add(path);
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

const fixture = [
	"CheckedRecordValueIndices.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/checked-record-value-indices/${path}`);
const browserCallers = [
	"browser.mjs", "full.mts", "javascript.mjs", "result-only.mts"
].map(path => `tests/fixtures/checked-record-value-index-browser/${path}`);
const nativeCallers = [
	"c.c", "cpp.cpp", "result-only-c.c", "result-only-cpp.cpp"
].map(path => `tests/fixtures/checked-record-value-index-native/${path}`);
const jvmCallers = ["java.java", "kotlin.kt"].map(
	path => `tests/fixtures/checked-record-value-index-jvm/${path}`
);
const perlCallers = ["perl.pl"].map(
	path => `tests/fixtures/checked-record-value-index-perl/${path}`
);
const phpCallers = ["php.php"].map(
	path => `tests/fixtures/checked-record-value-index-php/${path}`
);
const pythonCallers = ["python.py"].map(
	path => `tests/fixtures/checked-record-value-index-python/${path}`
);
const commonData = [
	...fixture, "src/analyze/NativeExports.lean", "lean-toolchain"
	, "package-lock.json", "package.json"
];
const boundedApt = ".github/actions/bounded-apt/action.yml";

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select every source whose bytes explain the hosted browser artifact.
 *
 * @param revisions - Producer, npm checker, consumer, checker and archiver.
 */
export const checkedRecordValueIndexBrowserEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "npmChecker", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-browser-installed-tests.mjs"
				])
				, ...commonData, ...browserCallers
			]
		}
		, {
			role: "npm-checker", revision: revisions.npmChecker
			, paths: closure(
				revisions.npmChecker, [
					"tests/helpers/checked-record-value-index-browser-report.mjs"
					, "tests/helpers/checked-record-value-index-browser-installed-tests.mjs"
				]
			)
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-browser.mjs"
				])
				, ...browserCallers, "package-lock.json", "package.json"
				, "site/serve.mjs"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-browser-ci.mjs"
					, "tests/checked-record-value-index-browser.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-browser.yml"
				, "scripts/bootstrap-toolchains.sh"
				, "scripts/build-lean-link-spike.sh", "scripts/env.sh"
				, "scripts/install-playwright-browsers.sh"
				, "scripts/run-checked-record-value-index-browser-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(
				revisions.archiver, [
					"scripts/archive-checked-record-value-index-browser-evidence.mjs"
					, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
				]
			)
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted C/C++ artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver.
 */
export const checkedRecordValueIndexNativeEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-native-installed-tests.mjs"
				])
				, ...commonData, ...nativeCallers
				, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
				, "poc/lean-link-spike/graph-lock.json"
				, "src/backends/c/gmp.source.tar.xz"
				, "src/backends/cpp/boost.source.json"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-native-fixture.mjs"
				])
				, ...nativeCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-native-ci.mjs"
					, "tests/checked-record-value-index-native.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-native.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-checked-record-value-index-native-ci.sh"
				, "scripts/snapshot-checked-record-value-index-native.mjs"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(
				revisions.archiver, [
					"scripts/archive-checked-record-value-index-native-evidence.mjs"
					, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
				]
			)
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted Java/Kotlin artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const checkedRecordValueIndexJvmEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-jvm-installed-tests.mjs"
				])
				, ...commonData, ...jvmCallers
				, ".github/workflows/checked-record-value-index-jvm.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-checked-record-value-index-jvm-ci.sh"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-jvm-fixture.mjs"
				])
				, ...jvmCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-jvm-ci.mjs"
					, "tests/checked-record-value-index-jvm.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-jvm.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-checked-record-value-index-jvm-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-checked-record-value-index-jvm-evidence.mjs"
				, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted Perl CPAN artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const checkedRecordValueIndexPerlEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-perl-installed-tests.mjs"
				])
				, ...commonData, ...perlCallers
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-perl-fixture.mjs"
				])
				, ...perlCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-perl-ci.mjs"
					, "tests/checked-record-value-index-perl.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-perl.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/build-perl-toolchains.mjs"
				, "scripts/env.sh", "scripts/run-checked-record-value-index-perl-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-checked-record-value-index-perl-evidence.mjs"
				, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted native-PHP artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const checkedRecordValueIndexPhpEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-php-installed-tests.mjs"
				])
				, ...commonData, ...phpCallers
				, "src/backends/php/brick-math.source.json"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-php-fixture.mjs"
				])
				, ...phpCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-php-ci.mjs"
					, "tests/checked-record-value-index-php.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-php.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-checked-record-value-index-php-ci.sh"
				, "scripts/select-nominal-subtype-php-ci-tools.mjs"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-checked-record-value-index-php-evidence.mjs"
				, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
			]).concat("tests/helpers/checked-record-value-index-php-controls.mjs")
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted Python wheel artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const checkedRecordValueIndexPythonEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/checked-record-value-index-python-installed-tests.mjs"
				])
				, ...commonData, ...pythonCallers
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/checked-record-value-index-python-fixture.mjs"
				])
				, ...pythonCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-checked-record-value-index-python-ci.mjs"
					, "tests/checked-record-value-index-python.test.mjs"
				])
				, boundedApt
				, ".github/workflows/checked-record-value-index-python.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-checked-record-value-index-python-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-checked-record-value-index-python-evidence.mjs"
				, "tests/helpers/checked-record-value-index-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};
