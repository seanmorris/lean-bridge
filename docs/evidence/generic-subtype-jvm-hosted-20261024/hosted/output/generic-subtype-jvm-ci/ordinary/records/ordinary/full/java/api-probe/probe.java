import org.leanbridge.nominalsubtypes.*;
final class Probe {
    static Object first() { return Api.first(null); }
    static Object second() { return Api.second(null); }
    static Object combine() { return Api.combine(null, null); }
    static Object nested() { return Api.nested(null); }
    static Object echo() { return Api.echo(null); }
    static Object aliases() { return Api.aliases(null, null); }
    static Object echoGroups() { return Api.echoGroups(null); }
    static Object echoPair() { return Api.echoPair(null); }
    static Object inspectAliasPair() { return Api.inspectAliasPair(null); }
    static Object eventFirst() { return Api.eventFirst(null); }
    static Object eventSecond() { return Api.eventSecond(null); }
    static Object echoEvent() { return Api.echoEvent(null); }
    static Object plainFin() { return Api.plainFin(null); }
    static EnvelopePair inputValue;
}
