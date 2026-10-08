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
 * Install and exercise every checked host reply through the public C or C++ API.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 * @param names - Generated host callback names from the installed Binding IR.
 */
export const installFinReplyConsumer = (options, names) => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => finReplyConsumerSource(profile, extension, names)
	, wit: []
	, success: "fin-reply-ok"
	, parseResult: stdout => parseFinReplyResult(options.profile, stdout)
} });
