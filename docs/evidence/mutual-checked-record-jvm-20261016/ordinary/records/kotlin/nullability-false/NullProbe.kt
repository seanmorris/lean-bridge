import org.leanbridge.mutualcheckedrecords.kotlin.*
fun root() = Api.first(Envelope(java.math.BigInteger.ONE, java.math.BigInteger.ONE, Option.none()))
fun aliases() = Api.groups(arrayOf(Option.none<Envelope>()))
fun active() = StepMore(Envelope(java.math.BigInteger.ONE, java.math.BigInteger.ONE, Option.none()))
