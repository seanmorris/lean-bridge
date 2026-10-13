package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `AliasPair`(@kotlin.jvm.JvmField val `left`: kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`>>, @kotlin.jvm.JvmField val `right`: kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`>>) {
    fun `left`(): kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`>> = `left`
    fun `right`(): kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Envelope`>> = `right`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `AliasPair`
            && java.util.Objects.deepEquals(this.`left`, other.`left`)
            && java.util.Objects.deepEquals(this.`right`, other.`right`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`AliasPair`::class.java, this.`left`, this.`right`))
}
