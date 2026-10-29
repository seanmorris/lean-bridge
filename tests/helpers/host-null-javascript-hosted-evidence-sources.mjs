/**
 * Reconstruct the exact source closure behind hosted HostNull npm/browser
 * production, consumption, checking and archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { checkedRecordValueIndexHostedOriginal as original } from "./checked-record-value-index-hosted-evidence-sources.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const hostNullJavaScriptHostedOriginal = original;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path);
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
	"HostNullDemo.lean", "lakefile.toml", "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/host-null/${path}`);
const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select every source that explains the hosted HostNull npm/browser lane.
 *
 * @param value - Producer, consumer, checker and archiver revisions.
 */
export const hostNullJavaScriptHostedEvidenceSources = value => {
	assert.deepEqual(Object.keys(value).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(value))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: value.producer
			, paths: [
				...closure(value.producer, [
					"tests/host-null-npm-installed.test.mjs"
				])
				, ...fixture, "lean-bridge.exports.json"
				, ".github/workflows/consumer-matrix.yml"
			]
		}
		, {
			role: "consumer", revision: value.consumer
			, paths: ["tests/fixtures/host-null-consumers/npm.mjs"]
		}
		, {
			role: "checker", revision: value.checker
			, paths: closure(value.checker, [
				"tests/helpers/host-null-javascript-browser-evidence.mjs"
				, "tests/helpers/host-null-javascript-hosted-report.mjs"
				, "tests/host-null-javascript-hosted-report.test.mjs"
			])
		}
		, {
			role: "archiver", revision: value.archiver
			, paths: closure(value.archiver, [
				"scripts/archive-host-null-javascript-browser-evidence.mjs"
			])
		}
	]);
};
