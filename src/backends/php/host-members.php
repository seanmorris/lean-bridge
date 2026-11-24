<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Bound to one application-supplied class table on the PHP owner. */
final class HostMembers
{
    private array $classes = [];
    private array $members = [];
    private readonly int $pid;
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a PHP host binding'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a PHP host binding'); }

    public function __construct(array $model, array $bindings) {
        $this->pid = getmypid();
        if (count($bindings) !== count($model['kinds'])) throw new \TypeError('Expected an exact PHP host class table');
        foreach ($model['kinds'] as $kind) {
            $name = $bindings[$kind['name']] ?? null;
            if (!is_string($name) || $name === '' || (!class_exists($name) && !interface_exists($name))) {
                throw new \TypeError('Expected a class for '.$kind['name']);
            }
            $this->classes[] = (new \ReflectionClass($name))->getName();
        }
        foreach ($model['members'] as $spec) {
            $class = new \ReflectionClass($this->classes[$spec['owner']]);
            $op = $spec['op']; $name = $spec['name']; $property = null;
            if (!in_array($op,['constructor','method','static-method','get','set'],true)) throw new \UnexpectedValueException('Unknown host operation');
            $self = in_array($op, ['method','get','set'], true);
            if ($op === 'get' || $op === 'set') {
                if (!$class->hasProperty($name)) throw new \TypeError('Missing declared host property '.$name);
                $property = $class->getProperty($name);
                if (!$property->isPublic() || $property->isStatic() || ($op === 'set' && ($property->isReadOnly()
                    || (method_exists($property,'isPrivateSet') && ($property->isPrivateSet() || $property->isProtectedSet()))))) {
                    throw new \TypeError('Inaccessible host property '.$name);
                }
                if (method_exists($property,'isVirtual') && $property->isVirtual()
                    && !$property->hasHook($op === 'get' ? \PropertyHookType::Get : \PropertyHookType::Set)) {
                    throw new \TypeError('Missing declared host property hook '.$name);
                }
            } else {
                $arity = count($spec['args']) - (int)$self;
                if ($op === 'constructor') {
                    if (!$class->isInstantiable()) throw new \TypeError('Host class is not constructible');
                    $method = $class->getConstructor();
                } else {
                    if (!$class->hasMethod($name)) throw new \TypeError('Missing declared host method '.$name);
                    $method = $class->getMethod($name);
                }
                // Reflection verifies the member. Invoke it normally under
                // strict_types, without granting reflection visibility or coercion.
                if ($method === null ? $arity !== 0 : (!$method->isPublic() || $method->isStatic() !== ($op === 'static-method')
                    || $method->returnsReference() || $arity < $method->getNumberOfRequiredParameters()
                    || (!$method->isVariadic() && $arity > $method->getNumberOfParameters()))) {
                    throw new \TypeError('Incompatible host method '.$name);
                }
                foreach ($method?->getParameters() ?? [] as $i => $arg) {
                    if ($i < $arity && $arg->isPassedByReference()) throw new \TypeError('By-reference host parameter '.$name);
                }
            }
            $this->members[] = [$spec,$property,$self];
        }
    }

    public function classAt(int $kind): string {
        return $this->classes[$kind] ?? throw new \UnexpectedValueException('Unknown host class slot');
    }
    public function memberAt(int $slot): array {
        return $this->members[$slot][0] ?? throw new \UnexpectedValueException('Unknown host member slot');
    }
    public function nominal(int $kind, mixed $value): void {
        $class = $this->classes[$kind];
        if (!$value instanceof $class) throw new \TypeError('Expected a PHP host object of type '.$class);
    }

    /**
     * Private wire callers supply decoded scalar arguments and encode scalar
     * results afterwards. Only user method execution is caught as a Throwable.
     * Boundary validation never masquerades as a failure from the application.
     */
    public function invoke(int $slot, array $arguments): array {
        if ($this->pid !== getmypid()) throw new \LogicException('Cannot use an inherited PHP host binding');
        [$spec,$property,$self] = $this->members[$slot] ?? throw new \UnexpectedValueException('Unknown host member slot');
        if (!array_is_list($arguments) || count($arguments) !== count($spec['args'])) throw new \UnexpectedValueException('Invalid host argument frame');
        foreach ($spec['args'] as $i => $carrier) if (is_int($carrier)) $this->nominal($carrier,$arguments[$i]);
        $class = $this->classes[$spec['owner']]; $name = $spec['name']; $op = $spec['op'];
        $object = $self ? array_shift($arguments) : null;
        // An unset declared property can otherwise redirect to __get/__set.
        // A PHP 8.4+ virtual property has no backing slot: its declared hooks are the member.
        if ($property !== null) {
            // A subclass may supply a hook for a plain property in its parent.
            if (get_class($object) !== $class) $property = new \ReflectionProperty($object,$name);
            $hooked = method_exists($property,'hasHook') && $property->hasHook($op === 'get' ? \PropertyHookType::Get : \PropertyHookType::Set);
            if (!$hooked && !$property->isInitialized($object) && ($op === 'get' || method_exists($object,'__set'))) {
                throw new \TypeError('Uninitialized or unset PHP host property '.$name);
            }
        }
        try {
            if ($op === 'constructor') $value = new $class(...$arguments);
            elseif ($op === 'method') $value = $object->$name(...$arguments);
            elseif ($op === 'static-method') $value = $class::$name(...$arguments);
            elseif ($op === 'get') $value = $object->$name;
            else { $object->$name = $arguments[0]; $value = null; }
        } catch (\Throwable $e) { return [false,$e]; }
        if (is_int($spec['result'])) $this->nominal($spec['result'],$value);
        return [true,$value];
    }
}
