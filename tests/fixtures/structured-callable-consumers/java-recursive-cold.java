import org.leanbridge.structured.*;
import java.math.BigInteger;
public final class ColdJava {
 private static int checks;
 private static void check(boolean value) { if(!value)throw new AssertionError("cold Java "+checks); ++checks; }
 private static void reject(Class<? extends Throwable> type, Runnable call) {
  try { call.run(); } catch(Throwable error) { if(!type.isInstance(error))throw new AssertionError(error); ++checks; return; }
  throw new AssertionError("invalid input accepted");
 }
 public static void main(String[] args) {
  var value=new TreeLeaf(BigInteger.TEN);
  reject(NullPointerException.class,()->Api.callRecursive(null,item->item));
  reject(NullPointerException.class,()->Api.callRecursive(value,null));
  reject(IllegalArgumentException.class,()->Api.callRecursive(new TreeLeaf(BigInteger.ONE.negate()),item->item));
  Tree[] children=new Tree[1]; var cycle=new TreeBranch(children); children[0]=cycle;
  reject(IllegalArgumentException.class,()->Api.callRecursive(cycle,item->item));
  Tree deep=value; for(int i=0;i<70;++i)deep=new TreeBranch(new Tree[]{deep}); final Tree tooDeep=deep;
  reject(IllegalArgumentException.class,()->Api.makeRecursive(tooDeep));
  check(System.getProperties().keySet().stream().noneMatch(key->key.toString().startsWith("lean.bridge.jvm.native-library-v1.")));
  if(args[0].equals("tamper")) {
   try { Api.callRecursive(value,item->item); throw new AssertionError("tampered package loaded"); }
   catch(LeanBridgeException error) { check(error.status()==4); check(error.getCause() instanceof java.io.IOException); check(error.getCause().getMessage().contains("differs from compiled evidence")); }
   check("true".equals(System.getProperty("lean.bridge.jvm.native-library-v1.failed"))&&System.getProperty("lean.bridge.jvm.native-library-v1.runtime")==null);
  } else {
   var result=Api.callRecursive(value,item->item); check(result.equals(value)); check(result!=value);
   var owned=Api.makeRecursive(value); try(owned){check(owned.invoke(true,new TreeLeaf(BigInteger.ZERO)).equals(value));}
   owned.close(); check(owned.isClosed()); reject(IllegalStateException.class,()->owned.invoke(true,value));
  }
  System.out.println(args[0]+" "+checks);
 }
}
