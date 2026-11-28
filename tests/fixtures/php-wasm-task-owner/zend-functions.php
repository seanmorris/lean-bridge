<?php
// Runs in the relocated application's real Zend interpreter after zend-installed.php.
$source=withHosts($table);$sibling=withHosts($table);$peer=withPeer($table);
$held=new AppBox(BigInteger::of(41));$arg=new ChildBox(BigInteger::one());
$weak=WeakReference::create($held);$f=$source->remember($held);
check($f instanceof LeanWorkshop\RememberFunction && $f($arg)===$held,'typed invokable returns original PHP object');
$read=$peer->reader($held);$identity=$sibling->identity_reader($held);unset($held);
check($read(BigInteger::one())->isEqualTo(42) && $identity(BigInteger::zero())===$weak->get(),'independent scalar and nominal functions');
problem(TypeError::class,fn()=>$f(new stdClass()));problem(ArgumentCountError::class,fn()=>$f($arg,$arg));
$original=new UnexpectedValueException('returned member failed');$throws=new HookBox(fn()=>throw $original);
check(problem(UnexpectedValueException::class,fn()=>$source->remember($throws))===$original,'factory exception identity');
check(problem(UnexpectedValueException::class,fn()=>$f($throws))===$original,'inner exception identity');
$relay=$peer->relay($arg,$f,fn($v)=>$v);check($relay->await()===$weak->get(),'real function in retained callback');$relay->awaitCleanup();
$raised=$peer->relay($throws,$f,fn($v)=>$v);check(problem(UnexpectedValueException::class,fn()=>$raised->await())===$original,'settled PHP exception identity');$raised->awaitCleanup();
$hook=new HookBox(function() use ($f,$read,$arg) {
    $f->close();problem(LogicException::class,fn()=>$f($arg));
    check($read(BigInteger::one())->isEqualTo(42),'sibling reentrant while closing');return BigInteger::zero();
});
check($f($hook)===$weak->get(),'self-close allows in-flight reply');$f->close();
$revoked=$source->remember($arg);$victim=$source->relay($arg,$revoked,fn($v)=>$v);
$other=$sibling->remember($arg);$survivor=$sibling->relay($arg,$other,fn($v)=>$v);
$source->close();problem(LogicException::class,fn()=>$revoked($arg));
problem(LeanWorkshop\TaskCancelled::class,fn()=>$victim->await());$victim->awaitCleanup();
check($survivor->await()===$arg,'unrelated binding still settles');$survivor->awaitCleanup();
$read->close();$identity->close();unset($relay);gc_collect_cycles();
check($weak->get()===null,'last function released original application capture');
$last=withHosts($table);$tmp=new AppBox(BigInteger::zero());$lost=WeakReference::create($tmp);
$orphan=$last->remember($tmp);unset($tmp,$last);gc_collect_cycles();
check($lost->get()===null,'escaped callable does not own binding');problem(LogicException::class,fn()=>$orphan($arg));
$orphan->close();$other->close();$peer->close();$sibling->close();
