import org.leanbridge.inheritedcheckedrecords.kotlin.*
fun produceNull() = Api.produce(java.math.BigInteger.ONE)
fun produceStampedNull() = Api.produceStamped(java.math.BigInteger.ONE)
fun aliasedNull() = Api.aliased(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE))
fun echoNull() = Api.echo(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE))
fun firstNull() = Api.first(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE))
fun nestedNull() = Api.nested(Stamped(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE), java.math.BigInteger.ZERO))
fun normalizedNull() = Api.normalized(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE))
fun pairNull() = Api.pair(Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE), Ticket(Span(java.math.BigInteger.ONE, java.math.BigInteger.ONE), java.math.BigInteger.ONE))
