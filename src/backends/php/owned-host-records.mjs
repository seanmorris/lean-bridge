/** @file Borrow callable record fields on the native PHP FFI boundary. */
import {phpClassName, reservedPhpNames} from "./copied-names.mjs";

/**
 * Keep the public record/return type unchanged. Only borrowed export
 * parameters identified by the compiler receive an alternate input class.
 *
 * @param model - Checked PHP projection backed by the owned C interface.
 */
export const phpHostRecords = model => {
	const nodes = new Map(model.types.map(n => [n.id,n])), views = new Map();
	const occupied = new Set(reservedPhpNames);
	for(const record of model.records) occupied.add(record.name.toLowerCase());
	for(const node of model.types)
	{
		occupied.add(node.publicType.toLowerCase());
		if(node.ownerType) occupied.add(node.ownerType.toLowerCase());
	}
	for(const alias of model.aliases) occupied.add(phpClassName(alias.name).toLowerCase());
	const methods = new Set(model.functions.map(f => f.publicName.toLowerCase()));
	const functions = model.c.hostFieldCalls.map(call => {
		for(const slot of call.hostRecordSlots)
		{
			if(views.has(slot.node.id)) continue;
			const node = nodes.get(slot.node.id), selected = new Set(slot.fields.map(f => f.name));
			let name = node.publicType+"Input";
			while(occupied.has(name.toLowerCase())) name += "Input";
			occupied.add(name.toLowerCase());
			views.set(node.id,{name, record: node.publicType, ctype: slot.inputType
				, fields: node.fields.map(f => ({...f, host: selected.has(f.name)}))});
		}
		const original = model.functions.find(f => f.id===call.id);
		let publicName = phpClassName(call.cName.slice(model.c.prefix.length+1));
		while(methods.has(publicName.toLowerCase())) publicName += "_input";
		methods.add(publicName.toLowerCase());
		return {...original,...call,publicName};
	});
	const classes = [...views.values()].map(view => `/** Input only: application functions are borrowed for one call. */
final readonly class ${view.name}
{
${view.fields.map(f => "    public "+(f.host?"mixed":f.publicType)+" $"+f.publicName+";").join("\n")}
    /**
${view.fields.map(f => `     * @param ${f.host ? "callable|"+f.docType+"|WithRecovery" : f.docType} $${f.publicName}`).join("\n")}
     */
    public function __construct(${view.fields.map(f => "mixed $"+f.publicName).join(", ")}) {
        if (\\func_num_args() !== ${view.fields.length}) throw new \\ArgumentCountError('${view.name} requires exactly ${view.fields.length} fields');
${view.fields.map(f => (f.host ? "" : `        Internal\\Values::check(${f.index}, $${f.publicName});\n`)+`        $this->${f.publicName} = $${f.publicName};`).join("\n")}
    }
}
`).join("\n");
	const qualified = name => model.namespace+"\\"+name;
	const fieldSite = f => ({key: f.publicName, member: f.name, type: f.index
		, host: f.host, pointer: Boolean(f.pointer)});
	const runtimeView = view => ({ctype: view.ctype, input: qualified(view.name)
		, lease: qualified(view.record), fields: view.fields.map(fieldSite)});
	return {views,functions,classes,runtimeView};
};

// Keep a single validation budget across *all* arguments and recovery values.
export const phpRecordSites = String.raw`    private static function sites(array $fn, array $args, array &$records): \Generator {
        foreach ($fn['parameters'] as $index => $parameter) {
            $value = $args[$index];
            if (!isset($parameter['record'])) { yield [$index, $parameter, $value, 0]; continue; }
            $view = $parameter['record'];
            if (!\is_object($value) || ($value::class !== $view['input'] && $value::class !== $view['lease']))
                throw new \TypeError('Expected '.$view['input'].' or '.$view['lease']);
            $records[] = [0, count($view['fields'])];
            foreach ($view['fields'] as $i => $f) yield ["$index/$i", $f, $value->{$f['key']}, 1];
        }
    }
    private function inputRecord(array $view, object $value, int $index, array $prepared, OwnedCallFrame $frame): \FFI\CData {
        $scope = $frame->scope; $ffi = $scope->schema->ffi;
        $type = $ffi->type($view['ctype']); $raw = $scope->allocate($type->getSize());
        foreach ($view['fields'] as $i => $f) {
            $at = $raw + $type->getStructFieldOffset($f['member']); $child = $f['type'];
            if ($f['host']) {
                $descriptor = $this->host($child, $prepared["$index/$i"], $frame);
                $cb = OwnedCallTypes::CALLBACKS[$child];
                $ffi->{$cb['copyDescriptor']}($descriptor, $ffi->cast($cb['hostPointer'], $at));
            } else {
                $encoded = OwnedConversions::write($child, $value->{$f['key']}, $scope);
                if ($f['pointer']) $scope->schema->writePointer($at, $encoded);
                else \FFI::memcpy($at, $encoded, $scope->schema->nodes[$child]['size']);
            }
        }
        return $ffi->cast($view['ctype'].' *', $raw);
    }
`;
