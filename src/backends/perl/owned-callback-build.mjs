/**
 * Extend only callback-result component installers, preserving legacy bytes.
 *
 * @file
 */

/**
 * Keep the shared runtime and every earlier component builder byte-identical.
 * The extension defines owned_values after the legacy definition is renamed,
 * so every existing configure, build and prebuilt-sealing call uses v5 checks.
 *
 * @param original - Exact legacy Build.pm text.
 * @param extension - Exact callback-only Perl validator template.
 * @param options - Authenticated component identity and native ownership model.
 * @param options.moduleName - Public Perl component or shared runtime namespace.
 * @param options.model - Authenticated native model, absent for the shared runtime.
 */
export const renderOwnedPerlCallbackBuild = (original, extension, { moduleName, model } = {}) => {
	if(typeof original !== "string") throw new TypeError("Perl installer template must be text");
	const callbacks = model?.bindingIr?.types?.filter(type => type.kind === "callback" && type.callable?.result?.ownership === "borrow") ?? [];
	const witnessed = callbacks.length || model?.schemaVersion === 11
		|| model?.ownedGraph?.schemaVersion === 6 || model?.ownedGraph?.callbackResultAnchors !== undefined;
	if(!witnessed) return original;
	if(typeof moduleName !== "string" || !/^LeanBridge(?:::[A-Za-z][A-Za-z0-9_]*)+$/u.test(moduleName)
		|| /^LeanBridge::Runtime(?:::|$)/u.test(moduleName)) throw new TypeError("Callback-result installers require a component module");
	if(!callbacks.length || model.schemaVersion !== 11 || model.ownedGraph?.schemaVersion !== 6
		|| model.ownedGraph.callbackResultAnchors?.schemaVersion !== 1)
		throw new TypeError("Callback-result installer differs from the native ownership model");
	const marker = "sub owned_values {\n", renamed = "sub _owned_values_before_callback_results {\n";
	if(original.split(marker).length !== 2 || original.includes(renamed))
		throw new TypeError("Callback-result installer requires one unambiguous legacy validator");
	if(typeof extension !== "string" || !extension.startsWith("package LeanBridgeBuild;\n")
		|| extension.split(marker).length !== 2 || !extension.endsWith("1;\n"))
		throw new TypeError("Invalid callback-result installer extension");
	return original.replace(marker, renamed) + "\n" + extension;
};
