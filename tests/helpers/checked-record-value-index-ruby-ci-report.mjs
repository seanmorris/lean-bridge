/**
 * Independently check one retained value-index checked-record Ruby acceptance
 * selection. The checker closes both the hosted TAP and every retained fact it
 * uses; it does not trust producer success as evidence of a complete replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { assertCheckedRecordValueIndexRubyIdentity } from "./checked-record-value-index-ruby-package.mjs";
import {
	checkedRecordValueIndexRubyCallerArgs
	, checkedRecordValueIndexRubyCounts
	, checkedRecordValueIndexRubyRoutes
	, parseCheckedRecordValueIndexRubyResult
} from "./checked-record-value-index-ruby-fixture.mjs";
import { checkedRecordValueIndexBrowserSelection } from "./checked-record-value-index-browser-fixture.mjs";

/**
 * Name the one installed route a retained Ruby TAP stream must cover.
 *
 * @param route - One closed ordinary/reviewed and full/result-only route.
 */
export const checkedRecordValueIndexRubyCiTestName = route => {
	assert.ok(checkedRecordValueIndexRubyRoutes.includes(route));
	return `installed value-index checked-record Ruby packages reproduce and relocate ${route}`;
};

/**
 * Parse the closed hosted checker arguments before opening any record.
 *
 * @param args - Arguments after the checker script path.
 */
export const parseCheckedRecordValueIndexRubyCiArgs = args => {
	const usage = "Usage: check-checked-record-value-index-ruby-ci.mjs --route <closed-route> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --ruby /absolute/ruby";
	const allowed = ["route", "producer", "directory", "tap", "glibc", "ruby"], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0
			&& !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	checkedRecordValueIndexRubyCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u); assert.match(selected.glibc, /^2\.[0-9]+$/u);
	assert.ok(isAbsolute(selected.ruby) && posix.normalize(selected.ruby) === selected.ruby
		&& !/[\n\r]/u.test(selected.ruby), usage);
	return selected;
};

/**
 * Reject partial, skipped, or differently named hosted producer TAP.
 *
 * @param source - Combined original producer output.
 * @param route - Required closed route.
 */
export const assertCheckedRecordValueIndexRubyCiTap = (source, route) => {
	const name = checkedRecordValueIndexRubyCiTestName(route);
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

const receiptComponent = receipt => {
	assert.equal(receipt.schemaVersion, 1); assert.ok(Array.isArray(receipt.packages));
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0];
	assert.deepEqual(Object.keys(pkg).sort(), [
		"artifacts"
		, "ecosystem"
		, "name"
		, "profile"
		, "requires"
		, "role"
		, "runtimeDelivery"
		, "runtimeIdentity"
		, "target"
		, "version"
	]);
	assert.equal(pkg.target, "rubygems"); assert.equal(pkg.artifacts.length, 1);
	return pkg;
};

/**
 * Independently recheck source, both builds, archive identity, and the two
 * immutable consumer executions from one retained Ruby route directory.
 *
 * @param read - Reader for records relative to the closed route directory.
 * @param root0 - Closed route, producer and host facts.
 * @param root0.route - One closed ordinary/reviewed and full/result-only route.
 * @param root0.producerCommit - Immutable 40-character producer revision.
 * @param root0.runtime - Independently observed platform, architecture, and glibc.
 * @param root0.floor - Explicit native package glibc floor.
 * @param root0.interpreter - Freshly queried selected MRI identity and version.
 */
export const checkCheckedRecordValueIndexRubyReport = async (read, {
	route, producerCommit, runtime, floor, interpreter
}) => {
	assert.ok(checkedRecordValueIndexRubyRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.deepEqual([runtime.platform, runtime.arch], ["linux", "x64"]);
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.slice(2)) >= Number(floor.slice(2)));
	assert.deepEqual(Object.keys(interpreter).sort(), ["command", "identity", "run"]);
	assert.ok(isAbsolute(interpreter.command)); assert.equal(interpreter.run.stderr, "");
	const ruby = JSON.parse(interpreter.run.stdout);
	assert.deepEqual(ruby.engine, "ruby"); assert.match(ruby.version, /^3\.3\.[0-9]+$/u);
	assert.equal(ruby.platform, "x86_64-linux");
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
		return value;
	};
	const selection = checkedRecordValueIndexBrowserSelection(route), mode = selection.resultOnly ? "result-only" : "full";
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged"
		, "builds"
		, "compilerFreeReplay"
		, "declaredGlibcFloor"
		, "expectedBindingIrSha256"
		, "gemReceiptSha256"
		, "independentBuilds"
		, "interpreter"
		, "loadCeiling"
		, "mode"
		, "observations"
		, "offlineInstall"
		, "producerCommit"
		, "receipt"
		, "relocatedInstallation"
		, "reproducible"
		, "resourceChecks"
		, "route"
		, "runtime"
		, "schemaVersion"
		, "sourceRemovedBeforeInstallation"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	for(const key of [
		"reproducible"
		, "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay"
		, "relocatedInstallation"
	])
		assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(await json("interpreter.json"), interpreter); assert.deepEqual(report.interpreter, interpreter);
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(await json("runtime.json"), runtimeRecord); assert.deepEqual(report.runtime, runtimeRecord);
	assert.deepEqual(await json("expected.binding-ir.json"), selection.expected);
	assert.deepEqual(await json("configuration.json"), { ...selection.configuration
		, targets: { rubygems: { name: "checkedrecordvalueindices", version: "1.0.0" } } });
	const resources = await json("resources.json");
	assert.deepEqual(report.resourceChecks, resources); assert.equal(resources.length, 6);
	assert.ok([8, 12, 16, 20].includes(report.loadCeiling));
	let modelSha256, receiptSha256, archives;
	for(const [index, build] of report.builds.entries())
	{
		assert.deepEqual(Object.keys(build).sort(), ["archives", "bindingIrSha256", "modelSha256", "receiptSha256"]);
		const modelBytes = await read(`build-${index}/model.json`), model = JSON.parse(modelBytes);
		assert.equal(modelBytes.toString(), canonicalJson(model));
		assert.equal(build.bindingIrSha256, model.bindingIrSha256); assert.equal(build.modelSha256, sha256(modelBytes));
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = JSON.parse(receiptBytes);
		assert.equal(receiptBytes.toString(), canonicalJson(receipt)); assert.equal(build.receiptSha256, sha256(receiptBytes));
		const authorInputs = await json(`build-${index}/author-inputs.json`);
		assert.ok(Object.keys(authorInputs).length > 0, "Empty retained author-input state");
		assert.equal((await read(`build-${index}/CheckedRecordValueIndices.lean`)).length > 0, true);
		assert.deepEqual(await json(`build-${index}/lean-bridge.exports.json`)
			, await json("configuration.json"));
		if(selection.reviewed) assert.deepEqual(await json(`build-${index}/api.binding-ir.json`), selection.expected);
		const component = receiptComponent(receipt);
		assert.deepEqual(build.archives, Object.fromEntries(component.artifacts.map(artifact => [artifact.path, artifact.sha256])));
		if(index === 0)
		{
			modelSha256 = build.modelSha256;
			receiptSha256 = build.receiptSha256;
			archives = build.archives;
		}
		else
		{
			assert.equal(build.modelSha256, modelSha256);
			assert.equal(build.receiptSha256, receiptSha256);
			assert.deepEqual(build.archives, archives);
		}
	}
	const handoffReceipt = await json("handoff/package-set-receipt.json");
	assert.deepEqual(report.receipt, handoffReceipt);
	assert.equal(sha256(canonicalJson(handoffReceipt)), receiptSha256);
	assert.equal(Buffer.from(await read("handoff/package-set-receipt.json.sha256")).toString().trim()
		, sha256(canonicalJson(handoffReceipt)));
	const pkg = receiptComponent(handoffReceipt), model = JSON.parse(await read("build-0/model.json"));
	const archive = pkg.artifacts[0], archiveBytes = await read(`handoff/${archive.path}`);
	assert.deepEqual({ bytes: archiveBytes.length, sha256: sha256(archiveBytes) }, { bytes: archive.bytes, sha256: archive.sha256 });
	const gem = await json("gem.json"), gemReceipt = JSON.parse(await read("package/lean-bridge/package-receipt.json"));
	assert.deepEqual(gem.archive, archive);
	assert.equal(report.gemReceiptSha256, gem.receiptSha256);
	assertCheckedRecordValueIndexRubyIdentity(gemReceipt, pkg, model, floor);
	const packageFiles = {
		...gemReceipt.files
		, "lean-bridge/package-receipt.json": { bytes: Buffer.byteLength(canonicalJson(gemReceipt))
			, sha256: sha256(canonicalJson(gemReceipt)) }
	};
	assert.deepEqual(gem.files, packageFiles);
	const retained = Object.keys(packageFiles).filter(path => !path.startsWith(
		"lib/lean_bridge/checkedrecordvalueindices/native/linux-x64/"
	)).sort();
	assert.deepEqual(gem.retained, retained);
	for(const path of retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, packageFiles[path]);
	}
	const environment = await json("environment.json"), installedGemspec = await read("installed.gemspec");
	const fullName = `${pkg.name}-${pkg.version}-x86_64-linux`;
	const environmentFiles = Object.fromEntries([
		...Object.entries(packageFiles).map(([path, file]) => [`gems/${fullName}/${path}`, file])
		, [`cache/${fullName}.gem`, { bytes: archive.bytes, sha256: archive.sha256 }]
		, [`specifications/${fullName}.gemspec`, { bytes: installedGemspec.length, sha256: sha256(installedGemspec) }]
	]);
	assert.deepEqual(environment, {
		gems: environment.gems
		, command: interpreter.command
		, fullName
		, receiptBytes: canonicalJson(gemReceipt)
		, interpreter: interpreter.identity
		, files: environmentFiles
		, expectedSha256: sha256(canonicalJson(environmentFiles))
	});
	assert.ok(isAbsolute(environment.gems));
	assert.deepEqual(gem.closure, {
		receiptSha256: gem.receiptSha256
		, packageFileSetSha256: sha256(canonicalJson(Object.keys(packageFiles).sort()))
		, environmentSha256: environment.expectedSha256
		, interpreterSha256: interpreter.identity.sha256
		, gemspecSha256: environmentFiles[`specifications/${fullName}.gemspec`].sha256
	});
	assert.equal((await read("consumer.rb", "utf8")).includes("Independent Ruby caller"), true);
	assert.equal(report.observations.length, 2);
	const args = ["consumer.rb", ...checkedRecordValueIndexRubyCallerArgs(route)];
	for(const [index, position] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${position}.json`); assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(observation.args, args); assert.equal(observation.relocated, Boolean(index));
		assert.equal(observation.command, interpreter.command); assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(observation.closure, gem.closure);
		assert.deepEqual(observation.counts, checkedRecordValueIndexRubyCounts[mode]);
		assert.deepEqual(parseCheckedRecordValueIndexRubyResult(observation.run.stdout, mode), checkedRecordValueIndexRubyCounts[mode]);
	}
	const recordPaths = [
		"run.tap"
		, "report.json"
		, "runtime.json"
		, "interpreter.json"
		, "resources.json"
		, "expected.binding-ir.json"
		, "configuration.json"
		, "consumer.rb"
		, "gem.json"
		, "environment.json"
		, "installed.gemspec"
		, "installed.json"
		, "relocated.json"
		, ...[0, 1].flatMap(index => [
			`build-${index}/model.json`
			, `build-${index}/package-set-receipt.json`
			, `build-${index}/author-inputs.json`
			, `build-${index}/CheckedRecordValueIndices.lean`
			, `build-${index}/lean-bridge.exports.json`
			, ...selection.reviewed ? [`build-${index}/api.binding-ir.json`] : []
		])
		, ...retained.map(path => `package/${path}`)
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, `handoff/${archive.path}`
	];
	return {
		route
		, producerCommit
		, runtime
		, floor
		, rubyVersion: ruby.version
		, mode
		, executions: 2
		, records: recordPaths.length
		, archiveSha256: archive.sha256
		, reportSha256: sha256(await read("report.json"))
	};
};

/**
 * Parse closed options, reject partial TAP, then run the independent checker.
 *
 * @param args - Arguments after the checker script path.
 * @param root0 - Original retained evidence and independent host facts.
 * @param root0.tap - Complete original combined producer TAP stream.
 * @param root0.read - Reader for records relative to one closed route directory.
 * @param root0.runtime - Independently observed platform, architecture, and glibc.
 * @param root0.interpreter - Freshly queried selected MRI identity and version.
 */
export const checkCheckedRecordValueIndexRubyCiRecords = async (args, {
	tap, read, runtime, interpreter
}) => {
	const selected = parseCheckedRecordValueIndexRubyCiArgs(args);
	assertCheckedRecordValueIndexRubyCiTap(tap, selected.route);
	assert.equal(interpreter.command, selected.ruby);
	return checkCheckedRecordValueIndexRubyReport(read, {
		route: selected.route, producerCommit: selected.producer, runtime
		, floor: selected.glibc, interpreter
	});
};
