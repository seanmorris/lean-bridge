/**
 * Bounded native PHP scratch and exact scalar conversions for owned values.
 *
 * @file
 */

/** Private generated support. Every FFI binding comes from the pinned loader. */
export const ownedPhpConversionSupport = String.raw`
final class OwnedInvalidNative extends \RuntimeException
{
    public function __construct(string $message) { parent::__construct($message, 9); }
}

final class OwnedSchema
{
    public readonly array $nodes;
    public function __construct(public readonly \FFI $ffi) {
        $nodes = OwnedNativeTypes::NODES;
        foreach ($nodes as &$node) {
            $type = $ffi->type($node['ctype']);
            $node['size'] = \FFI::sizeof($type); $node['alignment'] = \FFI::alignof($type);
            $node['pointerType'] = $ffi->type($node['ctype'] . '*');
            if ($node['flag'] !== null) $node['flagOffset'] = $type->getStructFieldOffset($node['flag']);
            if ($node['element'] !== null || in_array($node['scalar'], ['string', 'bytes'], true)) {
                $node['dataOffset'] = $type->getStructFieldOffset('data');
                $node['lengthOffset'] = $type->getStructFieldOffset('length');
            }
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
    public function node(int $type): array { return $this->nodes[$type] ?? throw new \TypeError('Unknown owned value type'); }
    public function address(\FFI\CData $pointer): int { return $this->ffi->cast('uintptr_t', $pointer)->cdata; }
    public function pointer(?\FFI\CData $pointer, int $count, int $width, int $alignment): ?\FFI\CData {
        if ($count < 0 || $width < 1 || $alignment < 1 || $count > intdiv(16 * 1024 * 1024, $width))
            throw new OwnedInvalidNative('Invalid owned native span');
        if ($count === 0) return null;
        $address = $pointer === null ? 0 : $this->address($pointer);
        if ($address < 4096 || $address % $alignment !== 0 || $address > PHP_INT_MAX - $count * $width)
            throw new OwnedInvalidNative('Missing, misaligned or overflowing owned native pointer');
        return $this->ffi->cast('lb_php_owned_bytes', $pointer);
    }
    public function readPointer(\FFI\CData $at): ?\FFI\CData { return $this->ffi->cast('lb_php_owned_slot', $at)[0]; }
    public function writePointer(\FFI\CData $at, ?\FFI\CData $value): void {
        $this->ffi->cast('lb_php_owned_slot', $at)[0] = $value === null ? null : $this->ffi->cast('lb_php_owned_bytes', $value);
    }
}

final class OwnedConversionScope
{
    private array $memory = [];
    private array $integers = [];
    private array $leases = [];
    private bool $closed = false;
    public readonly GraphBudget $storage;
    public readonly GraphBudget $native;
    public function __construct(public readonly OwnedSchema $schema, public readonly OwnedState $state) {
        $state->requireOpen();
        if ($schema->ffi !== $state->runtime->ffi) throw new \TypeError('Owned conversion schema belongs to another runtime');
        $this->storage = new GraphBudget(); $this->native = new GraphBudget();
    }
    public function checkpoint(): void {
        if ($this->closed) OwnedRuntime::checked(4);
        $this->state->runtime->affinity(); $this->state->runtime->checkpoint();
    }
    public function allocate(int $size): ?\FFI\CData {
        if ($size < 0 || $size > 16 * 1024 * 1024) throw new \ValueError('Owned scratch exceeds 16 MiB');
        $words = intdiv($size + 7, 8); $this->native->charge($words, 8); $this->storage->charge(128);
        $this->checkpoint(); if ($size === 0) return null;
        $owner = $this->schema->ffi->new('uint64_t[' . $words . ']');
        $this->memory[] = $owner;
        return $this->schema->ffi->cast('lb_php_owned_bytes', \FFI::addr($owner[0]));
    }
    public function integer(string $text): \FFI\CData {
        $this->storage->charge(strlen($text), 2); $this->checkpoint();
        $slot = $this->schema->ffi->new('mpz_srcptr');
        $this->integers[] = $slot; $this->checkpoint();
        OwnedRuntime::checked($this->schema->ffi->@PREFIX@_php_integer_new($text, strlen($text), \FFI::addr($slot)));
        return $slot;
    }
    public function pin(NativeBinding $binding): \FFI\CData {
        $this->storage->charge(32); $this->checkpoint();
        $this->leases[] = $binding->pin($this->state);
        return $binding->raw($this->state);
    }
    public function close(): void {
        if ($this->closed) return;
        $this->state->runtime->affinity();
        foreach ($this->integers as $slot) $this->schema->ffi->@PREFIX@_php_integer_free(\FFI::addr($slot));
        $this->integers = []; $this->memory = []; $this->leases = []; $this->closed = true;
    }
    public function __destruct() { try { $this->close(); } catch (\Throwable) {} }
}

final class OwnedScalarNative
{
    public static function write(array $node, mixed $value, \FFI\CData $out, OwnedConversionScope $scope): void {
        $schema = $scope->schema; $ffi = $schema->ffi; $name = $node['scalar'];
        if ($name === 'nat' || $name === 'int') {
            $slot = $scope->integer((string) $value); $schema->writePointer($out, $slot);
        } elseif ($name === 'string' || $name === 'bytes') {
            $bytes = $name === 'bytes' ? $value->toString() : $value; $length = strlen($bytes);
            $scope->storage->charge($length); $data = $scope->allocate($length);
            if ($length) \FFI::memcpy($data, $bytes, $length);
            $schema->writePointer($out + $node['dataOffset'], $data);
            $ffi->cast('size_t*', $out + $node['lengthOffset'])[0] = $length;
        } elseif ($name === 'uint64' || $name === 'usize') {
            $words = IntegerCodec::limbs((string) $value);
            \FFI::memcpy($out, pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);
        } elseif ($name === 'unit' || $name === 'bool') $out[0] = $value ? 1 : 0;
        elseif ($name === 'char') $ffi->cast('uint32_t*', $out)[0] = ScalarCodec::point($value);
        else $ffi->cast($node['pointerType'], $out)[0] = $value;
    }
    public static function read(array $node, \FFI\CData $at, OwnedConversionScope $scope): mixed {
        $schema = $scope->schema; $ffi = $schema->ffi; $name = $node['scalar']; $scope->checkpoint();
        if ($name === 'nat' || $name === 'int') {
            $raw = $schema->pointer($schema->readPointer($at), 1, 1, 8);
            $number = $ffi->cast('mpz_srcptr', $raw); $size = $ffi->new('size_t');
            OwnedRuntime::checked($ffi->@PREFIX@_php_integer_text($number, null, 0, \FFI::addr($size)));
            $capacity = $size->cdata;
            if ($capacity < 2 || $capacity > 16387) throw new OwnedInvalidNative('Invalid owned integer length');
            $data = $scope->allocate($capacity); $scope->storage->charge($capacity);
            OwnedRuntime::checked($ffi->@PREFIX@_php_integer_text($number, $ffi->cast('char*', $data), $capacity, \FFI::addr($size)));
            if ($size->cdata < 1 || $size->cdata >= $capacity) throw new OwnedInvalidNative('Invalid owned decimal length');
            return \Brick\Math\BigInteger::of(\FFI::string($data, $size->cdata));
        }
        if ($name === 'string' || $name === 'bytes') {
            $length = $ffi->cast('size_t*', $at + $node['lengthOffset'])[0];
            $scope->native->charge($length); $scope->storage->charge($length);
            $data = $schema->pointer($schema->readPointer($at + $node['dataOffset']), $length, 1, 1);
            $text = $length ? \FFI::string($data, $length) : '';
            return $name === 'string' ? $text : @NAMESPACE@\Bytes::fromString($text);
        }
        if ($name === 'unit' || $name === 'bool') {
            if ($at[0] > ($name === 'unit' ? 0 : 1)) throw new OwnedInvalidNative('Invalid owned Unit or Bool');
            return $name === 'unit' ? null : $at[0] === 1;
        }
        if ($name === 'uint64' || $name === 'usize')
            return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', \FFI::string($at, 8))), false));
        $raw = $ffi->cast($node['pointerType'], $at)[0];
        if ($name === 'char') {
            if ($raw > 0x10ffff || ($raw >= 0xd800 && $raw <= 0xdfff)) throw new OwnedInvalidNative('Invalid owned Unicode scalar');
            return ScalarCodec::text($raw);
        }
        return $raw;
    }
}
`;
