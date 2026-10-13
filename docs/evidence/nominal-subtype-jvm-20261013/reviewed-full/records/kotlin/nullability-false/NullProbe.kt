import org.leanbridge.nominalsubtypes.kotlin.*
fun scalar() = Api.scalar(java.math.BigInteger.ONE)
fun first() = Api.first(Envelope(java.math.BigInteger.ONE, java.math.BigInteger.TWO))
fun echoGroups() = Api.echoGroups(emptyArray<Option<Envelope>>())
fun eventFirst() = Api.eventFirst(EventEmpty())
