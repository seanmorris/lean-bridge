/** @file Marshal only the selected input fields as synchronous PHP callbacks. */

/**
 * Each native field goes through the same walker or broker as its standalone
 * argument. The entire call owns its pins, wrappers and scratch allocations.
 *
 * @param model - Checked 32-bit Zend schema with explicit borrowed input sites.
 */
export const ownedZendRecordCalls = model => {
	if(!model.recordInputs) return "";
	const views = new Map(model.recordInputs.functions.flatMap(fn=>Object.values(fn.records).map(v=>[v.type,v])));
	const callbacks = new Map(model.callbacks.map(cb=>[cb.type,cb.index]));
	return [...views.values()].map(v=>{
		const node = model.types[v.type];
		const fields = v.fields.map((field,i)=>{
			const native = node.fields[i], child = model.types[field.type];
			if(child.id !== native.type) throw new TypeError("Zend input field layout mismatch");
			const dest = native.pointer ? `p${i}` : `&out->${native.name}`;
			const invoke = field.host ? `lgo_host${callbacks.get(field.type)}_begin(call, value, ${dest})`
				: `lg_to_at(walk, ${field.type}, value, ${dest}, 1)`;
			return `  value = zend_hash_index_find(Z_ARRVAL_P(input), ${i}); ZVAL_DEREF(value);${native.pointer ? `
  ${child.cName} *${dest} = lb_allocate(scope, 1, sizeof(*${dest}));
  if (!${dest}) return lgo_walk_failure(&call->walk, 0);
  out->${native.name} = ${dest};` : ""}${field.host ? `
  if (Z_TYPE_P(value) != IS_RESOURCE && !lg_step(walk, 1)) return lgo_walk_failure(&call->walk, 0);` : ""}
  if (!${invoke}) return lgo_walk_failure(&call->walk, 0);`;
		});
		return `static int lgo_row${v.type}(lgo_call *call, zval *input, ${node.cName} *out) {
  lg_walk *walk = &call->walk.graph; lb_scope *scope = &walk->scope; zval *value;
  ZVAL_DEREF(input);
  if (!lg_list(input, ${fields.length}, true, scope) || !lg_step(walk, 0)
      || !lb_charge(scope, 1, 16) || !lg_children(walk, ${fields.length})) return lgo_walk_failure(&call->walk, 0);
${fields.join("\n")}
  return 1;
}
`;
	}).join("");
};

/**
 * Validate the complete call before entering native code. Host callables and
 * actual leases follow their existing paths, in the same per-call frame.
 *
 * @param source - Selected whole-owner or ordinary Zend PHP runtime.
 */
export const ownedZendRecordPhp = source => {
	const replace = (before,after) => {
		if(source.split(before).length !== 2) throw new TypeError("Zend input-record runtime anchor changed: "+before);
		source=source.replace(before,()=>after);
	};
	replace("public bool $active = true;","public int $inputDepth = 0;\n    public bool $active = true;");
	replace("static function($type, $value, $budget): void","static function($type, $value, $budget, $depth): void");
	replace("Values::walk($value, $type, $budget)","Values::walk($value, $type, $budget, $depth)");
	replace("($type, $value, $this->validation);","($type, $value, $this->validation, $this->inputDepth);");
	const check="if ($fn['host'][$index]) $prepared[$index] = self::prepare($type, $arguments[$index], $frame);";
	replace(check,`if (isset($fn['records'][$index])) $prepared[$index] = self::prepareRecord($fn['records'][$index], $arguments[$index], $frame);
            else ${check}`);
	const write="$fn['host'][$index] ? self::host($type, $prepared[$index], $frame)";
	replace(write,`isset($fn['records'][$index]) ? self::writeRecord($fn['records'][$index], $prepared[$index], $frame)
                    : (${write}`);
	const end="GraphWire::transfer($type, $arguments[$index], false, $frame->writing);";
	replace(end,end.slice(0,-1)+");");
	const execute="    private static function execute(";
	replace(execute,String.raw`    private static function prepareRecord(array $view, mixed $value, ZendFrame $frame): array {
        if (!\is_object($value) || ($value::class !== $view['input'] && $value::class !== $view['lease']))
            throw new \TypeError('Expected '.$view['input'].' or '.$view['lease']);
        $frame->validation->step(0); $frame->validation->children(count($view['fields']));
        $prepared = []; $frame->inputDepth = 1;
        try {
            foreach ($view['fields'] as $field) {
                $item = $value->{$field['key']}; $type = $field['type'];
                if ($field['host']) {
                    $frame->validation->step(1);
                    $prepared[] = self::prepare($type, $item, $frame);
                } else {
                    $frame->check($type, $item); $prepared[] = $item;
                }
            }
        } finally { $frame->inputDepth = 0; }
        return $prepared;
    }
    private static function writeRecord(array $view, array $prepared, ZendFrame $frame): array {
        $frame->writing->step(0); $frame->writing->children(count($prepared));
        $wire = [];
        foreach ($view['fields'] as $index => $field) {
            if ($field['host']) {
                $frame->writing->step(1);
                $wire[] = self::host($field['type'], $prepared[$index], $frame);
            } else $wire[] = GraphWire::transfer($field['type'], $prepared[$index], false, $frame->writing, 1);
        }
        return $wire;
    }
`+execute);
	return source;
};
