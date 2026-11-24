<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use LeanBridge\Internal\PhpWasmObjectsV1\Scope;

/** @internal Bind the checked selectors to real PHP classes, not a JavaScript proxy. */
final class ZendMembers {
    private readonly HostMembers $table;
    private readonly array $kinds;
    public function __construct(array $model,array $classes) {
        $this->table=new HostMembers($model,$classes);
        $this->kinds=array_map(static fn($kind)=>'host:'.$kind['key'],$model['kinds']);
    }
    public function open(Scope $scope): ZendMemberCall {return new ZendMemberCall($this->table,$this->kinds,$scope);}
}

/** @internal No PHP Throwable may unwind through the WebAssembly or JS stack. */
final class ZendMemberCall {
    private array $errors=[];
    private ?\Throwable $boundary=null;
    private int $boundaryTicket=0;
    public function __construct(private ?HostMembers $members,private readonly array $kinds,private ?Scope $scope) {}
    private function failed(\Throwable $error,bool $boundary): string {
        if (count($this->errors)>=4096) {
            $this->boundary??=new \OverflowException('Too many PHP member exceptions in one call');
            $this->boundaryTicket=1;
            return 'b1';
        }
        $this->errors[]=$error;$ticket=count($this->errors);
        if ($boundary) {$this->boundary=$error;$this->boundaryTicket=$ticket;}
        return ($boundary?'b':'e').$ticket;
    }
    public function invoke(mixed $slot,mixed ...$args): mixed {
        if ($this->scope===null) return 'closed';
        if ($this->boundary!==null) return 'b'.$this->boundaryTicket;
        try {
            if (!is_int($slot)) throw new \TypeError('Invalid PHP member slot');
            $spec=$this->members->memberAt($slot);
            if (count($args)!==count($spec['args'])) throw new \UnexpectedValueException('Invalid PHP member arity');
            $values=[];
            foreach ($spec['args'] as $i=>$site) {
                $wire=$args[$i];if (!is_string($wire)) throw new \TypeError('Invalid PHP member input');
                if (is_int($site)) $values[]=$this->scope->resolve($this->kinds[$site],$wire);
                else {
                    $bytes=base64_decode($wire,true);
                    if ($bytes===false) throw new \UnexpectedValueException('Invalid PHP member bytes');
                    $values[]=WireValues::output($site,'',$bytes);
                }
            }
            [$ok,$value]=$this->members->invoke($slot,$values);
            if (!$ok) return $this->failed($value,false);
            $result=$spec['result'];
            return is_int($result)?$this->scope->pin($this->kinds[$result],$value):'v'.base64_encode(WireValues::input($result,$value,new Budget()));
        } catch (\Throwable $e) {return $this->failed($e,true);}
    }
    public function check(mixed $reply): void {
        if ($this->boundary!==null) throw $this->boundary;
        if (is_string($reply) && str_starts_with($reply,'["member",')) {
            $error=json_decode($reply,true,flags: JSON_THROW_ON_ERROR);
            if (count($error)!==2 || !is_int($error[1]) || !isset($this->errors[$error[1]-1]))
                throw new \UnexpectedValueException('Unknown PHP member failure');
            throw $this->errors[$error[1]-1];
        }
    }
    public function close(): void {$this->scope=null;$this->members=null;$this->boundary=null;$this->errors=[];}
}
