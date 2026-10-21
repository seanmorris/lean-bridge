import org.leanbridge.dependentrecords.kotlin.*
fun dependentTotalNull() = Api.dependentTotal(Dependent(java.math.BigInteger.TWO, java.math.BigInteger.ONE))
fun dependentRoundtripNull() = Api.dependentRoundtrip(Dependent(java.math.BigInteger.TWO, java.math.BigInteger.ONE))
fun dependentResultNull() = Api.dependentResult(java.math.BigInteger.ZERO)
