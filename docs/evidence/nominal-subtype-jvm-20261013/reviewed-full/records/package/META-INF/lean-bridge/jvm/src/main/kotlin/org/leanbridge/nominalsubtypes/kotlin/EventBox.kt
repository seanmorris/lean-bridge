package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `EventBox`(@kotlin.jvm.JvmField val `value`: `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`) : `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Event` {
    fun `value`(): `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope` = `value`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EventBox`
            && java.util.Objects.deepEquals(this.`value`, other.`value`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EventBox`::class.java, this.`value`))
}
