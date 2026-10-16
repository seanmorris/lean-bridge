package `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`

class `ChoicePacket`(@kotlin.jvm.JvmField val `value`: `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`) : `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Choice` {
    fun `value`(): `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet` = `value`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `ChoicePacket`
            && java.util.Objects.deepEquals(this.`value`, other.`value`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`ChoicePacket`::class.java, this.`value`))
}
