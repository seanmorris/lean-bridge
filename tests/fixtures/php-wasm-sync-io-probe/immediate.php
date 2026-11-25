<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use function LeanLedger\{sequence,checked,units,replies,counts};
use LeanLedger\{Ok,Err,CheckedError,CheckedStepError,IOError};
require_once '/vendor/lean-bridge/ledger/bootstrap.php';
function expect(bool $v): void { if (!$v) throw new RuntimeException('PHP cursor assertion at line '.debug_backtrace()[0]['line']); }
$n = fn(int $i) => BigInteger::of($i);
expect((string)counts()==='0');
$it=sequence($n(2));
expect(!is_resource($it) && $it instanceof IteratorAggregate && (string)counts()==='0');
expect(array_map('strval',iterator_to_array($it))===['0','1']);
expect(iterator_to_array($it)===[]);
foreach (sequence($n(4)) as $v) { expect((string)$v==='0'); break; }
try { checked($n(0)); throw new Exception('no open failure'); }
catch (CheckedError $e) { expect($e->declaration==='Pulls.checked' && $e->payload==='open'); }
try { foreach (checked($n(1)) as $v) expect((string)$v==='0'); throw new Exception('no step failure'); }
catch (CheckedStepError $e) { expect($e->declaration==='Pulls.nextChecked' && $e->payload==='pull λ'); }
$seen=0;
try { foreach (units($n(1)) as $v) { expect($v===null); ++$seen; } throw new Exception('no IO failure'); }
catch (IOError $e) { expect($seen===1 && $e->declaration==='Pulls.nextUnit' && $e->payload==='unit step'); }
$values=iterator_to_array(replies($n(2)));
expect(count($values)===2 && $values[0] instanceof Err && $values[0]->value==='value λ'
    && $values[1] instanceof Ok && (string)$values[1]->value==='1');
$cause=new Exception('caller');
try { foreach (sequence($n(3)) as $v) throw $cause; }
catch (Throwable $e) { expect($e===$cause); }
$unused=sequence($n(0)); $unused->close(); $unused->close();
expect((string)counts()==='1207');
// Leave this live. A second PHP request in the same host reads Lean's counter.
$GLOBALS['atShutdown']=sequence($n(1));
// Test only: hold a private Zend resource without a public PHP Cursor.
// A wrong declaration must not be able to pull it, and request teardown
// must release it even though there is no public object's destructor.
$GLOBALS['rawAtShutdown']=__LB_SEQUENCE_OPEN__(pack('V2',1,0));
expect(is_resource($GLOBALS['rawAtShutdown']));
try { __LB_UNIT_NEXT__($GLOBALS['rawAtShutdown']); throw new Exception('foreign cursor type accepted'); }
catch (TypeError $e) {}
expect((string)counts()==='1207');
echo 'pulls:12;closes:7';
