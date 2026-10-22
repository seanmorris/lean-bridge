/**
 * PHP FFI schema, bounded owned scratch and exact scalar graph conversions.
 *
 * @file
 */

/** Private runtime source. Native FFI calls use the 64-bit Linux graph ABI. */
export const phpGraphNativeSupport = String.raw`
final class GraphInvalidNative extends \RuntimeException {}

final readonly class GraphTarget
{
    public function __construct(public \FFI $ffi, public string $symbol, public string $clear,
        public ?string $before = null, public ?string $ready = null, public ?string $retire = null) {}
}

final class GraphSchema
{
    public readonly \FFI $ffi;
    public readonly array $nodes;
    public function __construct() {
        if (PHP_INT_SIZE !== 8 || PHP_OS_FAMILY !== 'Linux' || php_uname('m') !== 'x86_64'
            || pack('S', 1) !== "\x01\x00") throw new \RuntimeException('Native PHP copied graphs require Linux x86-64');
        $this->ffi = \FFI::cdef(GraphNativeTypes::DEFINITIONS);
        $nodes = GraphNativeTypes::NODES;
        foreach ($nodes as &$node) {
            $type = $this->ffi->type($node['ctype']);
            $node['size'] = \FFI::sizeof($type); $node['alignment'] = \FFI::alignof($type);
            $node['pointerType'] = $this->ffi->type($node['ctype'] . '*');
            foreach ($node['branches'] as &$branch) {
                foreach ($branch['fields'] as &$field) {
                    $offset = 0; $current = $type;
                    foreach ($field['path'] as $name) {
                        $offset += $current->getStructFieldOffset($name); $current = $current->getStructFieldType($name);
                    }
                    $field['offset'] = $offset;
                }
                unset($field);
            }
            unset($branch);
        }
        unset($node); $this->nodes = $nodes;
    }
    public function address(\FFI\CData $pointer): int { return $this->ffi->cast('uintptr_t', $pointer)->cdata; }
    public function pointer(?\FFI\CData $pointer, int $count, int $width, int $alignment): ?\FFI\CData {
        if ($count < 0 || $width < 1 || $count > intdiv(16 * 1024 * 1024, $width)) throw new GraphInvalidNative('Invalid native span length');
        if ($count === 0) return null;
        $address = $pointer === null ? 0 : $this->address($pointer);
        if ($address < 4096 || $address % $alignment !== 0 || $address > PHP_INT_MAX - $count * $width)
            throw new GraphInvalidNative('Missing, misaligned or overflowing native pointer');
        return $this->ffi->cast('lb_php_graph_byte_pointer', $pointer);
    }
    public function readPointer(\FFI\CData $at): ?\FFI\CData { return $this->ffi->cast('lb_php_graph_byte_slot', $at)[0]; }
    public function writePointer(\FFI\CData $at, ?\FFI\CData $value): void { $this->ffi->cast('lb_php_graph_byte_slot', $at)[0] = $value; }
}

final class GraphScope
{
    private array $owners = [];
    public readonly GraphBudget $storage;
    public readonly GraphBudget $native;
    public function __construct(public readonly GraphSchema $schema, public readonly bool $checkOnly = false) {
        $this->storage = new GraphBudget(); $this->native = new GraphBudget();
    }
    public static function checkpoint(): void {}
    public function allocate(int $size): ?\FFI\CData {
        $words = intdiv($size + 7, 8); $this->native->charge($words, 8); $this->storage->charge(128);
        if ($this->checkOnly || $size === 0) return null;
        self::checkpoint(); $owner = $this->schema->ffi->new('uint64_t[' . $words . ']');
        $this->owners[] = $owner;
        return $this->schema->ffi->cast('lb_php_graph_byte_pointer', \FFI::addr($owner[0]));
    }
    public function close(): void { $this->owners = []; }
}

final class GraphScalarNative
{
    public static function write(array $node, mixed $value, ?\FFI\CData $out, GraphScope $scope): void {
        $ffi = $scope->schema->ffi; $name = $node['scalar'];
        if ($node['aggregate']) {
            $limbs = $name === 'nat' || $name === 'int';
            if ($limbs) {
                $words = IntegerCodec::limbs((string) $value); $length = count($words); $width = 4;
                $scope->storage->charge($length, 32); $bytes = '';
                if (!$scope->checkOnly) foreach ($words as $word) $bytes .= pack('V', $word);
            } else { $bytes = $name === 'bytes' ? $value->toString() : $value; $length = strlen($bytes); $width = 1; }
            $scope->storage->charge($length, $width);
            $data = $scope->allocate($length * $width);
            if (!$scope->checkOnly) {
                if ($length) \FFI::memcpy($data, $bytes, $length * $width);
                $scope->schema->writePointer($out + 16, $data); $ffi->cast('size_t*', $out + 24)[0] = $length;
                if ($name === 'int') $out[32] = str_starts_with((string) $value, '-') ? 1 : 0;
            }
            return;
        }
        if ($scope->checkOnly) return;
        if ($name === 'uint64' || $name === 'usize') {
            $words = IntegerCodec::limbs((string) $value);
            \FFI::memcpy($out, pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);
        } elseif ($name === 'unit' || $name === 'bool') $out[0] = $value ? 1 : 0;
        elseif ($name === 'char') $ffi->cast('uint32_t*', $out)[0] = ScalarCodec::point($value);
        else $ffi->cast($node['pointerType'], $out)[0] = $value;
    }
    public static function read(array $node, \FFI\CData $value, GraphScope $scope): mixed {
        $ffi = $scope->schema->ffi; $name = $node['scalar']; GraphScope::checkpoint();
        if ($node['aggregate']) {
            $limbs = $name === 'nat' || $name === 'int'; $width = $limbs ? 4 : 1;
            $length = $ffi->cast('size_t*', $value + 24)[0];
            $scope->native->charge($length, $width); $scope->storage->charge($length, $limbs ? 32 : 1);
            if ($limbs && $length > 1701) throw new GraphInvalidNative('Native integer exceeds 16384 decimal digits');
            $data = $scope->schema->pointer($scope->schema->readPointer($value + 16), $length, $width, $width);
            $bytes = $length ? \FFI::string($data, $length * $width) : '';
            if ($limbs) {
                $negative = $name === 'int' ? $value[32] : 0;
                if ($negative > 1 || ($negative && !$length)) throw new GraphInvalidNative('Invalid native integer sign');
                $words = $length ? array_values(unpack('V*', $bytes)) : [];
                if ($length && $words[$length - 1] === 0) throw new GraphInvalidNative('Noncanonical native integer magnitude');
                return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, (bool) $negative));
            }
            if ($name === 'string') {
                if (preg_match('//u', $bytes) !== 1) throw new GraphInvalidNative('Invalid native UTF-8');
                return $bytes;
            }
            return GRAPH_NAMESPACE\Bytes::fromString($bytes);
        }
        if ($name === 'unit' || $name === 'bool') {
            $raw = $value[0];
            if ($raw > ($name === 'unit' ? 0 : 1)) throw new GraphInvalidNative('Invalid native Unit or Bool');
            return $name === 'unit' ? null : (bool) $raw;
        }
        if ($name === 'uint64' || $name === 'usize')
            return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', \FFI::string($value, 8))), false));
        $raw = $ffi->cast($node['pointerType'], $value)[0];
        if ($name === 'char') {
            if ($raw > 0x10ffff || ($raw >= 0xd800 && $raw <= 0xdfff)) throw new GraphInvalidNative('Invalid native Char');
            return ScalarCodec::text($raw);
        }
        return $raw;
    }
}
`;
