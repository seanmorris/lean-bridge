package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class `EventBox`(@kotlin.jvm.JvmField val `value`: `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`) : `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
    fun `value`(): `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet` = `value`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EventBox`
            && java.util.Objects.deepEquals(this.`value`, other.`value`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EventBox`::class.java, this.`value`))
}
