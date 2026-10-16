package `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`

class Api private constructor() {
    companion object {
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceArray`(arg0: java.math.BigInteger): kotlin.Array<`org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`> {
            return `org`.`leanbridge`.`nestedcheckedrecords`.KotlinCalls.call0(arg0) as kotlin.Array<`org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`>
        }
        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun `produceOption`(arg0: java.math.BigInteger): `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Option`<`org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`> {
            return `org`.`leanbridge`.`nestedcheckedrecords`.KotlinCalls.call1(arg0) as `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Option`<`org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`>
        }
    }
}
