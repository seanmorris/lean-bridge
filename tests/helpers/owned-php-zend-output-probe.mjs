/**
 * Corrupt successful native outputs before the production Zend reader sees them.
 *
 * @file
 */

/**
 * Mutations target the compiler-derived Mixed fields without replacing Lean
 * calls, generated conversions or cleanup. Each runs in its own interpreter.
 *
 * @param model - Model for the real mixed ownership fixture.
 */
export const ownedZendOutputProbe = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const mixed = nodes.get(model.functions.find(fn => fn.name === "echoMixed")?.result);
	if(!mixed) throw new TypeError("Missing mixed output fixture");
	const member = name => {
		const index = mixed.fields.findIndex(field => field.sourceName === name);
		if(index < 0) throw new TypeError("Missing mixed fixture field: " + name);
		return { index, node: nodes.get(mixed.fields[index].type) };
	};
	const fields = Object.fromEntries(["unit", "result", "chain", "ticket", "words", "scalar"].map(name => [name, member(name)]));
	const chain = fields.chain.node, next = chain.cases[1].fields.findIndex(field => field.sourceName === "next");
	if(next < 0) throw new TypeError("Missing recursive chain fixture field");
	const option = nodes.get(chain.cases[1].fields[next].type);
	return {
		declarations: `static unsigned probe_corruption;
static void probe_corrupt_output(void *);
static ZEND_FUNCTION(owned_generated_corrupt);
`
		, instrument: source => {
			const anchor = "static int lgo_from(lgo_walk *walk, unsigned type, const void *value, zval *out) {";
			if(source.split(anchor).length !== 2) throw new TypeError("Expected one generated output entrypoint");
			return source.replace(anchor, anchor + `
  if (probe_corruption && type == ${mixed.index} && !walk->borrow) probe_corrupt_output((void *)value);`);
		}
		, definitions: `
static unsigned char *probe_field(void *value, unsigned type, size_t branch, size_t index) {
  const lg_field *field = &lg_nodes[type].branches[branch].fields[index];
  unsigned char *at = (unsigned char *)value + field->offset;
  if (field->pointer) { unsigned char *child; memcpy(&child, at, sizeof(child)); at = child; }
  return at;
}
static void probe_corrupt_output(void *value) {
  unsigned mode = probe_corruption; probe_corruption = 0;
  unsigned char *at = NULL;
  if (mode == 1 || mode == 2) {
    unsigned type = mode == 1 ? ${fields.unit.node.index} : ${fields.result.node.index};
    at = probe_field(value, ${mixed.index}, 0, mode == 1 ? ${fields.unit.index} : ${fields.result.index});
    at[lg_nodes[type].tag_offset] = 2;
  } else if (mode == 3) {
    at = probe_field(value, ${mixed.index}, 0, ${fields.chain.index});
    uint32_t tag = UINT32_MAX; memcpy(at + lg_nodes[${chain.index}].tag_offset, &tag, sizeof(tag));
  } else if (mode == 4) {
    at = probe_field(value, ${mixed.index}, 0, ${fields.ticket.index});
    uint64_t token = 0; memcpy(at, &token, sizeof(token));
  } else if (mode >= 5 && mode <= 7) {
    at = probe_field(value, ${mixed.index}, 0, ${fields.words.index});
    const lg_node *node = &lg_nodes[${fields.words.node.index}];
    if (mode == 6) {
      size_t count = SIZE_MAX; memcpy(at + node->length_offset, &count, sizeof(count));
    } else {
      unsigned char *data = NULL;
      if (mode == 7) { memcpy(&data, at + node->data_offset, sizeof(data)); ++data; }
      memcpy(at + node->data_offset, &data, sizeof(data));
    }
  } else if (mode == 8) {
    unsigned char *chain = probe_field(value, ${mixed.index}, 0, ${fields.chain.index});
    at = probe_field(chain, ${chain.index}, 1, ${next});
    const lg_field *field = &lg_nodes[${option.index}].branches[1].fields[0];
    memcpy(at + field->offset, &chain, sizeof(chain));
  } else if (mode == 9) {
    at = probe_field(value, ${mixed.index}, 0, ${fields.scalar.index});
    uint32_t scalar = 0x110000; memcpy(at, &scalar, sizeof(scalar));
  }
}
static ZEND_FUNCTION(owned_generated_corrupt) {
  zend_long mode; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(mode) ZEND_PARSE_PARAMETERS_END();
  if (mode < 0 || mode > 9) { zend_value_error("Unknown output corruption mode"); RETURN_THROWS(); }
  probe_corruption = (unsigned)mode; RETURN_NULL();
}
`
	};
};
