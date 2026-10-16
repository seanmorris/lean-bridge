import org.leanbridge.nominalprimitivesubtypes.kotlin.*
fun echoA(value: Packet) = Api.echoA(value)
fun echoB(value: Packet) = Api.echoB(value)
fun refuseUnit(value: Packet) = Api.refuseUnit(value)
fun combine(left: Packet, right: Packet) = Api.combine(left, right)
fun echoPair(value: PacketPair) = Api.echoPair(value)
fun echoEventA(value: Event) = Api.echoEventA(value)
fun echoEventB(value: Event) = Api.echoEventB(value)
fun aliases(left: Array<Option<Packet>>, right: Array<Option<Packet>>) = Api.aliases(left, right)
