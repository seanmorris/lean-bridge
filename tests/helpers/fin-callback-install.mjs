/**
 * Fin in safe callable directions for the shared installed-package harness (VO #1445).
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as finCallbackEnvironment } from "./copied-fixture-install.mjs";

const coordinate = { name: "fincallbacks", version: "1.0.0" };
/** C and C++ check Fin in callbacks first; other native hosts need their own evidence. */
export const finCallbackTargets = Object.freeze({ c: ["c", coordinate], cpp: ["cpp", coordinate] });
const leasing = ["branch", "counter", "digits", "impossible", "pick", "scaler", "wide"];
/** Exports that return a leased closure, each configured with arity 1. */
export const finCallbackArities = Object.freeze(Object.fromEntries(leasing.map(name => [`FinCallbacks.${name}`, 1])));
export const finCallbackExports = Object.freeze([...leasing, "visit"].map(name => `FinCallbacks.${name}`));

/**
 * Name each generated closure type the C consumer uses, from the compiled Binding IR.
 *
 * @param ir - Binding IR of the installed package.
 */
export const finCallbackConsumerNames = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const field = type => surface.callbacks.get(type.id).field;
	const names = {};
	for(const declaration of ir.declarations)
	{
		const name = declaration.id.split(".").at(-1);
		if(leasing.includes(name)) names[`CLOSURE_${name.toUpperCase()}`] = `${surface.prefix}_owned_${field(declaration.result.type)}`;
		if(name === "visit") names.HOST_VISIT = `${surface.prefix}_${field(declaration.parameters[0].type)}`;
	}
	return names;
};

/**
 * Read a consumer; the C consumer receives the generated closure names as macros.
 *
 * @param profile - Native consumer profile.
 * @param extension - Language source suffix.
 * @param names - Generated closure names.
 */
export const finCallbackConsumerSource = async (profile, extension, names) => {
	const source = await readFile(`tests/fixtures/fin-callback-consumers/${profile}.${extension}`, "utf8");
	if(profile !== "c") return source;
	return `${Object.entries(names).map(([macro, name]) => `#define ${macro} ${name}`).join("\n")}\n${source}`;
};

/**
 * Install and exercise the leased closures and host callback through public C and C++ APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 * @param names - Generated closure names from the compiled Binding IR.
 */
export const installFinCallbackConsumer = (options, names) => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => finCallbackConsumerSource(profile, extension, names)
	, wit: []
	, success: "fin-callback-ok"
} });
