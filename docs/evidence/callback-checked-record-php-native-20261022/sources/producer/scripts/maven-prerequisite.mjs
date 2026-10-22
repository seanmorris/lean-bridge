/**
 * Retry one failed online acquisition of a pinned Maven build plugin.
 * Offline consumer installation never calls this helper.
 *
 * @file
 */
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

export const mavenPrerequisiteGoals = Object.freeze([
	"org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file"
	, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath"
	, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:get"
]);

const failureDetails = error => {
	const failure = error?.cause ?? error;
	const details = failure?.details ?? failure;
	return { code: failure?.code, killed: failure?.killed, signal: failure?.signal
		, stdout: typeof details?.stdout === "string" ? details.stdout.slice(-8000) : ""
		, stderr: typeof details?.stderr === "string" ? details.stderr.slice(-8000) : "" };
};

/**
 * Recognize only plugin resolution failures for this selected, published version.
 *
 * @param error - Original process failure, possibly wrapped with a cause.
 * @param goal - One of the pinned prerequisite goals.
 */
export const isMavenPrerequisiteResolutionFailure = (error, goal) => {
	if(!mavenPrerequisiteGoals.includes(goal)) return false;
	if(typeof error?.code === "string" && error.code !== "build-command-failed") return false;
	const failure = failureDetails(error);
	if(![1, "build-command-failed"].includes(failure.code) || failure.killed || failure.signal) return false;
	const coordinate = goal.slice(0, goal.lastIndexOf(":"));
	const [group, artifact, version] = coordinate.split(":");
	const output = `${failure.stdout}\n${failure.stderr}`;
	// --errors can put the root artifact failure in the retained tail after the plugin heading.
	const selected = output.includes(`Plugin ${coordinate} or one of its dependencies could not be resolved`)
		|| output.includes(`Could not find artifact ${group}:${artifact}:jar:${version} `)
		|| output.includes(`Could not transfer artifact ${group}:${artifact}:jar:${version} `);
	return selected
		&& /https:\/\/repo\.maven\.apache\.org\/maven2(?:[/\s)]|$)/u.test(output)
		&& /Could not (?:find|transfer) artifact|was not found[^\n]*previous attempt|Failure to transfer/u.test(output);
};

/**
 * Keep both failed attempts visible and preserve the original terminal error.
 *
 * @param args - Online Maven arguments with exactly one pinned plugin goal.
 * @param invoke - Bounded process runner accepting the selected arguments.
 * @param options - Injectable diagnostics and delay for source-only tests.
 */
export const runMavenPrerequisite = async (args, invoke, options = {}) => {
	assert.ok(Array.isArray(args) && args.every(value => typeof value === "string"));
	const goals = args.filter(value => mavenPrerequisiteGoals.includes(value));
	assert.equal(goals.length, 1, "Select exactly one pinned online Maven prerequisite goal");
	assert.ok(args.every(value => value === goals[0] || value.startsWith("-")), "Do not combine plugin acquisition with another Maven goal");
	assert.ok(!args.some(value => ["--offline", "-o", "--fail-never", "-fn"].includes(value)), "Do not retry offline consumers or suppressed failures");
	const diagnostic = options.diagnostic ?? (record => process.stderr.write(`Maven prerequisite: ${JSON.stringify(record)}\n`));
	const pause = options.pause ?? (() => setTimeout(2000));
	const selected = args.filter(value => !["--quiet", "-q"].includes(value));
	for(const flag of ["--errors", "--no-transfer-progress"]) if(!selected.includes(flag)) selected.unshift(flag);
	for(let attempt = 1; attempt <= 2; attempt++)
	{
		try
		{ return await invoke([...selected, ...attempt === 2 && !selected.includes("--update-snapshots") ? ["--update-snapshots"] : []]); }
		catch(error)
		{
			const retry = attempt === 1 && isMavenPrerequisiteResolutionFailure(error, goals[0]);
			diagnostic({ goal: goals[0], attempt, retry, ...failureDetails(error) });
			if(!retry) throw error;
			await pause();
		}
	}
};
