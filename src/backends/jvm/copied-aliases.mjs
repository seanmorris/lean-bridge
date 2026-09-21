/**
 * Preserve copied alias contracts in Maven metadata and generated Java documentation.
 *
 * @file
 */
/**
 * Escape text embedded in Javadoc, including comment terminators and inline tags.
 *
 * @param value - Contract text, not raw markup.
 */
const html = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;").replaceAll("/", "&#47;").replaceAll("{", "&#123;").replaceAll("}", "&#125;");
const contractType = (model, ref) => ref.kind === "primitive" ? ref.name
	: ref.kind === "named" ? model.ir.types.find(type => type.id === ref.id).name
		: `${ref.constructor}<${ref.arguments.map(argument => contractType(model, argument)).join(", ")}>`;
const kotlinPrimitives = { unit: "Unit", bool: "Boolean", uint8: "Int"
	, uint16: "Int", uint32: "Long", uint64: "java.math.BigInteger"
	, int8: "Byte", int16: "Short", int32: "Int", int64: "Long"
	, nat: "java.math.BigInteger", int: "java.math.BigInteger"
	, float32: "Float", float64: "Double"
	, char: "Int", string: "String", bytes: "ByteArray"
};
const kotlinType = copy => copy.record ? copy.publicName
	: copy.compound ? `${{ option: "Option", result: "Result", tuple: "Pair" }[copy.compound]}<${copy.fields.map(field => kotlinType(field.type)).join(", ")}>`
		: copy.element ? ["Boolean", "Byte", "Short", "Int", "Long", "Float", "Double"].includes(kotlinType(copy.element))
			? `${kotlinType(copy.element)}Array` : `Array<${kotlinType(copy.element)}>`
			: kotlinPrimitives[copy.scalarName];

/**
 * Retain original targets and chains beside both consumer-language spellings.
 *
 * @param model - Closed copied JVM projection.
 */
export const jvmCopiedAliases = model => model.surface.aliases.map(({ definition, copy }) => ({
	id: definition.id, name: definition.name, target: definition.target
	, javaType: model.publicType(copy), kotlinType: kotlinType(copy)
}));

/**
 * Document contracts without manufacturing Java wrapper identities.
 *
 * @param model - Closed copied JVM projection.
 */
export const jvmAliasCatalogDocs = model => !model.surface.aliases.length ? "" : `/**
 * Copied Lean aliases use their JVM target values. The binding manifest retains their contract identities.
 * <table><caption>Copied alias contracts</caption>
 * <tr><th>Lean alias</th><th>Contract target</th><th>Java value type</th><th>Kotlin value type</th></tr>
${jvmCopiedAliases(model).map(alias => ` * <tr><td><code>${html(alias.name)}</code></td><td><code>${html(contractType(model, alias.target))}</code></td><td><code>${html(alias.javaType)}</code></td><td><code>${html(alias.kotlinType)}</code></td></tr>`).join("\n")}
 * </table>
 */
`;

/**
 * Retain contract names at each parameter, result and record component.
 *
 * @param model - Closed copied JVM projection.
 * @param parameters - Original references paired with generated parameter names.
 * @param result - Optional original result reference.
 * @param returnsVoid - Whether this method returns Unit as void.
 */
export const jvmAliasSiteDocs = (model, parameters, result = null, returnsVoid = false) => {
	if(!model.surface.aliases.length) return "";
	const lines = parameters.map(site => ` * @param ${site.name} Contract type: <code>${html(contractType(model, site.type))}</code>.`);
	if(result) lines.push(returnsVoid
		? ` * Unit result contract: <code>${html(contractType(model, result))}</code>.`
		: ` * @return Contract type: <code>${html(contractType(model, result))}</code>.`);
	return lines.length ? `/**\n${lines.join("\n")}\n */\n` : "";
};

/**
 * Describe the exact installed Java API consumed by both languages.
 *
 * @param model - Closed copied JVM projection.
 */
export const jvmAliasReadme = model => !model.surface.aliases.length ? "" : `
## Copied Lean aliases

This Maven package exports a Java API, also callable from Kotlin. Pass and receive the target values below. Alias names, original targets and chains remain in the installed binding manifest and generated Java source documentation; they do not introduce JVM classes or exported Kotlin typealias declarations. Alias parameters, results and record fields retain their target validation. Nat rejects negative BigInteger values; Int accepts them. UInt32 uses checked long/Long. Unit inputs use the generated Unit.INSTANCE; Unit outputs return void (kotlin.Unit). Import the generated Unit and Pair explicitly in Kotlin to distinguish them from kotlin.Unit and kotlin.Pair. Native variants, recursive values, identity-bearing targets and compound callable payloads remain unsupported.

| Lean alias | Contract target | Java value type | Kotlin value type |
| --- | --- | --- | --- |
${jvmCopiedAliases(model).map(alias => `| \`${alias.name}\` | \`${contractType(model, alias.target)}\` | \`${alias.javaType}\` | \`${alias.kotlinType}\` |`).join("\n")}
`;
