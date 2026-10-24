/**
 * Independently recheck one retained native-PHP value-index acceptance route.
 * A green producer TAP alone is not package or artifact evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { isAbsolute, posix } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	checkedRecordValueIndexPhpCallerArgs, checkedRecordValueIndexPhpRoutes
	, checkedRecordValueIndexPhpSelection, parseCheckedRecordValueIndexPhpResult
} from "./checked-record-value-index-php-fixture.mjs";
import { assertNominalSubtypePhpToolRecords } from "./nominal-subtype-php-tool-records.mjs";
import { moduleAtProducer } from "./producer-module.mjs";

/**
 * Return the exact installed test name for one closed route.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 */
export const checkedRecordValueIndexPhpCiTestName = route => {
	assert.ok(checkedRecordValueIndexPhpRoutes.includes(route));
	return `installed value-index checked-record PHP packages reproduce and relocate for ${route}`;
};

/**
 * Parse the complete closed hosted-checker command line.
 *
 * @param args - Arguments after the checker script path.
 */
export const parseCheckedRecordValueIndexPhpCiArgs = args => {
	const usage = "Usage: check-checked-record-value-index-php-ci.mjs --route <closed-route> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --php /absolute/php --composer /absolute/composer --php-version <exact> --composer-version <exact>";
	const allowed = ["route", "producer", "directory", "tap", "glibc", "php", "composer", "php-version", "composer-version"];
	const selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length
			&& !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	checkedRecordValueIndexPhpCiTestName(selected.route); assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.match(selected.glibc, /^2\.[0-9]+$/u);
	for(const key of ["php", "composer"])
		assert.ok(isAbsolute(selected[key]) && posix.normalize(selected[key]) === selected[key], usage);
	assert.match(selected["php-version"], /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	assert.match(selected["composer-version"], /^2\.[0-9]+\.[0-9]+$/u);
	return selected;
};

/**
 * Require the exact one-route zero-skip Node TAP stream.
 *
 * @param source - Complete original Node TAP output.
 * @param route - Exact closed producer route.
 */
export const assertCheckedRecordValueIndexPhpCiTap = (source, route) => {
	const name = checkedRecordValueIndexPhpCiTestName(route);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]])
		, [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

const sourceAt = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`]);
const memberIdentity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Bind the complete immutable author-input inventory without treating its
 * timestamp fields as reproducible source content.
 *
 * @param producerCommit - Immutable producer revision.
 * @param selection - Closed route selection.
 */
const checkedRecordValueIndexPhpAuthorInputs = (producerCommit, selection) => {
	const root = "tests/fixtures/onboarding/checked-record-value-indices";
	const source = name => sourceAt(producerCommit, `${root}/${name}`);
	const expected = {
		"CheckedRecordValueIndices.lean": source("CheckedRecordValueIndices.lean")
		, "LICENSE": source("LICENSE")
		, "lakefile.toml": source("lakefile.toml")
		, "lean-toolchain": source("lean-toolchain")
		, "package.json": source("package.json")
		, "lean-bridge.exports.json": Buffer.from(canonicalJson(selection.configuration))
	};
	if(selection.reviewed)
		expected["api.binding-ir.json"] = Buffer.from(canonicalJson(selection.expected));
	return Object.fromEntries(Object.entries(expected).map(([path, bytes]) => [path, sha256(bytes)]));
};

/**
 * Recheck every route record without trusting the producer's control flow.
 *
 * @param read - Selection-relative retained-byte reader.
 * @param root0 - Independent checker inputs.
 * @param root0.route - Exact ordinary/reviewed and full/result-only route.
 * @param root0.producerCommit - Immutable producer commit.
 * @param root0.runtime - Current Linux runtime facts.
 * @param root0.floor - Explicit selected glibc floor.
 * @param root0.phpVersion - Exact selected PHP version.
 * @param root0.composerVersion - Exact selected Composer version.
 * @param root0.tools - Freshly measured trusted PHP and Composer tools.
 */
export const checkCheckedRecordValueIndexPhpReport = async (read, {
	route, producerCommit, runtime, floor, phpVersion, composerVersion, tools
}) => {
	assert.ok(checkedRecordValueIndexPhpRoutes.includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.deepEqual([runtime.platform, runtime.arch], ["linux", "x64"]);
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`); return value;
	};
	const selection = checkedRecordValueIndexPhpSelection(route), report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged"
		, "builds"
		, "compilerFreeReplay"
		, "configuration"
		, "consumerSourceRequired"
		, "declaredGlibcFloor"
		, "dispatch"
		, "expectedBindingIrSha256"
		, "independentBuilds"
		, "loadCeiling"
		, "observations"
		, "offlineInstall"
		, "packageReceiptSha256"
		, "producerCommit"
		, "receipt"
		, "relocatedInstallation"
		, "reproducible"
		, "resourceChecks"
		, "route"
		, "runtime"
		, "schemaVersion"
		, "sourceRemovedBeforeInstallation", "tools"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.runtime, { platform: runtime.platform, arch: runtime.arch, glibc: `glibc ${runtime.glibc}` });
	assert.equal(report.declaredGlibcFloor, floor); assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	assert.deepEqual(report.configuration, selection.configuration); assert.equal(report.independentBuilds, 2);
	assert.deepEqual(await json("configuration.json"), selection.configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), selection.expected);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation", "consumerSourceRequired"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No PHP constructor/source entry counters in this installed acceptance" });
	assert.ok([8, 12, 16, 20].includes(report.loadCeiling)); assert.equal(report.resourceChecks.length, 8);
	assert.deepEqual(await json("resources.json"), report.resourceChecks);
	assert.deepEqual(await json("tools.json"), report.tools); assert.deepEqual(report.tools, tools);
	assertNominalSubtypePhpToolRecords(tools, { phpVersion, composerVersion });
	assert.deepEqual(await json("runtime.json"), report.runtime);
	const modelHashes = [];
	const expectedInputs = checkedRecordValueIndexPhpAuthorInputs(producerCommit, selection);
	for(const [index, build] of report.builds.entries())
	{
		assert.deepEqual(Object.keys(build).sort(), ["archives", "bindingIrSha256", "modelSha256", "receiptSha256"]);
		const modelBytes = await read(`build-${index}/model.json`), model = JSON.parse(modelBytes);
		assert.equal(sha256(modelBytes), build.modelSha256); assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`);
		assert.equal(receiptBytes.toString(), canonicalJson(JSON.parse(receiptBytes.toString())));
		assert.equal(sha256(receiptBytes), build.receiptSha256);
		assert.deepEqual(JSON.parse(receiptBytes), report.receipt);
		assert.deepEqual(build.archives, Object.fromEntries(report.receipt.packages.flatMap(pkg => pkg.artifacts
			.map(artifact => [artifact.path, artifact.sha256]))));
		const inputs = await json(`build-${index}/author-inputs.json`);
		assert.deepEqual(inputs.map(item => item.path), Object.keys(expectedInputs).sort());
		for(const item of inputs)
		{
			assert.deepEqual(Object.keys(item).sort(), ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.equal(item.sha256, expectedInputs[item.path]);
			assert.equal(item.mode & 0o170000, 0o100000);
			for(const key of ["ctime", "mtime"])
				assert.ok(Number.isFinite(item[key]) && item[key] > 0, `Author ${item.path} ${key}`);
		}
		assert.deepEqual(await read(`build-${index}/CheckedRecordValueIndices.lean`)
			, sourceAt(producerCommit, "tests/fixtures/onboarding/checked-record-value-indices/CheckedRecordValueIndices.lean"));
		assert.deepEqual(JSON.parse((await read(`build-${index}/lean-bridge.exports.json`)).toString())
			, selection.configuration);
		modelHashes.push(build.modelSha256);
	}
	assert.equal(new Set(modelHashes).size, 1, "Independent builds retain one model");
	assert.deepEqual(await json("handoff/package-set-receipt.json"), report.receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(await read("handoff/package-set-receipt.json")) + "  package-set-receipt.json\n");
	const pkg = report.receipt.packages[0];
	assert.deepEqual(report.receipt.packages.map(item => [item.target, item.role]), [["php-native", "component"]]);
	const archive = await read(`handoff/${pkg.artifacts[0].path}`);
	assert.deepEqual(memberIdentity(archive), { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
	const packaged = await json("package.json"); assert.deepEqual(packaged.archive, pkg.artifacts[0]);
	assert.equal(packaged.receiptSha256, report.packageReceiptSha256);
	assert.equal(new Set(packaged.retained).size, packaged.retained.length);
	assert.deepEqual(packaged.retained.slice().sort(), Object.keys(packaged.files)
		.filter(path => !path.startsWith("native/linux-x64/")).sort());
	for(const path of packaged.retained)
		assert.deepEqual(memberIdentity(await read(`package/${path}`)), packaged.files[path], `Retained package member: ${path}`);
	const firstModel = JSON.parse(await read("build-0/model.json"));
	const { generateCopiedPhpPackage } = await moduleAtProducer(
		producerCommit, "src/backends/php/copied-values.mjs");
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(firstModel.bindingIr, packaged.evidence)))
		assert.equal((await read(`package/${path}`)).toString(), source, path);
	const caller = sourceAt(producerCommit, "tests/fixtures/checked-record-value-index-php/php.php").toString();
	assert.equal((await read("consumer.php")).toString(), caller);
	const environment = await json("environment.json");
	for(const [path, expected] of Object.entries({ ...environment.inputs, ...environment.generatedFiles }))
		assert.deepEqual(memberIdentity(await read(`installation/${path}`)), expected, `Installed input: ${path}`);
	assert.equal(report.observations.length, 4);
	for(const [position, place] of ["installed", "relocated"].entries()) for(const [offset, strictness] of ["weak", "strict"].entries())
	{
		const observation = await json(`${place}-${strictness}.json`);
		assert.deepEqual(observation, report.observations[2 * position + offset]);
		assert.equal(observation.relocated, Boolean(position)); assert.equal(observation.strictness, strictness);
		assert.equal(observation.command, tools.command);
		assert.deepEqual(observation.args, [...tools.runtimeFlags, strictness === "strict" ? "strict.php" : "consumer.php", ...checkedRecordValueIndexPhpCallerArgs(route)]);
		assert.equal(observation.cwd, environment.root + (position ? "-relocated" : ""));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		parseCheckedRecordValueIndexPhpResult(observation.run.stdout, route);
		assert.deepEqual(observation.counts, parseCheckedRecordValueIndexPhpResult(observation.run.stdout, route));
	}
	const buildPaths = [
		"model.json"
		, "package-set-receipt.json"
		, "author-inputs.json"
		, "CheckedRecordValueIndices.lean"
		, "lean-bridge.exports.json"
		, ...(selection.reviewed ? ["api.binding-ir.json"] : [])];
	const records = [
		"report.json"
		, "runtime.json"
		, "resources.json"
		, "tools.json"
		, "configuration.json"
		, "expected.binding-ir.json"
		, "consumer.php"
		, "package.json"
		, "environment.json"
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, `handoff/${pkg.artifacts[0].path}`
		, ...["installed", "relocated"].flatMap(place => ["weak", "strict"].map(strictness => `${place}-${strictness}.json`))
		, ...[0, 1].flatMap(index => buildPaths.map(path => `build-${index}/${path}`))
		, ...packaged.retained.map(path => `package/${path}`)
		, ...Object.keys({ ...environment.inputs, ...environment.generatedFiles }).map(path => `installation/${path}`)].sort();
	assert.equal(new Set(records).size, records.length);
	return {
		route
		, producerCommit
		, runtime
		, floor
		, phpVersion
		, composerVersion
		, records
		, executions: 4
		, archiveSha256: pkg.artifacts[0].sha256
		, reportSha256: sha256(await read("report.json")) };
};

/**
 * Parse an original retained route and dispatch it to the independent checker.
 *
 * @param args - Checker command-line arguments.
 * @param input - Original TAP, byte reader, runtime and tool records.
 * @param input.tap - Complete original Node TAP output.
 * @param input.read - Selection-relative retained-byte reader.
 * @param input.runtime - Checker host runtime facts.
 * @param input.tools - Freshly measured trusted PHP and Composer tools.
 */
export const checkCheckedRecordValueIndexPhpCiRecords = async (args, { tap, read, runtime, tools }) => {
	const selected = parseCheckedRecordValueIndexPhpCiArgs(args);
	assertCheckedRecordValueIndexPhpCiTap(tap, selected.route);
	return checkCheckedRecordValueIndexPhpReport(read, {
		route: selected.route
		, producerCommit: selected.producer
		, runtime
		, floor: selected.glibc
		, phpVersion: selected["php-version"]
		, composerVersion: selected["composer-version"]
		, tools
	});
};
