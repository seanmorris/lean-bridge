package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class `PacketPair`(@kotlin.jvm.JvmField val `left`: kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>, @kotlin.jvm.JvmField val `right`: kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>) {
    fun `left`(): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>> = `left`
    fun `right`(): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>> = `right`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `PacketPair`
            && java.util.Objects.deepEquals(this.`left`, other.`left`)
            && java.util.Objects.deepEquals(this.`right`, other.`right`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`PacketPair`::class.java, this.`left`, this.`right`))
}
