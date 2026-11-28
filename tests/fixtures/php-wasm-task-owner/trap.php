<?php
declare(strict_types=1);
use Brick\Math\BigInteger as B;
use LeanRelay as R;
function expect(string $class,Closure $call): Throwable {
    try { $call(); } catch (Throwable $e) { if ($e instanceof $class) return $e; throw $e; }
    throw new LogicException('Expected '.$class);
}
$message="original\0🌿";
$seen=R\caught_message('input',fn($s)=>throw new DomainException($message))->await();
if ($seen!==$message) throw new LogicException('Lean lost the PHP exception message');
if (R\caught_message('input',fn($s)=>throw new DomainException("\xff"))->await()!=='PHP callback failed')
    throw new LogicException('Invalid UTF-8 error text crossed the wire');
$n=B::of(5);
$invalid=R\recover($n,fn($v)=>'invalid');
expect(TypeError::class,fn()=>$invalid->await()); $invalid->awaitCleanup();
if (!R\add($n)->isEqualTo(6)) throw new LogicException('Bad callback reply poisoned runtime');
$fail=new DomainException('before task');
$factory=R\factory($n,fn($v)=>throw $fail);
if (expect(DomainException::class,fn()=>$factory->await())!==$fail) throw new LogicException('Lost factory callback error');
$peer=\LeanJobs\hold(); $fatal=new Error('PHP engine trap');
$origin=R\recover($n,fn($v)=>throw $fatal);
if (expect(Error::class,fn()=>$origin->await())!==$fatal) throw new LogicException('Lean masked or replaced the engine trap');
expect(\LeanJobs\LeanBridgeError::class,fn()=>$peer->await());
expect(R\LeanBridgeError::class,fn()=>$origin->awaitCleanup());
expect(\LeanJobs\LeanBridgeError::class,fn()=>$peer->awaitCleanup());
expect(\LeanJobs\LeanBridgeError::class,fn()=>\LeanJobs\closes());
echo 'callback trap preserved; peer refused; new work refused';
