/**
 * Bounded PHP graph transfers, borrowed callbacks and owned function leases.
 *
 * @file
 */

/** Private PHP implementation template. */
export const phpCallableGraphTransfers = String.raw`
final class CallableTransfers
{
    private static ?\Closure $write = null;
    private static ?\Closure $read = null;
    private static ?\Closure $validate = null;
    private static function validate(array $types, array $arguments): void {
        self::$validate ??= \Closure::bind(static function($type,$value,$budget): void {
            foreach (Values::walk($value,$type,$budget) as $_) {}
        },null,Values::class);
        $budget=new GraphBudget();
        foreach ($types as $index=>$type) (self::$validate)($type,$arguments[$index],$budget);
    }
    private static function write(int $type, mixed $value, ?\FFI\CData $output, GraphScope $scope): void {
        self::$write ??= \Closure::bind(static fn($type,$value,$output,$scope)=>GraphRuntime::write($type,$value,$output,$scope),null,GraphRuntime::class);
        (self::$write)($type,$value,$output,$scope);
    }
    public static function encode(array $types, array $arguments, ?int $resultType): array {
        if (!array_is_list($arguments) || count($types)!==count($arguments)) throw new \ArgumentCountError('Wrong copied callable arity');
        // Validate the complete call with one host budget before initializing FFI.
        self::validate($types,$arguments);
        $schema=GraphRuntime::schema();
        $checking=new GraphScope($schema,true);
        foreach ($types as $index=>$type) {
            $checking->allocate($schema->nodes[$type]['size']);
            self::write($type,$arguments[$index],null,$checking);
        }
        $checking->allocate($resultType===null ? 8 : $schema->nodes[$resultType]['size']);
        $scope=new GraphScope($schema);
        try {
            $roots=[];
            foreach ($types as $index=>$type) {
                $root=$scope->allocate($schema->nodes[$type]['size']);
                self::write($type,$arguments[$index],$root,$scope);
                $roots[]=$root;
            }
            return [$scope,$roots];
        } catch (\Throwable $error) { $scope->close(); throw $error; }
    }
    public static function decode(int $type, \FFI\CData $pointer, GraphScope $scope): mixed {
        self::$read ??= \Closure::bind(static fn($type,$pointer,$scope)=>GraphRuntime::read($type,$pointer,$scope),null,GraphRuntime::class);
        $node=$scope->schema->nodes[$type];
        // Normalize FFI callback parameter views before converting an address to int.
        $pointer=$scope->schema->pointer($scope->schema->ffi->cast('lb_php_graph_byte_pointer',$pointer),1,$node['size'],$node['alignment']);
        $scope->native->charge($node['size']);
        try {
            $value=(self::$read)($type,$pointer,$scope);
            Values::check($type,$value);
            return $value;
        } catch (\TypeError|\ValueError $error) {
            throw new GraphInvalidNative('Invalid native callable value: '.$error->getMessage(),4,$error);
        }
    }
    public static function encodeReply(int $type, mixed $value, GraphScope $scope): \FFI\CData {
        Values::check($type,$value);
        $root=$scope->allocate($scope->schema->nodes[$type]['size']);
        self::write($type,$value,$root,$scope);
        return $root;
    }
}
`;

/** Private PHP implementation template. */
export const phpCallableGraphLease = String.raw`
final class Lease
{
    private int $token = 0;
    private int $pid;
    private bool $adopted = false;
    private bool $closed = false;
    private int $active = 0;

    public function __construct(private \Closure $invoke, private \Closure $dispose, private int $arity) {
        self::ensureCall();
        if ($arity < 1 || $arity > 16) throw new \ArgumentCountError('Unsupported Lean closure arity');
        $this->pid = getmypid();
    }
    public static function ensureCall(): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if (\Fiber::getCurrent() !== null) throw new \LogicException('Lean callables require the main PHP execution context');
    }
    public function adopt(int $token): void {
        self::ensureCall();
        if ($this->closed || $this->adopted || $token === 0) throw new \LogicException('Invalid returned Lean closure identity');
        $this->token = $token; $this->adopted = true;
    }
    public function isClosed(): bool {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        return $this->closed;
    }
    public function invoke(array $arguments): mixed {
        self::ensureCall();
        if ($this->closed || !$this->adopted) throw new \LogicException('Lean closure is closed or has no native identity');
        if (!array_is_list($arguments) || count($arguments) !== $this->arity)
            throw new \ArgumentCountError('Lean closure requires exactly ' . $this->arity . ' positional arguments');
        ++$this->active;
        try { return ($this->invoke)($this->token, $arguments); }
        finally { --$this->active; if ($this->closed && $this->active === 0) $this->release(); }
    }
    private function release(): void {
        $token = $this->token; $this->token = 0;
        if ($token !== 0) ($this->dispose)($token);
    }
    public function close(): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        $this->closed = true;
        if ($this->active === 0) $this->release();
    }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Lean closures cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Lean closures cannot be unserialized'); }
    public function __destruct() {
        try { if (isset($this->pid) && $this->pid === getmypid()) $this->close(); } catch (\Throwable $ignored) {}
    }
}
`;

/** Private PHP implementation template. */
export const phpCallableGraphRuntime = String.raw`
final class NativeCallableFrame
{
    public ?\Throwable $failure = null;
    public array $ids = [];
    public bool $active = true;
    public function __construct(public readonly GraphScope $scope) {}
}

final class CallableRuntime
{
    private ?\FFI $ffi = null;
    private array $stubs = [];
    private array $contexts = [];
    private int $nextContext = 0;
    private int $depth = 0;
    public function __construct(private readonly \Closure $loader, private readonly array $catalog) {}
    private function load(): \FFI {
        return $this->ffi ??= ($this->loader)();
    }
    private function ready(): void {
        if (!$this->ffi->{$this->catalog['prefix'].'_graph_ready'}()) throw new GRAPH_NAMESPACE\LeanBridgeError('Native runtime is retired',5);
    }
    private function status(int $status): void {
        if (!in_array($status,[0,1,2,3,5,6],true)) throw new GraphInvalidNative('Invalid native callback output or status',4);
        if ($status!==0) throw new GRAPH_NAMESPACE\LeanBridgeError('Native callable failed with status '.$status,$status);
    }
    private static function callback(mixed $value): \Closure {
        if (!is_callable($value)) throw new \TypeError('Expected a synchronous callable');
        $callback=\Closure::fromCallable($value); $reflection=new \ReflectionFunction($callback);
        if ($reflection->isGenerator() || $reflection->returnsReference()) throw new \TypeError('Callbacks cannot yield or return references');
        foreach ($reflection->getParameters() as $parameter)
            if ($parameter->isPassedByReference()) throw new \TypeError('Callbacks cannot take references');
        return $callback;
    }
    private function borrow(int $signature, \Closure $callback, NativeCallableFrame $frame): \FFI\CData {
        $cb=$this->catalog['callbacks'][$signature]; $ffi=$this->load();
        if (!isset($this->stubs[$signature])) {
            $stub=$ffi->new($cb['ctype']);
            $stub->call=function($context,...$arguments) use ($signature,$cb): int {
                $state=null;
                try {
                    Lease::ensureCall(); $this->ready();
                    $schema=GraphRuntime::schema();
                    $id=$context===null ? 0 : $schema->address($schema->ffi->cast('lb_php_graph_byte_pointer',$context));
                    $state=$this->contexts[$id]??null;
                    if ($state===null || $state[0]!==$signature || !$state[2]->active || $state[2]->failure!==null) return 6;
                    [, $callback,$frame]=$state;
                    if (count($arguments)!==count($cb['parameters'])+1) throw new GraphInvalidNative('Wrong native callback arity');
                    $output=array_pop($arguments); $values=[];
                    foreach ($cb['parameters'] as $index=>$node) $values[]=CallableTransfers::decode($node['type'],$arguments[$index],$frame->scope);
                    $result=$callback(...$values); $this->ready();
                    $node=$schema->nodes[$cb['result']['type']];
                    $reply=CallableTransfers::encodeReply($cb['result']['type'],$result,$frame->scope);
                    $destination=$schema->pointer($schema->ffi->cast('lb_php_graph_byte_pointer',$output),1,$node['size'],$node['alignment']);
                    \FFI::memcpy($destination,$reply,$node['size']);
                    return 0;
                } catch (\Throwable $error) { if ($state!==null) $state[2]->failure??=$error; return 6; }
            };
            $this->stubs[$signature]=$stub;
        }
        if ($this->nextContext===PHP_INT_MAX) throw new \OverflowException('Callback context identities exhausted');
        $id=++$this->nextContext;
        $input=$ffi->new($cb['ctype']);
        $input->call=$this->stubs[$signature]->call;
        $input->context=$ffi->cast('void *',$id);
        $frame->ids[]=$id; $this->contexts[$id]=[$signature,$callback,$frame];
        return $input;
    }
    public function call(string $name,array $arguments): mixed {
        foreach ($this->catalog['functions'] as $fn) if ($fn['name']===$name) return $this->execute($fn,$arguments);
        throw new \TypeError('Unknown callable export');
    }
    private function execute(array $fn,array $arguments,?int $token=null): mixed {
        Lease::ensureCall();
        if (!array_is_list($arguments) || count($arguments)!==count($fn['parameters'])) throw new \ArgumentCountError('Wrong callable arity');
        $copiedTypes=[]; $copiedValues=[]; $callbacks=[];
        foreach ($fn['parameters'] as $index=>$node) {
            if (isset($node['callback'])) $callbacks[$index]=self::callback($arguments[$index]);
            else { $copiedTypes[]=$node['type']; $copiedValues[]=$arguments[$index]; }
        }
        if ($this->depth===64) throw new \OverflowException('Lean callable reentry limit exceeded');
        ++$this->depth;
        $scope=null; $frame=null; $output=null; $entered=false;
        $owned=isset($fn['result']['callback']); $resultType=$owned ? null : $fn['result']['type'];
        try {
            [$scope,$roots]=CallableTransfers::encode($copiedTypes,$copiedValues,$resultType);
            $frame=new NativeCallableFrame($scope);
            $result=$owned ? null : $scope->schema->nodes[$resultType];
            $output=$scope->allocate($owned ? 8 : $result['size']);
            if (!$owned && $result['kind']==='variant') $scope->schema->ffi->cast('uint32_t *',$output+16)[0]=4294967295;
            $ffi=$this->load(); $inputs=[]; $owners=[]; $next=0;
            foreach ($fn['parameters'] as $index=>$node) {
                if (isset($node['callback'])) {
                    $owner=$this->borrow($node['callback'],$callbacks[$index],$frame);
                    $owners[]=$owner; $inputs[]=\FFI::addr($owner);
                } else $inputs[]=$roots[$next++];
            }
            $this->status($ffi->{$this->catalog['prefix'].'_graph_initialize'}()); $entered=true;
            if ($token!==null) array_unshift($inputs,$token);
            $status=$ffi->{$fn['symbol']}(...[...$inputs,$output]);
            if ($frame->failure!==null) throw $frame->failure;
            $this->status($status); $this->ready();
            if ($owned) {
                $cb=$this->catalog['callbacks'][$fn['result']['callback']];
                $identity=$scope->schema->ffi->cast('uint64_t *',$output)[0];
                if ($identity===0) throw new GraphInvalidNative('Missing returned closure identity');
                $lease=new Lease(fn(int $token,array $args)=>$this->execute(['parameters'=>$cb['parameters'],'result'=>$cb['result'],'symbol'=>$cb['call']],$args,$token),
                    function(int $token) use ($ffi,$cb): void { $ffi->{$cb['dispose']}($token); },count($cb['parameters']));
                $lease->adopt($identity); $scope->schema->ffi->cast('uint64_t *',$output)[0]=0;
                return $lease;
            }
            $value=CallableTransfers::decode($resultType,$output,$scope); $this->ready();
            return $value;
        } catch (GraphInvalidNative $error) {
            if ($this->ffi!==null) $this->ffi->{$this->catalog['prefix'].'_graph_retire'}();
            throw new GRAPH_NAMESPACE\LeanBridgeError($error->getMessage(),4,$error);
        } finally {
            try {
                if ($entered && $output!==null) {
                    if ($owned) {
                        $identity=$scope->schema->ffi->cast('uint64_t *',$output)[0];
                        if ($identity!==0) { $this->ffi->{$this->catalog['callbacks'][$fn['result']['callback']]['dispose']}($identity); }
                    } elseif ($fn['result']['aggregate']) { $this->ffi->{$this->catalog['prefix'].'_php_graph_clear'}($output); }
                }
            } finally {
                if ($frame!==null) {
                    $frame->active=false;
                    foreach ($frame->ids as $id) unset($this->contexts[$id]);
                    $frame->ids=[];
                }
                if ($scope!==null) $scope->close();
                --$this->depth;
            }
        }
    }
}
`;
