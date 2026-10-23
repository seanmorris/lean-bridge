/**
 * Select exact producer, consumer, checker and archiver source closures for
 * generic-Subtype hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	callbackSubtypeHostedOriginal
} from "./callback-subtype-hosted-evidence-sources.mjs";
import {
	genericSubtypeHostedContract
} from "./generic-subtype-hosted-contracts.mjs";

export const genericSubtypeHostedOriginal = callbackSubtypeHostedOriginal;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = genericSubtypeHostedOriginal(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths];
};

const fixture = [
	"NominalSubtypes.lean", "lakefile.toml", "lean-toolchain"
	, "lean-bridge.exports.json"
].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`);
const common = [
	...fixture
	, "tests/fixtures/generic-subtype-compositions/GenericCompositions.lean"
	, "lean-toolchain", "package-lock.json", "package.json"
	, "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/build/ResolveLakeWorkspace.lean"
];
const workflowCommon = [
	".github/actions/bounded-apt/action.yml", "scripts/bootstrap-toolchains.sh"
	, "scripts/env.sh"
];
const consumer = name => `tests/fixtures/generic-subtype-consumers/${name}`;
const consumers = Object.freeze({
	"npm-ordinary": ["browser.mjs", "javascript.mjs"]
	, "npm-reviewed": ["browser.mjs", "javascript.mjs"]
	, foundation: []
	, native: ["c.c", "cpp.cpp"]
	, perl: ["perl.pl"]
	, python: ["python.py"]
	, ruby: ["ruby.rb"]
	, rust: ["rust.rs"]
	, dotnet: ["dotnet.cs"]
	, jvm: ["java.java", "kotlin.kt"]
	, "php-native": ["php-native.php"]
	, "wit-wasi": ["wit-wasi.c"]
});
const entries = Object.freeze({
	"npm-ordinary": ["tests/generic-subtype-npm-browser.test.mjs"]
	, "npm-reviewed": ["tests/generic-subtype-npm-browser.test.mjs"]
	, foundation: [
		"tests/helpers/nominal-subtype-selection-tests.mjs"
		, "tests/helpers/nominal-subtype-native-tests.mjs"
		, "tests/helpers/dependent-generic-subtype-source-history-tests.mjs"
		, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	]
	, native: ["tests/helpers/nominal-subtype-native-installed-tests.mjs"
		, "scripts/check-generic-subtype-native-perl-ci.mjs"]
	, perl: ["tests/helpers/nominal-subtype-perl-installed-tests.mjs"
		, "scripts/check-generic-subtype-native-perl-ci.mjs"]
	, python: ["tests/helpers/nominal-subtype-python-installed-tests.mjs"
		, "scripts/check-generic-subtype-language-ci.mjs"]
	, ruby: ["tests/helpers/nominal-subtype-ruby-installed-tests.mjs"
		, "scripts/check-generic-subtype-language-ci.mjs"]
	, rust: ["tests/helpers/nominal-subtype-rust-installed-tests.mjs"
		, "scripts/check-generic-subtype-language-ci.mjs"]
	, dotnet: ["tests/helpers/nominal-subtype-dotnet-installed-tests.mjs"
		, "scripts/check-generic-subtype-managed-wit-ci.mjs"]
	, jvm: ["tests/helpers/nominal-subtype-jvm-installed-tests.mjs"
		, "scripts/check-generic-subtype-managed-wit-ci.mjs"]
	, "php-native": ["tests/helpers/nominal-subtype-php-installed-tests.mjs"
		, "scripts/check-generic-subtype-managed-wit-ci.mjs"]
	, "wit-wasi": ["tests/helpers/nominal-subtype-wit-installed-tests.mjs"
		, "scripts/check-generic-subtype-managed-wit-ci.mjs"]
});
const runScript = Object.freeze({
	native: "scripts/run-generic-subtype-native-ci.sh"
	, perl: "scripts/run-generic-subtype-perl-ci.sh"
	, python: "scripts/run-generic-subtype-python-ci.sh"
	, ruby: "scripts/run-generic-subtype-ruby-ci.sh"
	, rust: "scripts/run-generic-subtype-rust-ci.sh"
	, dotnet: "scripts/run-generic-subtype-dotnet-ci.sh"
	, jvm: "scripts/run-generic-subtype-jvm-ci.sh"
	, "php-native": "scripts/run-generic-subtype-php-ci.sh"
	, "wit-wasi": "scripts/run-generic-subtype-wit-ci.sh"
});
const perlTemplates = [
	"Build.pm", "BuildCallbackResults.pm", "OwnedAssets.pm", "Platform.pm"
	, "Runtime.pm", "Runtime.xs", "runtime.h"
].map(path => `src/backends/perl/${path}`);

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select exact source roles for one generic-Subtype archive.
 *
 * @param lane - Closed hosted lane name.
 * @param revisions - Revision for each retained role.
 */
export const genericSubtypeEvidenceSources = (lane, revisions) => {
	const contract = genericSubtypeHostedContract(lane);
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "consumer", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const selectedConsumers = consumers[lane].map(consumer);
	const producerEntries = entries[lane];
	assert.ok(producerEntries?.length > 0);
	const producerPaths = [
		...closure(revisions.producer, producerEntries)
		, ...common, ...selectedConsumers, contract.workflow, ...workflowCommon
		, ...runScript[lane] ? [runScript[lane]] : []
		, ...lane.startsWith("npm-") ? [
			"flake.lock", "flake.nix", "scripts/build-lean-link-spike.sh"
			, "scripts/install-playwright-browsers.sh", "nix/wasm-toolchain.nix"
		] : []
		, ...lane === "perl" ? ["scripts/build-perl-toolchains.mjs"
			, ...perlTemplates] : []
		, ...lane === "rust" ? ["scripts/bootstrap-rust-ci.sh"
			, "src/backends/rust/dependencies.lock"] : []
		, ...lane === "wit-wasi" ? ["flake.lock", "flake.nix"
			, "nix/wasm-toolchain.nix"] : []
	];
	return freeze([
		{ role: "producer", revision: revisions.producer, paths: producerPaths }
		, { role: "consumer", revision: revisions.consumer
			, paths: selectedConsumers }
		, { role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker
				, ["tests/helpers/generic-subtype-hosted-output.mjs"]) }
		, { role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver
				, ["scripts/archive-generic-subtype-evidence.mjs"]) }
	]);
};
