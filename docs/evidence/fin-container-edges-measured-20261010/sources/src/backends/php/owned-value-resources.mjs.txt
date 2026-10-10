/**
 * Opaque PHP identities shared by native and Zend ownership transports.
 *
 * @file
 */

/**
 * The transport implements the private binding, including scope checks and
 * native cleanup. No PHP value constructor accepts a token or native pointer.
 */
export const ownedPhpValueResources = String.raw`
interface ResourceBinding
{
    public function check(): void;
    public function close(): void;
    public function retain(): ResourceBinding;
    public function invoke(array $arguments): mixed;
}

abstract class Resource
{
    private function __construct(private ResourceBinding $binding) {}
    private function __clone() {}
    final public function close(): void { $this->binding->close(); }
    final public function retain(): static {
        $binding = ResourceAccess::binding($this);
        $retained = $binding->retain();
        try { return ResourceAccess::wrap(static::class, $retained); }
        catch (\Throwable $error) {
            try { $retained->close(); } catch (\Throwable) {}
            throw $error;
        }
    }
    final public function __serialize(): array { throw new \LogicException('Lean identities cannot be serialized'); }
    final public function __unserialize(array $data): void { throw new \LogicException('Lean identities cannot be deserialized'); }
}

final class ResourceAccess
{
    public static function wrap(string $class, ResourceBinding $binding): Resource {
        if (!isset(GraphTypes::IDENTITIES[$class])) throw new \TypeError('Expected an exact generated resource class');
        $binding->check();
        $create = \Closure::bind(static fn() => new $class($binding), null, Resource::class);
        return $create();
    }
    public static function binding(Resource $value): ResourceBinding {
        if (!isset(GraphTypes::IDENTITIES[$value::class])) throw new \TypeError('Expected an exact generated resource class');
        $read = \Closure::bind(static fn(Resource $value) => $value->binding ?? null, null, Resource::class);
        $binding = $read($value);
        if (!$binding instanceof ResourceBinding) throw new \TypeError('Lean resource must be initialized by its transport');
        $binding->check();
        return $binding;
    }
    public static function invoke(Resource $value, array $arguments): mixed {
        return self::binding($value)->invoke($arguments);
    }
}
`;
