/**
 * Check independent managed CI routing without removing acceptance commands.
 *
 * @file
 */
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

const profiles = ["dotnet", "jvm", "ruby"];
const names = {
	dotnet: ["Install the ordinary C# compiler", "Upload the .NET real-Lean type corpus report"]
	, jvm: ["Install the ordinary Java compiler", "Upload installed Java and Kotlin corpus observations"]
	, ruby: ["Install the ordinary Ruby runtime", "Upload the Ruby real-Lean type corpus report"]
};
const job = workflow => {
	const match = /^ {2}managed-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(workflow);
	assert.ok(match, "managed consumer job is present"); return match[0];
};
const steps = source => source.split(/^ {6}- name: /mu).slice(1).map(text => ({
	name: text.split("\n")[0], text
	, id: /^ {8}id: (.+)$/mu.exec(text)?.[1]
	, condition: /^ {8}if: (.+)$/mu.exec(text)?.[1]
}));
const commands = step => {
	const match = /^ {8}run: \|\n((?: {10}.*\n|\n)*)/mu.exec(step.text);
	assert.ok(match, step.name + " has a literal command block"); return match[1];
};
const evaluate = (condition, profile, overrides = {}) => {
	const outcomes = { consumer: "success"
		, ...Object.fromEntries(profiles.flatMap(name => ["ordinary_", "type_corpus_"].map(prefix =>
			[prefix + name, name === profile ? "success" : "skipped"])))
		, ...overrides };
	return runInNewContext(condition ?? "true", {
		always: () => true, matrix: { profile }
		, steps: Object.fromEntries(Object.entries(outcomes).map(([name, outcome]) => [name, { outcome }]))
	}, { timeout: 100 });
};

/**
 * Exercise every profile's selection, failed/skipped gate and artifact identity.
 * When an authenticated predecessor is supplied, compare complete command blocks.
 *
 * @param workflow - Complete current workflow text.
 * @param previous - Optional exact workflow before the matrix split.
 */
export const assertManagedCiIsolation = (workflow, previous = null) => {
	const body = job(workflow), parsed = steps(body);
	const named = name => { const found = parsed.find(step => step.name === name); assert.ok(found, name); return found; };
	const identified = id => { const found = parsed.find(step => step.id === id); assert.ok(found, id); return found; };
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}profile: \[dotnet, jvm, ruby\]$/mu);
	const prepare = named("Prepare the pinned native compiler");
	assert.equal(prepare.condition, undefined);
	const setup = commands(prepare);
	assert.equal(setup, "          sudo apt-get update && sudo apt-get install -y build-essential zstd m4\n          bash scripts/bootstrap-toolchains.sh --lean-only\n");
	const baseline = identified("consumer");
	assert.equal(baseline.condition, undefined);
	assert.match(baseline.text, /^ {8}run: npm run test:consumer:managed$/mu);
	const gate = named("Enforce managed consumer support");
	assert.match(gate.condition, /^always\(\) && /u);
	assert.match(gate.text, /^ {8}run: exit 1$/mu);
	for(const profile of profiles)
	{
		const ordinary = identified("ordinary_" + profile), corpus = identified("type_corpus_" + profile);
		const install = named(names[profile][0]), upload = named(names[profile][1]);
		assert.ok(parsed.indexOf(prepare) < parsed.indexOf(ordinary));
		assert.equal(ordinary.condition, "matrix.profile == '" + profile + "'");
		assert.equal(corpus.condition, ordinary.condition); assert.equal(install.condition, ordinary.condition);
		assert.equal(upload.condition, "always() && " + ordinary.condition);
		for(const selected of profiles)
			for(const step of [ordinary, corpus, install, upload])
				assert.equal(evaluate(step.condition, selected), selected === profile, step.name);
		assert.equal(evaluate(gate.condition, profile), false, profile + " ignores other profiles' skipped steps");
		for(const outcome of ["failure", "skipped", "cancelled"])
			for(const id of ["consumer", "ordinary_" + profile, "type_corpus_" + profile])
				assert.equal(evaluate(gate.condition, profile, { [id]: outcome }), true, profile + "/" + id + "/" + outcome);
	}
	const record = named("Record managed consumer observations");
	assert.equal(record.condition, "always()");
	assert.ok(commands(record).includes("for consumer in ${{ matrix.profile }}; do"));
	const upload = named("Upload managed consumer observations");
	assert.equal(upload.condition, "always()");
	assert.ok(upload.text.includes("name: consumer-results-managed-${{ matrix.profile }}-${{ github.sha }}"));
	assert.ok(upload.text.includes("path: build/consumer-ci/results/${{ matrix.profile }}.json"));
	assert.ok(workflow.includes("pattern: consumer-results-*-${{ github.sha }}"));
	assert.match(workflow, /^ {6}- managed-consumers$/mu);
	if(previous !== null)
	{
		assert.equal(workflow.replace(body, ""), previous.replace(job(previous), ""), "unrelated CI jobs remain unchanged");
		const old = steps(job(previous));
		for(const profile of profiles) for(const id of ["ordinary_" + profile, "type_corpus_" + profile])
		{
			const before = old.find(step => step.id === id); assert.ok(before);
			const expected = id === "ordinary_dotnet" ? commands(before).replace(setup, "") : commands(before);
			assert.equal(commands(identified(id)), expected, id + " keeps every acceptance command");
		}
		const withoutCondition = step => step.text.replace(/^ {8}if: .+\n/mu, "");
		for(const profile of profiles) for(const name of names[profile])
			assert.equal(withoutCondition(named(name)), withoutCondition(old.find(step => step.name === name)), name + " preserves pinned tools and uploaded evidence");
		assert.equal(record.text.replace("for consumer in ${{ matrix.profile }}; do", "for consumer in dotnet jvm ruby; do"),
			old.find(step => step.name === record.name).text, "observation commands are unchanged");
		assert.equal(upload.text.replace("consumer-results-managed-${{ matrix.profile }}-", "consumer-results-managed-")
			.replace("build/consumer-ci/results/${{ matrix.profile }}.json", "build/consumer-ci/results/*.json"),
		old.find(step => step.name === upload.name).text, "only the selected observation changes artifact identity");
	}
	return { profiles, timeoutMinutesPerProfile: 240, failFast: false
		, selectedOutcomeCases: 27, artifactNamesIncludeProfile: true
		, commandsCompared: previous === null ? 0 : 6 };
};
