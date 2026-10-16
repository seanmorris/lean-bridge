package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class Api private constructor() {
    companion object {
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `aliases`(arg0: kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>, arg1: kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call0(arg0, arg1) as kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `combine`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`, arg1: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Pair`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`, `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call1(arg0, arg1) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Pair`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`, `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `echoA`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call2(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `echoB`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call3(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `echoEventA`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call4(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `echoEventB`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call5(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `echoPair`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call6(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produce`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call7(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceChoices`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call8(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceEvent`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call9(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceGroup`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>> {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call10(arg0) as kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `producePair`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`RawPacket`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call11(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`PacketPair`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `refuseUnit`(arg0: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet` {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call12(arg0) as `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `wordBits`(): kotlin.Long {
            return `org`.`leanbridge`.`nominalprimitivesubtypes`.KotlinCalls.call13() as kotlin.Long
        }
    }
}
