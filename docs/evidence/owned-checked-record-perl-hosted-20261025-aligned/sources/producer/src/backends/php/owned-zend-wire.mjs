/**
 * Typed PHP graphs over the private resource-bearing Zend wire.
 *
 * @file
 */
import { phpGraphWire } from "./copied-graph-wire.mjs";

const replace = (source, before, after) => {
	if(source.split(before).length !== 2) throw new TypeError("Owned Zend wire source anchor changed");
	return source.replace(before, after);
};

/**
 * Reuse the bounded graph conversion algorithm, with explicit ownership hooks
 * and the private owned ABI's canonical error-bit result tag.
 *
 * @param namespace - Exact generated PHP namespace.
 */
export const ownedZendPhpWire = namespace => {
	let source = phpGraphWire;
	source = replace(source, "$frame->branch = $wire[0] ? 0 : 1;", "$frame->branch = $wire[0] ? 1 : 0;");
	source = replace(source, "$frame->branch === 0, $frame->values[0]", "$frame->branch === 1, $frame->values[0]");
	source = replace(source, "if ($node['kind'] !== 'primitive') self::enter", "if (!in_array($node['kind'], ['primitive', 'resource', 'callback'], true)) self::enter");
	source = replace(source, ": self::construct($frame, $node, $reading);", ": (in_array($node['kind'], ['resource', 'callback'], true) ? self::identity($frame->type, $node, $frame->value, $reading) : self::construct($frame, $node, $reading));");
	source = replace(source, "final class GraphWire\n{", String.raw`final class GraphWire
{
    public static function transfer(int $type, mixed $value, bool $reading, GraphBudget $budget): mixed {
        $result = self::walk($type, $value, $reading, $budget);
        if ($reading) {
            try { Values::check($type, $result); }
            catch (\TypeError|\ValueError $error) { throw new GraphInvalidWire($error->getMessage(), 0, $error); }
        }
        return $result;
    }
    private static function identity(int $type, array $node, mixed $value, bool $reading): mixed {
        if ($reading) {
            if (!is_resource($value)) throw new GraphInvalidWire('Expected a private Zend identity resource');
            return ResourceAccess::wrap($node['classes'][0], new ZendBinding($type, $value));
        }
        if (!$value instanceof Resource || $node['classes'] !== [$value::class]) throw new \TypeError('Wrong nominal owned identity');
        $binding = ResourceAccess::binding($value);
        if (!$binding instanceof ZendBinding) throw new \TypeError('Owned identity belongs to another transport');
        return $binding->wire($type);
    }`);
	return source.replaceAll("GRAPH_NAMESPACE", `\\${namespace}`).replaceAll("Copied", "Owned").replaceAll("copied", "owned");
};
