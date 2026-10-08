/**
 * Host callback replies with Fin bounds for the shared installed-package harness (VO #1453).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";

const coordinate = { name: "finreplies", version: "1.0.0" };
/** C and C++ check Fin in host replies; other native hosts refuse them when the package is built. */
export const finReplyTargets = Object.freeze({ c: ["c", coordinate], cpp: ["cpp", coordinate] });
const exported = ["aliased", "digits", "empty0", "failure", "late", "listed", "maybe", "maybeTile", "nested", "none0", "plain", "product", "slotted", "success", "twice", "wide"];
export const finReplyExports = Object.freeze(exported.map(name => `FinReplies.${name}`));
/** Every CHECK each consumer executes on success, including its second thread's and its fork check. */
export const finReplyExpectedChecks = Object.freeze({ c: 81, cpp: 74 });

/**
 * Name each host callback type the C consumer uses, from the installed Binding IR.
 *
 * @param ir - Binding IR of the installed package.
 */
export const finReplyConsumerNames = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const names = {};
	for(const declaration of ir.declarations)
	{
		const name = declaration.id.split(".").at(-1).replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
		declaration.parameters.forEach((parameter, index) => {
			if(surface.callbacks.has(parameter.type.id)) names[`HOST_${name}${index ? "_second" : ""}`] = `${surface.prefix}_${surface.callbacks.get(parameter.type.id).field}`;
		});
	}
	assert.equal(Object.keys(names).length, 16);
	// The option-of-Tile reply's C name embeds the module path, so the consumer takes it from the installed
	// callback result's copied representation, never from a module name.
	const tile = ir.declarations.find(declaration => declaration.id.endsWith(".maybeTile"));
	names.TILE_REPLY = surface.copy(surface.callbacks.get(tile.parameters[0].type.id).type.callable.result.type).name;
	return names;
};

/**
 * Read a consumer; the C consumer receives the generated host callback names as macros.
 *
 * @param profile - Native consumer profile.
 * @param extension - Language source suffix.
 * @param names - Generated host callback names.
 */
export const finReplyConsumerSource = async (profile, extension, names) => {
	const source = await readFile(`tests/fixtures/fin-reply-consumers/${profile}.${extension}`, "utf8");
	return profile === "c" ? `${Object.entries(names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${source}` : source;
};

/**
 * The consumer prints its forked child's status and then exactly its fixed check count.
 *
 * @param profile - Native consumer profile.
 * @param stdout - Consumer output.
 */
export const parseFinReplyResult = (profile, stdout) => {
	assert.ok(Object.hasOwn(finReplyExpectedChecks, profile), `Unknown Fin reply profile ${profile}`);
	const lines = stdout.trim().split("\n");
	assert.equal(lines.length, 2, stdout);
	const fork = /^fork-status (\d+) 0$/u.exec(lines[0]);
	assert.ok(fork, lines[0]);
	assert.notEqual(Number(fork[1]), 0);
	assert.equal(lines[1], `fin-reply-ok ${profile} ${finReplyExpectedChecks[profile]}`);
	return { checks: finReplyExpectedChecks[profile], forkStatus: Number(fork[1]), forkHostCalls: 0 };
};

/**
 * The installed-consumer fixture for one profile, with its exact check count.
 *
 * @param profile - Native consumer profile.
 * @param names - Generated host callback names from the installed Binding IR.
 * @param seen - Receives the consumer's stdout once it ran.
 */
export const finReplyFixture = (profile, names, seen = {}) => ({
	source: (_profile, extension) => finReplyConsumerSource(profile, extension, names)
	, wit: []
	, success: "fin-reply-ok"
	// The shared helper compares exactly this count instead of its generic minimum.
	, expectedChecks: finReplyExpectedChecks[profile]
	, parseResult: stdout => {
		seen.stdout = stdout;
		return parseFinReplyResult(profile, stdout);
	}
});

/**
 * Install and exercise every checked host reply through the public C or C++ API. A process failure keeps
 * the runner's own details (exit status, output). A failure after a successful process gains its exact
 * output: the stdout the parser saw, or the stderr the shared helper refused through
 * `assert.equal(result.stderr, "")`. The shared helper and its thresholds are unchanged.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 * @param names - Generated host callback names from the installed Binding IR.
 * @param install - Shared installed-consumer helper; replaceable only by tests.
 */
export const installFinReplyConsumer = async (options, names, install = installCopiedConsumer) => {
	const seen = {};
	try
	{ return await install({ ...options, fixture: finReplyFixture(options.profile, names, seen) }); }
	catch(error)
	{
		if(error instanceof assert.AssertionError)
		{
			const stderr = error.expected === "" && typeof error.actual === "string" ? { stderr: error.actual } : {};
			if(seen.stdout !== undefined || stderr.stderr !== undefined) error.details = { ...error.details, ...seen, ...stderr };
		}
		throw error;
	}
};
