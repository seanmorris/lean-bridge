/**
 * Iterative input/output cursors and exception-safe PHP graph invocation.
 *
 * @file
 */

/** Private transfer engine. The only native pointers live inside one call. */
export const phpGraphTransfer = String.raw`
final class GraphReadFrame
{
    public bool $entered = false;
    public int $index = 0;
    public int $count = 0;
    public array $values = [];
    public array $fields = [];
    public ?string $class = null;
    public ?string $identity = null;
    public ?\FFI\CData $data = null;
    public function __construct(public int $type, public \FFI\CData $pointer, public int $depth) {}
}

final class GraphRuntime
{
    private static ?GraphSchema $schema = null;
    public static function schema(): GraphSchema { return self::$schema ??= new GraphSchema(); }
    private static function branch(array $node, mixed $value): int {
        if ($node['kind'] === 'option') return $value === null ? 0 : 1;
        if ($node['kind'] === 'result') return $value instanceof GRAPH_NAMESPACE\Ok ? 1 : 0;
        if ($node['kind'] === 'variant') {
            foreach ($node['branches'] as $index => $branch) if ($value::class === $branch['class']) return $index;
            throw new \TypeError('Unknown copied variant');
        }
        return 0;
    }
    private static function write(int $type, mixed $value, ?\FFI\CData $out, GraphScope $scope): void {
        $schema = $scope->schema; $stack = [[0, $type, $value, $out, 0]];
        while ($stack) {
            $frame = array_pop($stack);
            if ($frame[0] === 1) {
                [, $items, $fields, $element, $index, $count, $data, $depth] = $frame;
                if ($index === $count) continue;
                $frame[4]++; $stack[] = $frame;
                $field = $element === null ? $fields[$index] : null;
                $child = $schema->nodes[$element ?? $field['type']];
                $input = $items[$field === null ? $index : $field['key']];
                $at = $scope->checkOnly ? null : $data + ($field === null ? $index * $child['size'] : $field['offset']);
                if ($field !== null && $field['pointer']) {
                    $pointer = $scope->allocate($child['size']);
                    if (!$scope->checkOnly) $schema->writePointer($at, $pointer);
                    $at = $pointer;
                }
                $stack[] = [0, $element ?? $field['type'], $input, $at, $depth + 1]; continue;
            }
            [, $type, $value, $at, $depth] = $frame; $node = $schema->nodes[$type];
            $scope->storage->step($depth);
            if (!$node['inhabited']) throw new \ValueError('The declared copied type has no finite value');
            if ($node['kind'] === 'primitive') {
                GraphScalars::check(GraphTypes::NODES[$type], $value, $scope->storage);
                GraphScalarNative::write($node, $value, $at, $scope); continue;
            }
            $fields = []; $element = $node['element'];
            if ($element !== null) {
                if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected consecutive-key copied list');
                $items = $value; $count = count($items); $child = $schema->nodes[$element];
                $scope->storage->children($count);
                $data = $scope->allocate($count * $child['size']);
                if (!$scope->checkOnly) { $schema->writePointer($at + 16, $data); $schema->ffi->cast('size_t*', $at + 24)[0] = $count; }
            } else {
                $tag = self::branch($node, $value); $fields = $node['branches'][$tag]['fields'];
                $class = $node['branches'][$tag]['class'];
                if ($class !== null && (!is_object($value) || $value::class !== $class)) throw new \TypeError('Wrong copied constructor');
                if ($class === null && $node['kind'] === 'tuple' && (!is_array($value) || !array_is_list($value) || count($value) !== count($fields)))
                    throw new \TypeError('Wrong copied product arity');
                $items = is_object($value) ? get_object_vars($value) : ($value ?? []); $count = count($fields); $data = $at;
                if ($class !== null && array_keys($items) !== array_column($fields, 'key')) throw new \TypeError('Copied fields must all be initialized');
                $scope->storage->children($count);
                if (!$scope->checkOnly) {
                    if ($node['kind'] === 'variant') $schema->ffi->cast('uint32_t*', $at + 16)[0] = $tag;
                    elseif ($node['kind'] === 'option' || $node['kind'] === 'result') $at[16] = $tag;
                }
            }
            $stack[] = [1, $items, $fields, $element, 0, $count, $data, $depth];
        }
    }
    private static function construct(GraphReadFrame $frame, array $node): mixed {
        GraphScope::checkpoint();
        if ($node['kind'] === 'option' && $frame->class === null) return null;
        if ($frame->class === null) return $frame->values;
        // These exact generated final readonly classes have no user hooks.
        // Initializing once avoids recursively revalidating every completed tail.
        // The complete returned value is checked before the call returns.
        $reflection = new \ReflectionClass($frame->class); $result = $reflection->newInstanceWithoutConstructor();
        foreach ($frame->fields as $index => $field) $reflection->getProperty($field['key'])->setValue($result, $frame->values[$index]);
        return $result;
    }
    private static function read(int $type, \FFI\CData $pointer, GraphScope $scope): mixed {
        $schema = $scope->schema; $stack = [new GraphReadFrame($type, $pointer, 0)]; $active = [];
        while ($stack) {
            $frame = $stack[count($stack) - 1]; $node = $schema->nodes[$frame->type];
            if (!$frame->entered) {
                $scope->storage->step($frame->depth); $scope->storage->charge(128); $frame->entered = true;
                if (!$node['inhabited']) throw new GraphInvalidNative('Uninhabited native copied value');
                $frame->identity = $frame->type . ':' . $schema->address($frame->pointer);
                if (isset($active[$frame->identity])) throw new GraphInvalidNative('Cyclic native copied value');
                $active[$frame->identity] = true;
                if ($node['kind'] !== 'primitive') {
                    if ($node['element'] !== null) {
                        $child = $schema->nodes[$node['element']]; $frame->count = $schema->ffi->cast('size_t*', $frame->pointer + 24)[0];
                        $scope->storage->children($frame->count); $scope->native->charge($frame->count, $child['size']);
                        $frame->data = $schema->pointer($schema->readPointer($frame->pointer + 16), $frame->count, $child['size'], $child['alignment']);
                    } else {
                        $tag = $node['kind'] === 'variant' ? $schema->ffi->cast('uint32_t*', $frame->pointer + 16)[0]
                            : (($node['kind'] === 'option' || $node['kind'] === 'result') ? $frame->pointer[16] : 0);
                        $branch = $node['branches'][$tag] ?? throw new GraphInvalidNative('Invalid native branch tag');
                        $frame->fields = $branch['fields']; $frame->class = $branch['class']; $frame->count = count($frame->fields);
                        $scope->storage->children($frame->count);
                    }
                }
            }
            if ($node['kind'] === 'primitive' || $frame->index === $frame->count) {
                $value = $node['kind'] === 'primitive' ? GraphScalarNative::read($node, $frame->pointer, $scope) : self::construct($frame, $node);
                unset($active[$frame->identity]); array_pop($stack);
                if (!$stack) return $value;
                $stack[count($stack) - 1]->values[] = $value; continue;
            }
            $index = $frame->index++;
            $field = $node['element'] === null ? $frame->fields[$index] : null;
            $childType = $node['element'] ?? $field['type']; $child = $schema->nodes[$childType];
            $at = $field === null ? $frame->data + $index * $child['size'] : $frame->pointer + $field['offset'];
            if ($field !== null && $field['pointer']) {
                $scope->native->charge($child['size']); $at = $schema->pointer($schema->readPointer($at), 1, $child['size'], $child['alignment']);
            }
            $stack[] = new GraphReadFrame($childType, $at, $frame->depth + 1);
        }
        throw new GraphInvalidNative('Missing native result');
    }
    private static function status(int $status): void {
        if (!in_array($status, [0, 1, 2, 3, 5], true)) throw new GraphInvalidNative('Invalid native copied result or status', 4);
        if ($status !== 0) throw new GRAPH_NAMESPACE\LeanBridgeError('Native copied call failed with status ' . $status, $status);
    }
    public static function call(int $function, callable $load, array $arguments): mixed {
        $fn = GraphNativeTypes::FUNCTIONS[$function] ?? throw new \TypeError('Unknown copied function');
        if (!array_is_list($arguments) || count($arguments) !== count($fn['parameters'])) throw new \ArgumentCountError('Wrong copied call arity');
        // Invalid host values never initialize FFI or run a package loader.
        foreach ($fn['parameters'] as $index => $type) Values::check($type, $arguments[$index]);
        $schema = self::schema(); $result = $schema->nodes[$fn['result']];
        $checked = new GraphScope($schema, true);
        foreach ($fn['parameters'] as $index => $type) {
            $checked->allocate($schema->nodes[$type]['size']); self::write($type, $arguments[$index], null, $checked);
        }
        $checked->allocate($result['size']);
        $scope = new GraphScope($schema); $target = null; $output = null;
        try {
            $inputs = [];
            foreach ($fn['parameters'] as $index => $type) {
                $input = $scope->allocate($schema->nodes[$type]['size']); self::write($type, $arguments[$index], $input, $scope); $inputs[] = $input;
            }
            $output = $scope->allocate($result['size']);
            if ($result['kind'] === 'variant') $schema->ffi->cast('uint32_t*', $output + 16)[0] = 4294967295;
            $target = $load();
            if (!$target instanceof GraphTarget) throw new \TypeError('Expected an authenticated graph target');
            if ($target->before !== null) self::status($target->ffi->{$target->before}());
            self::status($target->ffi->{$target->symbol}(...[...$inputs, $output]));
            try {
                $reading = new GraphScope($schema); $reading->native->charge($result['size']);
                $value = self::read($fn['result'], $output, $reading); Values::check($fn['result'], $value);
            } catch (\ValueError|\TypeError $error) { throw new GraphInvalidNative('Invalid native copied result: ' . $error->getMessage(), 0, $error); }
            if ($target->ready !== null && !$target->ffi->{$target->ready}()) self::status(5);
            return $value;
        } catch (GraphInvalidNative $error) {
            if ($target instanceof GraphTarget && $target->retire !== null) $target->ffi->{$target->retire}();
            throw $error;
        } finally {
            try { if ($target instanceof GraphTarget && $output !== null && $result['aggregate']) $target->ffi->{$target->clear}($output); }
            finally { $scope->close(); }
        }
    }
}
`;
