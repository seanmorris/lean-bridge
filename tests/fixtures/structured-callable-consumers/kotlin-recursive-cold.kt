import org.leanbridge.structured.kotlin.*
import org.leanbridge.structured.LeanBridgeException
import java.math.BigInteger
private var checks=0
private fun check(value: Boolean) { if(!value)throw AssertionError("cold Kotlin $checks"); ++checks }
private fun reject(type: Class<out Throwable>, call: () -> Unit) {
 try { call() } catch(error: Throwable) { if(!type.isInstance(error))throw AssertionError(error); ++checks; return }
 throw AssertionError("invalid input accepted")
}
fun main(args: Array<String>) {
 val value=TreeLeaf(BigInteger.TEN)
 reject(NullPointerException::class.java) { org.leanbridge.structured.Api.callRecursive(null) { it } }
 reject(NullPointerException::class.java) { org.leanbridge.structured.Api.callRecursive(org.leanbridge.structured.TreeLeaf(BigInteger.ZERO),null) }
 reject(IllegalArgumentException::class.java) { Api.callRecursive(TreeLeaf(BigInteger.ONE.negate())) { it } }
 val children=arrayOf<Tree>(value); val cycle=TreeBranch(children); children[0]=cycle
 reject(IllegalArgumentException::class.java) { Api.callRecursive(cycle) { it } }
 var deep: Tree=value; repeat(70) { deep=TreeBranch(arrayOf(deep)) }
 reject(IllegalArgumentException::class.java) { Api.makeRecursive(deep) }
 check(System.getProperties().keys.none { it.toString().startsWith("lean.bridge.jvm.native-library-v1.") })
 if(args[0]=="tamper") {
  try { Api.callRecursive(value) { it }; throw AssertionError("tampered package loaded") }
  catch(error: LeanBridgeException) { check(error.status()==4); check(error.cause is java.io.IOException); check(error.cause!!.message!!.contains("differs from compiled evidence")) }
  check(System.getProperty("lean.bridge.jvm.native-library-v1.failed")=="true"&&System.getProperty("lean.bridge.jvm.native-library-v1.runtime")==null)
 } else {
  val result=Api.callRecursive(value) { it }; check(result==value); check(result!==value)
  val owned=Api.makeRecursive(value); owned.use { check(it.invoke(true,TreeLeaf(BigInteger.ZERO))==value) }
  owned.close(); check(owned.isClosed()); reject(IllegalStateException::class.java) { owned.invoke(true,value) }
 }
 println(args[0]+" "+checks)
}
