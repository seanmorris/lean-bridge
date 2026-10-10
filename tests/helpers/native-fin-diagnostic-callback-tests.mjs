/**
 * Retain fresh callback diagnostics without inferring R2 replies or other-host dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finCallbackCompilerModel } from "./fin-callback-model.mjs";
import { finCallbackConsumerNames } from "./fin-callback-install.mjs";
import { finCallbackDispatchExpected } from "./fin-callback-dispatch.mjs";
import { reviewedCallbackFinNativeCallers } from "./reviewed-callback-fin-evidence.mjs";
import "./native-fin-diagnostic-reply-tests.mjs";

const directory = "docs/evidence/native-fin-diagnostic-installed-20261010";
const callers = {
	"tests/fixtures/fin-callback-consumers/c.c": "b847478304f3a4a1c4d19be47ca508f6fc71992e0c105d1a6bf6a7d119be81ec"
	, "tests/fixtures/fin-callback-consumers/cpp.cpp": "157a63e7558f413907eef1840fd55221b93b3c7bac70e65794aded332804b19d"
	, "tests/fixtures/reviewed-callback-fin-consumers/c.c": "27df2e988e0b762e1ac5f3800ed60504870644ef54ec88d14e741f8a93c68e54"
	, "tests/fixtures/reviewed-callback-fin-consumers/cpp.cpp": "672b205b828fcd41fc46854fb4b2d22235fb408f24103bcf0ce75e44a9c5a9c8"
};
const original = async path => {
	assert.ok(Object.hasOwn(callers, path));
	const source = beforeFinRefinementSource(path, await readFile(path, "utf8"), callers[path]);
	assert.equal(sha256(source), callers[path]);
	return source;
};
const fixtures = {
	ordinary: {
		digest: "7178d216181f368bf2bfc42c740c6e38862b482f4ef333facc3fb0b9402895cb"
		, name: "fincallbacks"
		, bindingIrSha256: "43a0642f902ad0a91f999f41d59dacc10d0bf0d6d4419609469e3565c2e247b7"
		, modelSha256: "1c4a3743f99ffa31b548f65929a91a4cda5ceb93559b47ed1145e8b359c9cd93"
		, receiptSha256: "4dcf5a5f282eceb72ddfabc25c06fabd94239e250609417ced0c60d18844f8af"
		, artifacts: [
			{ bytes: 53900918, path: "archives/fincallbacks-1.0.0-c.tar.gz", sha256: "c5e8b72b316f15d855c769afb6b5bff0487bc691084083a28b70793dc8fb97f9" }
			, { bytes: 51823542, path: "archives/fincallbacks-1.0.0-cpp.tar.gz", sha256: "ebe2277af93ff6ff247904881dca24cd3b204362832722671d11ab280478be52" }
		]
		, checks: [297, 283]
	}
	, reviewed: {
		digest: "1fa47d2bfdc4580af5abee9c00c558de9262488036762cb7162ab44d5eea97ad"
		, name: "reviewedcallbacks"
		, bindingIrSha256: "3e5cf2899b9f379222b0d9a91ad6cdf6983a92e8a0147db596053cbd20e0ad86"
		, modelSha256: "c69d518324b09ae2c8d8cbb6aeffc1c234eb30aa86ec29f471db0524fa1f68d7"
		, receiptSha256: "5ceb6944baddbb4ddf248938940fe35b0af5daa1c5eaebe202099329355b021a"
		, artifacts: [
			{ bytes: 53857030, path: "archives/reviewedcallbacks-1.0.0-c.tar.gz", sha256: "d029cc24d824e257c6ad2ba01541ba62553907977582f5d2fabe59ec2782a2eb" }
			, { bytes: 51787120, path: "archives/reviewedcallbacks-1.0.0-cpp.tar.gz", sha256: "0321c7a912ad2d15a06b53ead7b740998fdd9165c6c9bd02255af587776aaacd" }
		]
		, checks: [266, 260]
	}
};
const dispatch = {
	columns: ["public lease-call entry", "checked closure-call adapter", "source body"]
	, interposer: "LD_PRELOAD", observed: finCallbackDispatchExpected
	, positiveControl: "valid public and raw calls increment the adapter and source counts"
	, symbols: {
		adapter: "lb_t07ff56848fc3a3cd3550_call"
		, entry: "fincallbacks_gmp_owned_callback1469b3ae2047ff62e64f_call"
		, factory: "lb_54bd66dae599b3b7003902f1", source: "l_FinCallbacks_scaled"
	}
};
const validate = (report, route, consumers) => {
	const fixture = fixtures[route], reviewed = route === "reviewed";
	assert.deepEqual(report, { schemaVersion: 1, reproducible: true
		, archives: Object.fromEntries(fixture.artifacts.map(item => [item.path, item.sha256]))
		, reports: ["c", "cpp"].map((profile, index) => ({
			profile, path: `${route}-source`, checks: fixture.checks[index]
			, consumerSha256: consumers[profile]
			, bindingIrSha256: fixture.bindingIrSha256
			, modelSha256: fixture.modelSha256, receiptSha256: fixture.receiptSha256
			, compilerFreePath: true, offlineInstall: true
			, sourceRemovedBeforeInstallation: true
			, ...(reviewed ? { review: "R1", reviewedBindingIrSha256: "83d623f2e6b3c21a69ad7b03d81867e0cf5a6342c5ce3f773a9e7fe7d5fee7db", dispatch: "not measured" } : profile === "c" ? { dispatch } : {})
			, packages: [{ target: profile, ecosystem: profile, name: fixture.name
				, version: "1.0.0", profile: "native-library-v1", role: "component"
				, requires: [], runtimeDelivery: "embedded"
				, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
				, artifacts: [fixture.artifacts[index]] }] })) });
};

for(const route of ["ordinary", "reviewed"])
	test(`fresh ${route} callback diagnostics preserve original installed identities and dispatch scope`, async () => {
		const bytes = await readFile(`${directory}/${route}-callback.json`);
		assert.equal(sha256(bytes), fixtures[route].digest);
		const names = finCallbackConsumerNames(finCallbackCompilerModel().bindingIr);
		const consumers = route === "reviewed" ? await reviewedCallbackFinNativeCallers(original) : {
			c: sha256(`${Object.entries(names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${await original("tests/fixtures/fin-callback-consumers/c.c")}`)
			, cpp: sha256(await original("tests/fixtures/fin-callback-consumers/cpp.cpp")) };
		const report = JSON.parse(bytes); validate(report, route, consumers);
		for(const mutate of [
			value => { value.reports[0].checks--; }
			, value => { value.reports.pop(); }
			, value => { value.reports[1].dispatch = "measured"; }
			, value => { value.reports[0].review = "R2"; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].packages[0].artifacts[0].bytes--; }
			, value => { value.reports[0].receiptSha256 = "0".repeat(64); }
			, value => { value.hostedCi = true; }
		]) {
			const changed = structuredClone(report); mutate(changed);
			assert.throws(() => validate(changed, route, consumers), assert.AssertionError);
		}
	});

test("fresh callback diagnostic TAP records both actual installed tests without skips", async () => {
	const tap = await readFile(`${directory}/callback.tap`, "utf8");
	assert.equal(sha256(tap), "7dcfbb6d078ef3a612311356c2c98c7800070cb45ca0ec594aeb614ff36fe648");
	assert.match(tap, /# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const prefix of ["", "reviewed "])
	{
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${prefix}build ([0-9]+): c, cpp$`, "gmu"))].map(match => match[1]), ["0", "1"]);
		for(const profile of ["c", "cpp"]) assert.ok(tap.includes(`# installing and checking ${prefix}${profile}\n`));
	}
});
