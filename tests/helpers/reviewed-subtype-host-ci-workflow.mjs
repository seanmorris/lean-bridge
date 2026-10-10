/**
 * Add strict reviewed native Subtype lanes to the existing enforced consumer jobs.
 *
 * @file
 */
import assert from "node:assert/strict";

const runner = "bash scripts/run-reviewed-subtype-host-ci.sh";
export const reviewedSubtypeHostCiGroups = [
	{ workflow: "consumer-matrix.yml", job: "php-consumers", step: "type_corpus_php_native", profiles: "php-native", lanes: ["php-native"] }
	, { workflow: "consumer-matrix.yml", job: "native-consumers", step: "type_corpus_python", profiles: "python", lanes: ["python311", "python312"] }
	, { workflow: "consumer-matrix.yml", job: "native-consumers", step: "type_corpus_rust", profiles: "rust", lanes: ["rust"] }
	, { workflow: "consumer-matrix.yml", job: "managed-consumers", step: "type_corpus_dotnet", profiles: "dotnet", lanes: ["dotnet"] }
	, { workflow: "consumer-matrix.yml", job: "managed-consumers", step: "type_corpus_jvm", profiles: "java,kotlin", lanes: ["jvm"] }
	, { workflow: "consumer-matrix.yml", job: "managed-consumers", step: "type_corpus_ruby", profiles: "ruby", lanes: ["ruby"] }
	, { workflow: "consumer-matrix.yml", job: "wasi-consumer", step: "ordinary_wit", profiles: "wit-wasi", lanes: ["wit-wasi"] }
	, { workflow: "perl-consumer.yml", job: "perl", profiles: "perl", lanes: ["perl-${{ matrix.configuration }}"] }
];
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2, `Expected exactly one ${from}`);
	return source.replace(from, () => to);
};
const ordinary = item => `LEAN_BRIDGE_SUBTYPE_PROFILES=${item.profiles} node --test tests/native-subtype.test.mjs`;
const report = item => `build/native-subtype/${item.profiles.replace(",", "-")}.json`;
const stepAt = (source, index) => {
	const start = source.lastIndexOf("\n      - name: ", index), next = source.indexOf("\n      - name: ", index);
	assert.ok(start >= 0);
	return source.slice(start, next < 0 ? source.length : next);
};

/**
 * Keep interpreter selections explicit on both Python floors and every Perl ABI.
 *
 * @param lane - Closed runner lane, or the existing Perl matrix expression.
 */
export const reviewedSubtypeHostCiCommand = lane => {
	if(lane.startsWith("python"))
		return `LEAN_BRIDGE_PYTHON='\${{ steps.collection_${lane}.outputs.python-path }}' ${runner} ${lane}`;
	return `${runner} ${lane.startsWith("perl-") ? "'" + lane + "'" : lane}`;
};
/**
 * Keep each lane's original TAP and all build/report records, including partial failure output.
 *
 * @param lane - Explicit runner lane.
 */
export const reviewedSubtypeHostCiUpload = lane => `            build/reviewed-subtype-ci/${lane}/\n`;
/**
 * Run the new lanes immediately after their ordinary-source predecessor.
 *
 * @param item - Enforced native consumer group.
 */
export const reviewedSubtypeHostCiBlock = item => item.lanes.map(lane => `          ${reviewedSubtypeHostCiCommand(lane)}\n`).join("");

/**
 * Extend existing gates, unconditional artifact uploads and recorded execution descriptions.
 *
 * @param source - Original workflow text.
 * @param name - Workflow basename.
 */
export const enableReviewedSubtypeHostWorkflow = (source, name) => {
	const groups = reviewedSubtypeHostCiGroups.filter(item => item.workflow === name);
	assert.ok(groups.length > 0); assert.ok(!source.includes(runner));
	for(const item of groups)
	{
		const anchor = `          test -s ${report(item)}\n`, upload = `            ${report(item)}\n`;
		source = once(source, anchor, anchor + reviewedSubtypeHostCiBlock(item));
		source = once(source, upload, upload + item.lanes.map(reviewedSubtypeHostCiUpload).join(""));
		if(name === "perl-consumer.yml") continue;
		let matches = 0;
		source = source.split("\n").map(line => {
			if(!/(?:consumer_command=|--command ")/u.test(line) || !line.includes(ordinary(item))) return line;
			matches++;
			return once(line, ordinary(item), ordinary(item) + " && " + item.lanes.map(reviewedSubtypeHostCiCommand).join(" && "));
		}).join("\n");
		assert.equal(matches, 1, item.profiles);
	}
	return source;
};

/**
 * Remove exactly this milestone's additions, preserving every earlier CI command.
 *
 * @param source - Workflow containing the new native gates.
 * @param name - Workflow basename.
 */
export const disableReviewedSubtypeHostWorkflow = (source, name) => {
	const groups = reviewedSubtypeHostCiGroups.filter(item => item.workflow === name);
	assert.ok(groups.length > 0);
	for(const item of groups)
	{
		source = once(source, reviewedSubtypeHostCiBlock(item), "");
		for(const lane of item.lanes) source = once(source, reviewedSubtypeHostCiUpload(lane), "");
		if(name !== "perl-consumer.yml") source = once(source, " && " + item.lanes.map(reviewedSubtypeHostCiCommand).join(" && "), "");
	}
	assert.ok(!source.includes(runner));
	return source;
};

/**
 * Require the exact gate in its enforced job, with complete unconditional evidence uploads.
 *
 * @param source - Current workflow text.
 * @param name - Workflow basename.
 */
export const assertReviewedSubtypeHostWorkflow = (source, name) => {
	assert.equal(enableReviewedSubtypeHostWorkflow(disableReviewedSubtypeHostWorkflow(source, name), name), source);
	for(const item of reviewedSubtypeHostCiGroups.filter(item => item.workflow === name))
	{
		const block = reviewedSubtypeHostCiBlock(item), index = source.indexOf(block);
		assert.ok(index >= 0);
		assert.ok(source.includes(`          ${ordinary(item)}\n          test -s ${report(item)}\n` + block));
		const job = [...source.slice(0, index).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
		assert.equal(job, item.job);
		const step = stepAt(source, index);
		assert.doesNotMatch(step, /set \+e|\|\| true/u);
		if(item.step)
		{
			assert.ok(step.includes(`\n        id: ${item.step}\n`));
			assert.ok(source.includes(`steps.${item.step}.outcome != 'success'`));
		}
		else assert.ok(!step.includes("continue-on-error:"));
		for(const lane of item.lanes)
		{
			assert.equal(source.split(reviewedSubtypeHostCiCommand(lane)).length - 1, name === "perl-consumer.yml" ? 1 : 2);
			const upload = stepAt(source, source.indexOf(reviewedSubtypeHostCiUpload(lane)));
			assert.match(upload, /\n {8}if: always\(\)/u);
			assert.match(upload, /\n {8}uses: actions\/upload-artifact@v7\n/u);
			assert.match(upload, /\n {10}if-no-files-found: error\n/u);
		}
	}
};
