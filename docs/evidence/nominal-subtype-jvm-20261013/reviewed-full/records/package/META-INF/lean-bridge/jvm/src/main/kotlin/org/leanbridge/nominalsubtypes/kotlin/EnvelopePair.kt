package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `EnvelopePair`(@kotlin.jvm.JvmField val `left`: `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`, @kotlin.jvm.JvmField val `right`: `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`) {
    fun `left`(): `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope` = `left`
    fun `right`(): `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope` = `right`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EnvelopePair`
            && java.util.Objects.deepEquals(this.`left`, other.`left`)
            && java.util.Objects.deepEquals(this.`right`, other.`right`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EnvelopePair`::class.java, this.`left`, this.`right`))
}
