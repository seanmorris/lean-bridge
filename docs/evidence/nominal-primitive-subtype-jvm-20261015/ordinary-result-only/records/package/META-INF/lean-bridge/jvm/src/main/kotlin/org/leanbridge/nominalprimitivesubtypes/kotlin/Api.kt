package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class Api private constructor() {
    companion object {
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produce`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call0(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceChoices`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call1(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceEvent`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call2(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceGroup`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call3(arg0) as kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `producePair`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call4(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `wordBits`(): kotlin.Long {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call5() as kotlin.Long
        }
    }
}
