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
const additionalId = item => typeof item === "string" ? item : item.id;
const additionalOutcomes = (profile, additionalProfileSteps) => {
	const ids = new Set(Object.values(additionalProfileSteps).flat().map(additionalId));
	return Object.fromEntries([...ids].map(id => [
		id
		, Object.entries(additionalProfileSteps).some(([name, items]) =>
			name === profile && items.some(item => additionalId(item) === id)) ? "success" : "skipped"
	]));
};
const evaluate = (condition, profile, overrides = {}, additionalProfileSteps = {}) => {
	const outcomes = { consumer: "success"
		, ...Object.fromEntries(profiles.flatMap(name => ["ordinary_", "type_corpus_"].map(prefix =>
			[prefix + name, name === profile ? "success" : "skipped"])))
		, ...additionalOutcomes(profile, additionalProfileSteps)
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
 * @param additionalProfileSteps - Explicit required acceptance IDs added after the historical matrix split.
 */
export const assertManagedCiIsolation = (workflow, previous = null, additionalProfileSteps = {}) => {
	const body = job(workflow), parsed = steps(body);
	const named = name => { const found = parsed.find(step => step.name === name); assert.ok(found, name); return found; };
	const identified = id => { const found = parsed.find(step => step.id === id); assert.ok(found, id); return found; };
	const registered = new Set(["consumer", ...profiles.flatMap(profile => ["ordinary_" + profile, "type_corpus_" + profile])]);
	const additional = new Map();
	for(const [profile, ids] of Object.entries(additionalProfileSteps))
	{
		assert.ok(profiles.includes(profile)); assert.ok(Array.isArray(ids) && ids.length > 0);
		for(const item of ids)
		{
			const id = additionalId(item), continueOnError = typeof item === "object" && item.continueOnError === true;
			assert.match(id, /^[a-z][a-z0-9_]*$/u); assert.ok(!registered.has(id));
			const current = additional.get(id);
			if(current)
			{
				assert.equal(current.continueOnError, continueOnError);
				assert.ok(!current.profiles.includes(profile));
				current.profiles.push(profile);
			}
			else
			{
				assert.equal(parsed.filter(step => step.id === id).length, 1, id + " has one acceptance step");
				additional.set(id, { continueOnError, profiles: [profile] });
			}
		}
	}
	const evaluateForProfile = (condition, profile, overrides) => evaluate(condition, profile, overrides, additionalProfileSteps);
	let selectedOutcomeCases = 0;
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}profile: \[dotnet, jvm, ruby\]$/mu);
	const prepare = named("Prepare the pinned native compiler");
	assert.equal(prepare.condition, undefined);
	const dependencies = parsed.find(step => step.name === "Install apt dependencies for Prepare the pinned native compiler");
	if(dependencies)
	{
		assert.equal(dependencies.condition, undefined);
		assert.ok(parsed.indexOf(dependencies) < parsed.indexOf(prepare));
		assert.match(dependencies.text, /^ {8}timeout-minutes: 20$/mu);
		assert.doesNotMatch(dependencies.text, /continue-on-error/u);
	}
	const setup = (dependencies ? commands(dependencies) : "") + commands(prepare);
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
		const additionalSteps = (additionalProfileSteps[profile] ?? []).map(item => identified(additionalId(item)));
		const install = named(names[profile][0]), upload = named(names[profile][1]);
		assert.ok(parsed.indexOf(prepare) < parsed.indexOf(ordinary));
		assert.equal(ordinary.condition, "matrix.profile == '" + profile + "'");
		assert.equal(corpus.condition, ordinary.condition); assert.equal(install.condition, ordinary.condition);
		assert.equal(upload.condition, "always() && " + ordinary.condition);
		for(const step of additionalSteps)
		{
			const specification = additional.get(step.id);
			const expectedCondition = specification.profiles
				.sort((left, right) => profiles.indexOf(left) - profiles.indexOf(right))
				.map(name => "matrix.profile == '" + name + "'").join(" || ");
			assert.equal(step.condition, expectedCondition);
			if(specification.continueOnError) assert.match(step.text, /^ {8}continue-on-error: true$/mu);
			else assert.doesNotMatch(step.text, /continue-on-error/u);
			assert.ok(parsed.indexOf(prepare) < parsed.indexOf(step) && parsed.indexOf(step) < parsed.indexOf(gate));
		}
		for(const selected of profiles)
			for(const step of [ordinary, corpus, install, upload, ...additionalSteps])
				assert.equal(evaluateForProfile(step.condition, selected)
					, step.id && additional.has(step.id) ? additional.get(step.id).profiles.includes(selected) : selected === profile, step.name);
		assert.equal(evaluateForProfile(gate.condition, profile), false, profile + " ignores other profiles' skipped steps");
		for(const outcome of ["failure", "skipped", "cancelled"])
			for(const id of ["consumer", "ordinary_" + profile, "type_corpus_" + profile, ...additionalSteps.map(step => step.id)])
			{
				assert.equal(evaluateForProfile(gate.condition, profile, { [id]: outcome }), true, profile + "/" + id + "/" + outcome);
				selectedOutcomeCases++;
			}
		for(const other of profiles.filter(name => name !== profile))
			for(const id of ["ordinary_" + other, "type_corpus_" + other
				, ...(additionalProfileSteps[other] ?? []).map(additionalId).filter(id => !additional.get(id).profiles.includes(profile))])
				for(const outcome of ["failure", "skipped", "cancelled"])
					assert.equal(evaluateForProfile(gate.condition, profile, { [id]: outcome }), false, profile + " ignores " + id + "/" + outcome);
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
		, selectedOutcomeCases, artifactNamesIncludeProfile: true
		, commandsCompared: previous === null ? 0 : 6 };
};
