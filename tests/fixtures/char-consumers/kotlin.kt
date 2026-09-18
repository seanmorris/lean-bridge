import org.leanbridge.glyphs.Api
import org.leanbridge.glyphs.Label
private var checks = 0
private fun checkChar(value: Boolean) { check(value); ++checks }
fun main() {
    val values = intArrayOf(__POINTS__)
    for (value in values) {
        checkChar(Api.keep(value) == value)
        checkChar(Api.point(value) == value.toLong())
        checkChar(Api.text(value) == String(Character.toChars(value)))
        checkChar(Api.choose(true, value, 120) == value)
        checkChar(Api.choose(false, 120, value) == value)
        checkChar(Api.keepArray(values).contentEquals(values))
        val label = Api.keepLabel(Label(value, values))
        checkChar(label.marker() == value && label.line().contentEquals(values))
        val rows = arrayOf(values, intArrayOf(), intArrayOf(value))
        checkChar(Api.keepRows(rows).contentDeepEquals(rows))
    }
    checkChar(Api.sprout() == 0x1f331)
    checkChar(Api.keepArray(intArrayOf()).isEmpty())
    for (bad in intArrayOf(-1, 0xd800, 0xdfff, 0x110000, Int.MAX_VALUE)) {
        for (call in listOf<() -> Unit>({ Api.keep(bad) }, { Api.keepArray(intArrayOf(65, bad)) },
            { Api.keepRows(arrayOf(intArrayOf(65), intArrayOf(bad))) },
            { Api.keepLabel(Label(bad, values)) }, { Api.keepLabel(Label(65, intArrayOf(bad))) })) {
            var rejected = false
            try { call() } catch (error: IllegalArgumentException) { rejected = true }
            checkChar(rejected); checkChar(Api.keep(0x1f331) == 0x1f331)
        }
    }
    repeat(1000) { checkChar(Api.keepRows(arrayOf(values, values))[1].contentEquals(values)) }
    println("char-ok:$checks")
}
