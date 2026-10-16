import org.leanbridge.nominalprimitivesubtypes.kotlin.*
fun produce() = Api.produce(RawPacket(org.leanbridge.nominalprimitivesubtypes.Unit.INSTANCE, true, 42, 42, 42L, java.math.BigInteger.TWO, -42, -42, -42, -42L, java.math.BigInteger.TWO, java.math.BigInteger.TWO, 1.5f, 1.5, "a", byteArrayOf(1), 97, java.math.BigInteger.TWO, -42L, java.math.BigInteger.TWO))
fun echoA() = Api.echoA(Packet(org.leanbridge.nominalprimitivesubtypes.Unit.INSTANCE, true, 42, 42, 42L, java.math.BigInteger.TWO, -42, -42, -42, -42L, java.math.BigInteger.TWO, java.math.BigInteger.TWO, 1.5f, 1.5, "a", byteArrayOf(1), 97, java.math.BigInteger.TWO, -42L, java.math.BigInteger.TWO))
fun aliases() = Api.aliases(emptyArray<Option<Packet>>(), emptyArray<Option<Packet>>())
fun echoEventA() = Api.echoEventA(EventEmpty())
