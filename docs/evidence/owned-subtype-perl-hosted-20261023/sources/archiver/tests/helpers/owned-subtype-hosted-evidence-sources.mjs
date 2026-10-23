/**
 * Select the exact source closures that explain an owned-Subtype archive.
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
	ownedSubtypeHostedContracts, ownedSubtypeHostedLaneNames
} from "./owned-subtype-hosted-contracts.mjs";

export const ownedSubtypeHostedOriginal = callbackSubtypeHostedOriginal;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = ownedSubtypeHostedOriginal(revision, path);
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

const fixture = ["Owned.lean", "lakefile.toml", "lean-toolchain"
	, "lean-bridge.exports.json"]
	.map(path => `tests/fixtures/onboarding/owned-subtypes/${path}`);
const common = [
	...fixture
	, "lean-toolchain"
	, "package-lock.json"
	, "package.json"
	, "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/build/ResolveLakeWorkspace.lean"];
const workflowCommon = [".github/actions/bounded-apt/action.yml"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"];
const perlTemplates = ["Build.pm", "BuildCallbackResults.pm", "OwnedAssets.pm"
	, "Platform.pm", "Runtime.pm", "Runtime.xs", "runtime.h"]
	.map(path => `src/backends/perl/${path}`);
const structured = path => `tests/fixtures/structured-types/${path}`;
const consumers = Object.freeze({
	native: ["owned-subtype-installed.c", "owned-subtype-installed.cpp"]
	, perl: ["owned-perl-subtype.pl"]
	, languages: ["owned-subtype-python.py", "owned-subtype-ruby.rb"
		, "owned-subtype-rust.rs"]
	, dotnet: ["owned-subtype-dotnet.cs"]
	, jvm: ["owned-subtype-java.java", "owned-subtype-kotlin.kt"]
	, "php-native": ["owned-subtype-php.php"]
	, "wit-wasi": ["owned-subtype-installed.c"]
});

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select producer, consumer, checker and archiver source roles.
 *
 * @param lane - Owned-Subtype hosted lane.
 * @param revisions - Exact revision for each source role.
 */
export const ownedSubtypeEvidenceSources = (lane, revisions) => {
	assert.ok(ownedSubtypeHostedLaneNames.includes(lane), lane);
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "consumer", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const contract = ownedSubtypeHostedContracts[lane];
	const selectedConsumers = consumers[lane].map(structured);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [contract.test
					, ...lane === "perl"
						? ["scripts/build-perl-toolchains.mjs"] : []])
				, ...common, ...selectedConsumers, contract.workflow
				, ...workflowCommon
				, ...lane === "perl" ? perlTemplates : []
				, ...lane === "languages" ? ["scripts/bootstrap-rust-ci.sh"
					, "src/backends/rust/dependencies.lock"] : []
				, ...lane === "wit-wasi" ? ["flake.lock", "flake.nix"
					, "nix/wasm-toolchain.nix"] : []
			]
		}
		, { role: "consumer", revision: revisions.consumer
			, paths: selectedConsumers }
		, { role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker
				, ["tests/helpers/owned-subtype-hosted-output.mjs"]) }
		, { role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver
				, ["scripts/archive-owned-subtype-evidence.mjs"]) }
	]);
};
