/**
 * Add required structural acceptance without deleting older consumer gates or original uploads.
 *
 * @file
 */
import assert from "node:assert/strict";

const runner = "bash scripts/run-structural-subtype-ci.sh";
const nativeRunner = "bash scripts/run-checked-record-host-ci.sh";
const packageRunner = "bash scripts/run-reviewed-subtype-package-ci.sh";
export const structuralSubtypeWorkflowGroups = [
	{ job: "native-consumers", step: "type_corpus_c_family", lanes: ["c-cpp"], anchor: packageRunner + " c-cpp", upload: "build/reviewed-subtype-package-ci/c-cpp/", enforce: "Enforce native consumer support" }
	, { job: "native-consumers", step: "type_corpus_python", lanes: ["python311", "python312"], anchor: "LEAN_BRIDGE_PYTHON='${{ steps.collection_python312.outputs.python-path }}' " + nativeRunner + " python312", upload: "build/checked-record-ci/python312/", enforce: "Enforce native consumer support" }
	, { job: "native-consumers", step: "type_corpus_rust", lanes: ["rust"], anchor: nativeRunner + " rust", upload: "build/checked-record-ci/rust/", enforce: "Enforce native consumer support" }
	, { job: "managed-consumers", step: "type_corpus_ruby", lanes: ["ruby"], anchor: nativeRunner + " ruby", upload: "build/checked-record-ci/ruby/", enforce: "Enforce managed consumer support" }
	, { job: "managed-consumers", step: "type_corpus_dotnet", lanes: ["dotnet"], anchor: nativeRunner + " dotnet", upload: "build/checked-record-ci/dotnet/", enforce: "Enforce managed consumer support" }
	, { job: "managed-consumers", step: "type_corpus_jvm", lanes: ["jvm"], anchor: nativeRunner + " jvm", upload: "build/checked-record-ci/jvm/", enforce: "Enforce managed consumer support" }
	, { job: "php-consumers", step: "type_corpus_php_native", lanes: ["php-native"], anchor: nativeRunner + " php-native", upload: "build/checked-record-ci/php-native/", enforce: "Enforce PHP support" }
	, { job: "wasi-consumer", step: "ordinary_wit", lanes: ["wit-wasi"], anchor: nativeRunner + " wit-wasi", upload: "build/checked-record-ci/wit-wasi/", enforce: "Enforce WIT and WASI support" }
	, { job: "php-wasm-consumers", step: "type_corpus_php_wasm", lanes: ["php-wasm"], anchor: "node scripts/check-php-wasm-subtype-entry-reports.mjs --directory build/php-wasm-subtype-entry --tap build/php-wasm-subtype-entry/run.tap", upload: "build/php-wasm-subtype-entry/", enforce: "Enforce PHP support" }
];

/**
 * Select explicit interpreter and runtime inputs rather than ambient PATH.
 *
 * @param lane - Required structural host lane.
 */
export const structuralSubtypeWorkflowCommand = lane => {
	assert.ok([...structuralSubtypeWorkflowGroups.flatMap(group => group.lanes), "perl", "node-browser"].includes(lane));
	if(lane.startsWith("python"))
		return `LEAN_BRIDGE_PYTHON='\${{ steps.collection_${lane}.outputs.python-path }}' ${runner} ${lane}`;
	if(lane === "php-wasm")
		return `LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=build/php-wasm-subtype-entry-input/php-wasm-runtime ${runner} php-wasm`;
	return `${runner} ${lane}`;
};
/**
 * Preserve the complete output tree, including partial failed runs.
 *
 * @param lane - Required structural host lane whose entire output must survive.
 */
export const structuralSubtypeWorkflowUpload = lane => `            build/structural-subtype-ci/${lane}/\n`;
export const structuralSubtypeNodeBlock = `      - name: Require ordinary and reviewed structural Subtypes in Node and three browsers
        id: structural_subtype_npm
        timeout-minutes: 60
        env:
          LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine
          LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/consumer-ci-runtime/lazy
        run: ${runner} node-browser
      - name: Preserve complete and partial structural Node and browser records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: structural-subtype-node-browser-\${{ github.sha }}
          path: build/structural-subtype-ci/node-browser/
          if-no-files-found: error
          retention-days: 30
`;
export const structuralSubtypePerlBlock = `      - name: Require both structural Subtype routes across all four Perl ABIs
        env:
          LEAN_NUM_THREADS: "2"
        run: |
          source scripts/env.sh
          ${runner} perl
      - name: Preserve complete and partial structural Perl records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: structural-subtype-perl-\${{ github.sha }}
          path: build/structural-subtype-ci/perl/
          if-no-files-found: error
          retention-days: 30
`;
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, `Expected one workflow fragment: ${from}`);
	return source.replace(from, () => to);
};
const nodeSuccess = "steps.reviewed_subtype_npm.outcome == 'success' && ";
const structuralSuccess = "steps.structural_subtype_npm.outcome == 'success' && ";
const nodeFailure = "steps.reviewed_subtype_npm.outcome != 'success'";
const structuralFailure = " || steps.structural_subtype_npm.outcome != 'success'";

/**
 * Reversible additions touch only the named producers, descriptions, uploads and outcomes.
 *
 * @param source - Complete workflow text.
 * @param name - One of the two existing consumer workflows.
 * @param enabled - Add the gate or remove exactly its original additions.
 */
const transform = (source, name, enabled) => {
	assert.ok(["consumer-matrix.yml", "perl-consumer.yml"].includes(name));
	if(enabled) assert.ok(!source.includes(runner));
	const insert = (before, addition) => { source = enabled ? once(source, before, before + addition) : once(source, addition, ""); };
	if(name === "perl-consumer.yml")
	{
		const anchor = "\n  nix-engine:\n";
		source = enabled ? once(source, anchor, structuralSubtypePerlBlock + anchor) : once(source, structuralSubtypePerlBlock, "");
		return source;
	}
	for(const group of structuralSubtypeWorkflowGroups)
	{
		insert(`          ${group.anchor}\n`, group.lanes.map(lane => `          ${structuralSubtypeWorkflowCommand(lane)}\n`).join(""));
		insert(`            ${group.upload}\n`, group.lanes.map(structuralSubtypeWorkflowUpload).join(""));
		const suffix = " && " + group.lanes.map(structuralSubtypeWorkflowCommand).join(" && ");
		const anchor = " && " + group.anchor;
		source = enabled ? once(source, anchor, anchor + suffix) : once(source, suffix, "");
	}
	const anchor = "      - name: Check independently reviewed Subtype npm packages and strict TypeScript\n";
	source = enabled ? once(source, anchor, structuralSubtypeNodeBlock + anchor) : once(source, structuralSubtypeNodeBlock, "");
	const success = enabled ? nodeSuccess : nodeSuccess + structuralSuccess;
	assert.equal(source.split(success).length, 3);
	source = source.replaceAll(success, enabled ? nodeSuccess + structuralSuccess : nodeSuccess);
	source = enabled ? once(source, nodeFailure + "\n", nodeFailure + structuralFailure + "\n") : once(source, structuralFailure, "");
	let descriptions = 0;
	source = source.split("\n").map(line => {
		if(!/--consumer node-(?:javascript|typescript) /u.test(line)) return line;
		descriptions++;
		const anchor = " && " + packageRunner + " npm", addition = " && " + runner + " node-browser";
		return enabled ? once(line, anchor, anchor + addition) : once(line, addition, "");
	}).join("\n");
	assert.equal(descriptions, 2);
	return source;
};
/**
 * Add required gates to the original workflow.
 *
 * @param source - Original workflow text.
 * @param name - Consumer workflow basename.
 */
export const enableStructuralSubtypeWorkflow = (source, name) => transform(source, name, true);
/**
 * Remove exactly the new gates for predecessor comparison.
 *
 * @param source - Workflow with all structural additions.
 * @param name - Consumer workflow basename.
 */
export const disableStructuralSubtypeWorkflow = (source, name) => transform(source, name, false);

/**
 * Remove only this milestone before checking the independently required older gates.
 *
 * @param source - Current or earlier workflow text.
 * @param name - Consumer workflow basename.
 */
export const withoutStructuralSubtypeWorkflow = (source, name) => source.includes(runner) ? disableStructuralSubtypeWorkflow(source, name) : source;

const stepAt = (source, index) => {
	assert.ok(index >= 0);
	const start = source.lastIndexOf("\n      - name: ", index), end = source.indexOf("\n      - name: ", index);
	assert.ok(start >= 0); return source.slice(start, end < 0 ? source.length : end);
};
const jobAt = (source, index) => [...source.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
const jobBody = (source, name) => source.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
const requireUpload = source => {
	assert.match(source, /\n {8}if: always\(\)(?: && matrix\.profile == '[a-z-]+')?\n/u);
	assert.match(source, /\n {8}uses: actions\/upload-artifact@v7\n/u);
	assert.match(source, /\n {10}if-no-files-found: error\n/u);
	assert.doesNotMatch(source, /continue-on-error:/u);
};

/**
 * Require each producer in its enforced job, correct runtime inputs and complete failure uploads.
 *
 * @param source - Live workflow, not a reconstructed earlier epoch.
 * @param name - Consumer workflow basename.
 */
export const assertStructuralSubtypeWorkflow = (source, name) => {
	assert.equal(enableStructuralSubtypeWorkflow(disableStructuralSubtypeWorkflow(source, name), name), source);
	assert.doesNotMatch(source, /LEAN_BRIDGE_(?:NATIVE|PERL)_TEST_GLIBC_FLOOR|LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS/u);
	if(name === "perl-consumer.yml")
	{
		const index = source.indexOf(structuralSubtypePerlBlock); assert.equal(jobAt(source, index), "checked-records");
		const job = jobBody(source, "checked-records");
		assert.doesNotMatch(job, /continue-on-error:|set \+e|\|\| true|\n {4}if:/u);
		assert.match(job, /^ {4}timeout-minutes: 120$/mu);
		for(const selection of ["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"])
			assert.ok(job.indexOf(`node scripts/build-perl-toolchains.mjs ${selection}\n`) < job.indexOf(runner) && job.includes(`node scripts/build-perl-toolchains.mjs ${selection}\n`));
		const summary = jobBody(source, "perl-summary");
		assert.match(summary, /^ {6}- checked-records$/mu);
		assert.ok(summary.includes("needs.checked-records.result == 'success'"));
		assert.equal(source.split(runner + " perl").length, 2);
		requireUpload(stepAt(source, source.indexOf("          path: build/structural-subtype-ci/perl/\n")));
		return;
	}
	for(const group of structuralSubtypeWorkflowGroups)
	{
		const block = group.lanes.map(lane => `          ${structuralSubtypeWorkflowCommand(lane)}\n`).join("");
		const index = source.indexOf(block), step = stepAt(source, index), job = jobBody(source, group.job);
		assert.equal(jobAt(source, index), group.job);
		assert.ok(step.includes(`\n        id: ${group.step}\n`));
		assert.ok(step.includes(`          ${group.anchor}\n${block}`));
		assert.doesNotMatch(step, /set \+e|\|\| true/u);
		const profile = group.job === "native-consumers" ? ({ "c-cpp": "c-family", python311: "python", rust: "rust" })[group.lanes[0]]
			: group.job === "managed-consumers" ? group.lanes[0] : null;
		const conditions = [...step.matchAll(/^ {8}if: (.*)$/gmu)].map(match => match[1]);
		assert.deepEqual(conditions, profile ? [`matrix.profile == '${profile}'`] : []);
		const enforce = job.split(`      - name: ${group.enforce}\n`)[1]?.split("      - name: ")[0];
		assert.ok(enforce?.includes(`steps.${group.step}.outcome != 'success'`));
		assert.match(enforce, /\n {8}run: exit 1(?:\n|$)/u);
		assert.doesNotMatch(enforce, /continue-on-error:|set \+e|\|\| true/u);
		for(const lane of group.lanes)
		{
			assert.equal(source.split(structuralSubtypeWorkflowCommand(lane)).length, 3);
			requireUpload(stepAt(source, source.indexOf(structuralSubtypeWorkflowUpload(lane))));
		}
	}
	const nodeIndex = source.indexOf(structuralSubtypeNodeBlock); assert.equal(jobAt(source, nodeIndex), "node-consumers");
	const node = jobBody(source, "node-consumers");
	assert.ok(node.includes("nix build .#component-build-engine --out-link build/locked-lake-engine"));
	assert.ok(node.indexOf("nix build .#component-build-engine --out-link build/locked-lake-engine") < node.indexOf(structuralSubtypeNodeBlock));
	assert.equal(source.split(runner + " node-browser").length, 4);
	assert.equal(node.split(structuralSuccess).length, 3); assert.equal(node.split(structuralFailure).length, 2);
	const enforce = node.split("      - name: Enforce Node support and the browser corpus\n")[1]?.split("      - name: ")[0];
	assert.ok(enforce?.includes(structuralFailure)); assert.match(enforce, /\n {8}run: exit 1(?:\n|$)/u);
	assert.doesNotMatch(enforce, /continue-on-error:/u);
	const php = jobBody(source, "php-wasm-consumers");
	assert.ok(php.includes("node scripts/prepare-php-wasm-subtype-entry-runtime.mjs"));
	assert.ok(php.indexOf("node scripts/prepare-php-wasm-subtype-entry-runtime.mjs") < php.indexOf(structuralSubtypeWorkflowCommand("php-wasm")));
};
