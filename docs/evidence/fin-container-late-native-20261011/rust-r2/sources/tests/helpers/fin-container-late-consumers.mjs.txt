/**
 * Add complete two-input preservation cases without replacing original callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

export const finLateProfiles = Object.freeze(["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native"]);
export const finLateAdditionalChecks = Object.freeze(Object.fromEntries(finLateProfiles.map(profile => [profile, profile === "c" ? 7072 : 6063])));
const consumers = {
	c: ["c", '  printf("fin-container-ok:%u\\n", checks);']
	, cpp: ["cpp", '  std::printf("fin-container-ok:%u\\n", checks);']
	, python: ["py", "print('fin-container-ok:' + str(checks))"]
	, rust: ["rs", '    println!("fin-container-ok:{checks}");']
	, ruby: ["rb", 'puts "fin-container-ok:#{$checks}"']
	, dotnet: ["cs", '        Console.WriteLine($"fin-container-ok:{checks}");']
	, java: ["java", '        System.out.println("fin-container-ok:" + checks);']
	, kotlin: ["kt", '    println("fin-container-ok:$checks")']
	, "php-native": ["php", 'echo "fin-container-ok:$checks\\n";']
};

/**
 * Keep every original and edge assertion, then append the independently counted late cases.
 *
 * @param profile - One of the nine native hosts; WIT has its independent installed supplement.
 */
export const finLateConsumer = async profile => {
	assert.ok(finLateProfiles.includes(profile), "Unknown late-input native profile");
	const [extension, marker] = consumers[profile];
	return insertFinContainerEdgeFragment(await finContainerEdgeConsumer(profile), marker
		, await readFile(`tests/fixtures/fin-container-late-consumers/${profile}.${extension}`, "utf8"));
};
