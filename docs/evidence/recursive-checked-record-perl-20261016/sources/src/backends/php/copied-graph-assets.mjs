/**
 * Bind recursive PHP calls to the existing authenticated process-wide loader.
 *
 * @file
 */
import { canonicalJson } from "../../capsule/node.mjs";
import { copiedPhpAssets } from "./copied-assets.mjs";

/**
 * Emit private function targets after checking their complete native identities.
 *
 * @param model - Validated recursive PHP package model.
 * @param evidence - Closed native identities, or null for source inspection.
 */
export const phpGraphAssets = (model, evidence) => {
	if(evidence !== null)
	{
		const fields = ["componentId", "componentReceiptSha256", "copiedGraph", "libraries", "library", "runtimeIdentity"];
		if(!evidence || canonicalJson(Object.keys(evidence).sort()) !== canonicalJson(fields)
			|| evidence.componentId !== model.ir.component.id || evidence.library !== `lib${model.prefix}.so`
			|| !/^[a-f0-9]{64}$/.test(evidence.runtimeIdentity) || !/^[a-f0-9]{64}$/.test(evidence.componentReceiptSha256)
			|| canonicalJson(evidence.copiedGraph ?? null) !== canonicalJson({ schemaVersion: 1, layoutSha256: model.layoutSha256 })
			|| !evidence.libraries || typeof evidence.libraries !== "object" || Array.isArray(evidence.libraries))
			throw new TypeError("PHP graph loading evidence differs from the component or layout");
		const libraries = Object.entries(evidence.libraries);
		if(libraries.length < 4 || libraries.some(([name, hash]) => !/^lib[A-Za-z0-9_.-]+\.so(?:\.\d+)*$/.test(name) || !/^[a-f0-9]{64}$/.test(hash))
			|| [evidence.library, "libleanshared.so", "liblean_bridge_native.so"].some(name => !Object.hasOwn(evidence.libraries, name)))
			throw new TypeError("PHP graph loading requires exact native asset identities");
	}
	const p = model.prefix;
	return `<?php
declare(strict_types=1);
namespace ${model.namespace}\\Internal;

require_once __DIR__ . '/Runtime.php';
require_once __DIR__ . '/GraphNative.php';

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
uint32_t ${p}_graph_initialize(void);
int ${p}_graph_ready(void);
void ${p}_graph_retire(void);
void ${p}_php_graph_clear(void *);
${model.functions.map(fn => `uint32_t ${fn.name}_graph(${[...fn.parameters.map(() => "const void *"), "void *"].join(", ")});`).join("\n")}
CDEFS;
    private static ?array $targets = null;
    private static function load(): \\FFI {
        ${copiedPhpAssets(evidence)}
    }
    private static function target(int $function): GraphTarget {
        \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess();
        if (self::$targets === null) {
            $ffi = self::load();
            self::$targets = [
${model.functions.map(fn => `                new GraphTarget($ffi, '${fn.name}_graph', '${p}_php_graph_clear', '${p}_graph_initialize', '${p}_graph_ready', '${p}_graph_retire'),`).join("\n")}
            ];
        }
        return self::$targets[$function];
    }
    public static function call(int $function, array $arguments): mixed {
        try {
            return GraphRuntime::call($function, static fn(): GraphTarget => self::target($function), $arguments);
        } catch (GraphInvalidNative $error) {
            throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), 4, $error);
        }
    }
}
`;
};
