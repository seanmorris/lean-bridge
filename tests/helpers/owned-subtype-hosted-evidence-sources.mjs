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
import {
	assertOwnedCheckedRecordNpmProducer, selectOwnedCheckedRecordWorkflow
} from "./owned-checked-record-npm-producer.mjs";

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
const javascriptEntries = [
	"tests/javascript-wasm-compiler-inputs.test.mjs"
	, "tests/owned-javascript-cli.test.mjs"
	, "tests/owned-javascript-wasm-build.test.mjs"
	, "tests/owned-javascript-wasm-model.test.mjs"
	, "tests/owned-subtype-javascript-packaging.test.mjs"
	, "scripts/check-owned-subtype-javascript-ci.mjs"
	, "scripts/binding-ir.mjs", "scripts/generate-lean-link-projection.mjs"
	, "scripts/resolve-lean-graph.mjs", "scripts/generate-value-frame.mjs"
	, "scripts/generate-owned-wasm-broker.mjs", "scripts/verify-lean-artifacts.mjs"
];
const javascriptAssets = revision => {
	const graphPath = "poc/lean-link-spike/graph-lock.json";
	const graph = JSON.parse(ownedSubtypeHostedOriginal(revision, graphPath));
	const graphInputs = graph.libraries.flatMap(library =>
		["capsule", "source", "shim", "bindingIr"].filter(key => library[key])
			.map(key => `poc/lean-link-spike/${library[key].path}`));
	return [graphPath, ...graphInputs, "config/cli-package.v1.json"
		, "scripts/build-lean-link-spike.sh", "scripts/build-lean-runtime.sh"
		, "scripts/lean-runtime-config.sh", "scripts/install-playwright-browsers.sh"
		, "poc/lean-link-spike/main.c", "poc/lean-link-spike/runtime_lifecycle.cpp"
		, "poc/lean-link-spike/component_scalar.cpp"
		, "poc/lean-link-spike/component_scalar.h"
		, "patches/lean4-4.32.2-emscripten-runtime-signatures.patch"
		, "patches/lean4-4.32.2-emscripten-conditional-pthreads.patch"
		, "patches/lean4-4.32.2-offline-libuv-source.patch"];
};

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select producer, consumer, checker and archiver source roles.
 *
 * @param lane - Owned-Subtype hosted lane.
 * @param revisions - Exact revision for each source role.
 * @param workflow - Authenticated recurring or scoped producer workflow.
 */
export const ownedSubtypeEvidenceSources = (lane, revisions, workflow) => {
	assert.ok(ownedSubtypeHostedLaneNames.includes(lane), lane);
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "consumer", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const contract = ownedSubtypeHostedContracts[lane];
	const selectedWorkflow = selectOwnedCheckedRecordWorkflow(contract, workflow);
	if(selectedWorkflow !== contract.workflow)
		assertOwnedCheckedRecordNpmProducer(
			ownedSubtypeHostedOriginal(revisions.producer, selectedWorkflow).toString("utf8")
			, ownedSubtypeHostedOriginal(revisions.producer, contract.workflow).toString("utf8"));
	const javascript = lane === "javascript";
	const selectedConsumers = javascript ? [contract.test] : consumers[lane].map(structured);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [...javascript ? javascriptEntries : [contract.test]
					, ...lane === "perl"
						? ["scripts/build-perl-toolchains.mjs"] : []])
				, ...common, ...selectedConsumers, contract.workflow
				, ...selectedWorkflow === contract.workflow ? [] : [selectedWorkflow]
				, ...workflowCommon
				, ...javascript ? javascriptAssets(revisions.producer) : []
				, ...lane === "perl" ? perlTemplates : []
				, ...lane === "languages" ? ["scripts/bootstrap-rust-ci.sh"
					, "src/backends/rust/dependencies.lock"] : []
				, ...lane === "wit-wasi" ? ["flake.lock", "flake.nix"
					, "nix/wasm-toolchain.nix"] : []
			]
		}
		, { role: "consumer", revision: revisions.consumer
			, paths: javascript ? closure(revisions.consumer, selectedConsumers) : selectedConsumers }
		, { role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker
				, ["tests/helpers/owned-subtype-hosted-output.mjs"]) }
		, { role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver
				, ["scripts/archive-owned-subtype-evidence.mjs"]) }
	]);
};
