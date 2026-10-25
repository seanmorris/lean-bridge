/**
 * Select the exact committed sources that explain one owned checked-record
 * hosted artifact: what the workflow built and executed, what each consumer
 * ran, what independently replayed the output and what archived it.
 *
 * Module closures follow import specifiers only, so assets that modules read
 * through `import.meta.url` or the workflow executes are named explicitly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { callbackSubtypeHostedOriginal } from "./callback-subtype-hosted-evidence-sources.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	assertOwnedCheckedRecordNpmProducer, selectOwnedCheckedRecordWorkflow
} from "./owned-checked-record-npm-producer.mjs";
import { requiresOwnedCheckedRecordPhpWasmContexts } from "./owned-checked-record-php-wasm-context-evidence.mjs";

export const ownedCheckedRecordHostedOriginal = callbackSubtypeHostedOriginal;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = ownedCheckedRecordHostedOriginal(revision, path);
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

const fixture = ["OwnedCheckedRecords.lean", "lakefile.toml", "lean-toolchain"]
	.map(path => `tests/fixtures/onboarding/owned-checked-records/${path}`);
const common = [...fixture, "lean-toolchain", "package-lock.json"
	, "package.json", "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/build/ResolveLakeWorkspace.lean"];
const perlTemplates = ["Build.pm", "BuildCallbackResults.pm", "OwnedAssets.pm"
	, "Platform.pm", "Runtime.pm", "Runtime.xs", "runtime.h"]
	.map(path => `src/backends/perl/${path}`);
const workflowCommon = [".github/actions/bounded-apt/action.yml"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"];
const structured = path => `tests/fixtures/structured-types/${path}`;
const languageExtensions = { python: "py", ruby: "rb", rust: "rs" };
const managedConsumers = {
	dotnet: ["dotnet.cs"], jvm: ["java.java", "kotlin.kt"], php: ["php.php"]
};

const phpWasmWorkflowInputs = ["config/cli-package.v1.json", "flake.lock"
	, "poc/lean-link-spike/bindings/php-wasm.package.json"
	, "scripts/bootstrap-php-wasm-ci.sh", "scripts/build-lean-runtime.sh"
	, "scripts/install-playwright-browsers.sh", "scripts/lean-runtime-config.sh"
	, "tests/helpers/owned-php-wasm-runtime.mjs"];

const consumers = (lane, revision) => {
	if(lane.kind === "php-wasm")
		return ["php-wasm.php", "result-only-php-wasm.php"
			, ...requiresOwnedCheckedRecordPhpWasmContexts(path =>
				ownedCheckedRecordHostedOriginal(revision, path))
				? ["php-wasm-contexts.php"] : []]
			.map(name => structured(`owned-checked-record-${name}`));
	if(lane.kind === "javascript")
		return ["tests/owned-checked-record-javascript-packaging.test.mjs"];
	if(lane.kind === "native")
		return ["installed.c", "installed.cpp", "result-only.c", "result-only.cpp"]
			.map(name => structured(`owned-checked-record-${name}`));
	if(lane.kind === "perl")
		return ["installed.pl", "result-only.pl"]
			.map(name => structured(`owned-checked-record-${name}`));
	if(lane.kind === "language")
	{
		const name = `${lane.profile}.${languageExtensions[lane.profile]}`;
		return [`owned-checked-record-${name}`
			, `owned-checked-record-result-only-${name}`].map(structured);
	}
	if(lane.group === "wit")
		return ["installed.c", "result-only.c"]
			.map(name => structured(`owned-checked-record-${name}`));
	return managedConsumers[lane.group].flatMap(name => [
		`owned-checked-record-${name}`, `owned-checked-record-result-only-${name}`
	]).map(structured);
};

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select source roles for one lane at exact revisions.
 *
 * @param laneName - Owned checked-record hosted lane.
 * @param value - Producer, consumer, checker and archiver revisions.
 * @param workflow - Exact recurring or scoped producer workflow.
 */
export const ownedCheckedRecordEvidenceSources = (laneName, value, workflow) => {
	assert.ok(ownedCheckedRecordHostedLaneNames.includes(laneName), laneName);
	assert.deepEqual(Object.keys(value).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(value))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const lane = ownedCheckedRecordHostedLanes[laneName];
	const selectedWorkflow = selectOwnedCheckedRecordWorkflow(lane, workflow);
	if(selectedWorkflow !== lane.workflow)
		assertOwnedCheckedRecordNpmProducer(
			ownedCheckedRecordHostedOriginal(value.producer, selectedWorkflow).toString("utf8")
			, ownedCheckedRecordHostedOriginal(value.producer, lane.workflow).toString("utf8")
		);
	const selectedConsumers = consumers(lane, value.producer);
	return freeze([
		{
			role: "producer", revision: value.producer
			, paths: [
				...closure(value.producer, [lane.test
					, ...lane.kind === "perl"
						? ["scripts/build-perl-toolchains.mjs"] : []])
				, ...common, ...selectedConsumers, lane.workflow, ...workflowCommon
				, ...selectedWorkflow === lane.workflow ? [] : [selectedWorkflow]
				, ...lane.kind === "perl" ? perlTemplates : []
				, ...lane.profile === "rust" ? ["scripts/bootstrap-rust-ci.sh"
					, "src/backends/rust/dependencies.lock"] : []
				, ...lane.group === "wit"
					? ["flake.lock", "flake.nix", "nix/wasm-toolchain.nix"] : []
				, ...lane.kind === "javascript" ? [
					"scripts/build-lean-link-spike.sh"
					, "scripts/install-playwright-browsers.sh"
				] : []
				, ...lane.kind === "php-wasm" ? phpWasmWorkflowInputs : []
			]
		}
		, { role: "consumer", revision: value.consumer
			, paths: lane.kind === "javascript"
				? closure(value.consumer, selectedConsumers) : consumers(lane, value.consumer) }
		, {
			role: "checker", revision: value.checker
			, paths: closure(value.checker, [
				"tests/helpers/owned-checked-record-hosted-output.mjs"
			])
		}
		, {
			role: "archiver", revision: value.archiver
			, paths: closure(value.archiver, [
				"scripts/archive-owned-checked-record-evidence.mjs"
			])
		}
	]);
};
