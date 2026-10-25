/**
 * Iterative native PHP conversions with bounded walks and scoped identities.
 *
 * @file
 */

/** Private conversion engine. Public callers never see FFI data or type indices. */
export const ownedPhpConversionTransfer = String.raw`
final class OwnedReadFrame
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

final class OwnedConversions
{
    private static function branch(array $node, mixed $value): int {
        if ($node['kind'] === 'option') return $value === null ? 0 : 1;
        if ($node['kind'] === 'result') return $value instanceof @NAMESPACE@\Ok ? 1 : 0;
        if ($node['kind'] === 'variant') {
            foreach ($node['branches'] as $index => $branch) if ($value::class === $branch['class']) return $index;
            throw new \TypeError('Unknown owned variant constructor');
        }
        return 0;
    }
    public static function write(int $type, mixed $value, OwnedConversionScope $scope): \FFI\CData {
        $schema = $scope->schema; $root = $schema->node($type);
        Values::check($type, $value); $scope->state->requireOpen();
        $out = $scope->allocate($root['size']); $stack = [[0, $type, $value, $out, 0]];
        while ($stack) {
            $frame = array_pop($stack);
            if ($frame[0] === 1) {
                [, $items, $fields, $element, $index, $count, $data, $depth] = $frame;
                if ($index === $count) continue;
                $frame[4]++; $stack[] = $frame;
                $field = $element === null ? $fields[$index] : null;
                $childType = $element ?? $field['type']; $child = $schema->nodes[$childType];
                $input = $items[$field === null ? $index : $field['key']];
                $at = $data + ($field === null ? $index * $child['size'] : $field['offset']);
                if ($field !== null && $field['pointer']) {
                    $pointer = $scope->allocate($child['size']); $schema->writePointer($at, $pointer); $at = $pointer;
                }
                $stack[] = [0, $childType, $input, $at, $depth + 1]; continue;
            }
            [, $type, $value, $at, $depth] = $frame; $node = $schema->nodes[$type];
            $scope->storage->step($depth);
            if (!$node['inhabited']) throw new \ValueError('The owned type has no finite value');
            if ($node['identity']) {
                $binding = ResourceAccess::binding($value);
                if (!$binding instanceof NativeBinding) throw new \TypeError('Expected a resource from the native PHP transport');
                $schema->writePointer($at, $scope->pin($binding)); continue;
            }
            if ($node['kind'] === 'primitive') { OwnedScalarNative::write($node, $value, $at, $scope); continue; }
            $element = $node['element']; $fields = [];
            if ($element !== null) {
                $items = $value; $count = count($items); $child = $schema->nodes[$element];
                $scope->storage->children($count); $data = $scope->allocate($count * $child['size']);
                $schema->writePointer($at + $node['dataOffset'], $data);
                $schema->ffi->cast('size_t*', $at + $node['lengthOffset'])[0] = $count;
            } else {
                $tag = self::branch($node, $value); $fields = $node['branches'][$tag]['fields'];
                $items = is_object($value) ? get_object_vars($value) : ($value ?? []); $count = count($fields); $data = $at;
                $scope->storage->children($count);
                if ($node['kind'] === 'variant') $schema->ffi->cast('uint32_t*', $at + $node['flagOffset'])[0] = $tag;
                elseif ($node['flag'] !== null) $at[$node['flagOffset']] = $tag;
            }
            $stack[] = [1, $items, $fields, $element, 0, $count, $data, $depth];
        }
        return $out;
    }
    private static function construct(OwnedReadFrame $frame, array $node, OwnedConversionScope $scope): mixed {
        $scope->checkpoint();
        if ($node['kind'] === 'option' && $frame->class === null) return null;
        if ($frame->class === null) return $frame->values;
        // Initialize exact generated final readonly classes once. Revalidating
        // each recursive tail in its constructor would make decoding quadratic.
        $reflection = new \ReflectionClass($frame->class); $result = $reflection->newInstanceWithoutConstructor();
        foreach ($frame->fields as $index => $field) $reflection->getProperty($field['key'])->setValue($result, $frame->values[$index]);
        return $result;
    }
    public static function read(int $type, \FFI\CData $pointer, OwnedConversionScope $scope, \Closure $identity): mixed {
        $schema = $scope->schema; $root = $schema->node($type); $scope->state->requireOpen();
        $scope->native->charge($root['size']); $pointer = $schema->pointer($pointer, 1, $root['size'], $root['alignment']);
        $stack = [new OwnedReadFrame($type, $pointer, 0)]; $active = [];
        while ($stack) {
            $frame = $stack[count($stack) - 1]; $node = $schema->nodes[$frame->type];
            if (!$frame->entered) {
                $scope->storage->step($frame->depth); $scope->storage->charge(128); $frame->entered = true;
                if (!$node['inhabited']) throw new OwnedInvalidNative('Uninhabited native owned value');
                $frame->identity = $frame->type . ':' . $schema->address($frame->pointer);
                if (isset($active[$frame->identity])) throw new OwnedInvalidNative('Cyclic native owned value');
                $active[$frame->identity] = true;
                if ($node['kind'] !== 'primitive' && !$node['identity']) {
                    if ($node['element'] !== null) {
                        $child = $schema->nodes[$node['element']];
                        $frame->count = $schema->ffi->cast('size_t*', $frame->pointer + $node['lengthOffset'])[0];
                        $scope->storage->children($frame->count); $scope->native->charge($frame->count, $child['size']);
                        $frame->data = $schema->pointer($schema->readPointer($frame->pointer + $node['dataOffset']), $frame->count, $child['size'], $child['alignment']);
                    } else {
                        $tag = $node['kind'] === 'variant' ? $schema->ffi->cast('uint32_t*', $frame->pointer + $node['flagOffset'])[0]
                            : ($node['flag'] !== null ? $frame->pointer[$node['flagOffset']] : 0);
                        $branch = $node['branches'][$tag] ?? throw new OwnedInvalidNative('Invalid native owned branch tag');
                        $frame->fields = $branch['fields']; $frame->class = $branch['class']; $frame->count = count($frame->fields);
                        $scope->storage->children($frame->count);
                    }
                }
            }
            if ($node['identity'] || $node['kind'] === 'primitive' || $frame->index === $frame->count) {
                if ($node['identity']) {
                    $scope->checkpoint(); $schema->pointer($schema->readPointer($frame->pointer), 1, 1, 1);
                    // Own the pointer slot itself; never keep a view into scratch.
                    $handle = $schema->ffi->new($node['ctype']);
                    \FFI::memcpy(\FFI::addr($handle), $frame->pointer, $node['size']);
                    $value = $identity($frame->type, $handle);
                    if ($value::class !== $node['class']) throw new \TypeError('Wrong native identity wrapper');
                    ResourceAccess::binding($value);
                } else $value = $node['kind'] === 'primitive' ? OwnedScalarNative::read($node, $frame->pointer, $scope) : self::construct($frame, $node, $scope);
                unset($active[$frame->identity]); array_pop($stack);
                if (!$stack) { Values::check($type, $value); return $value; }
                $stack[count($stack) - 1]->values[] = $value; continue;
            }
            $index = $frame->index++; $field = $node['element'] === null ? $frame->fields[$index] : null;
            $childType = $node['element'] ?? $field['type']; $child = $schema->nodes[$childType];
            $at = $field === null ? $frame->data + $index * $child['size'] : $frame->pointer + $field['offset'];
            if ($field !== null && $field['pointer']) {
                $scope->native->charge($child['size']); $at = $schema->pointer($schema->readPointer($at), 1, $child['size'], $child['alignment']);
            }
            $stack[] = new OwnedReadFrame($childType, $at, $frame->depth + 1);
        }
        throw new OwnedInvalidNative('Missing owned native result');
    }
}
`;
