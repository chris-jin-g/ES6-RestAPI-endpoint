// -*- mode: JavaScript; -*-

import ModelError from './model-error.mjs';

export default class Validator {

  /** Construct a validator for actionMetas (meta.mjs).
   */
  constructor(actionMetas) {
    const xMeta = {};
    for (const [act, actInfo] of Object.entries(actionMetas)) {
      const required = actInfo.fields.filter(f => f.required).map(f => f.name);
      const fields = Object.fromEntries(actInfo.fields.map(f => [f.name, f]));
      xMeta[act] = Object.assign({}, actInfo, { fields, required });
    }
    this.meta = xMeta;
  }

  /** Validate nameValues object for action act.  If errors are detected,
   *  throw an array of ModelError objects.  If no errors are detected,
   *  return a cleaned-up version of nameValues with all values run
   *  through the meta val() function (if any).
   */
  validate(act, nameValues) {
    const trimmedNameValues =
      Object.entries(nameValues).map(([k, v]) => {
  	return (v === undefined || v === null)
	  ? [k, '']
	  : typeof v === 'object'
	  ? [ k, v ]
	  : [k, String(v).trim()];
      });
    const obj = Object.fromEntries(trimmedNameValues);
    const out = {};
    const meta = this.meta[act];
    if (!meta) {
      throw [ new ModelError(`BAD_ACT', 'bad action ${act}`) ];
    } 
    const errors = [];
    const required = new Set(meta.required);
    const msgSuffix = `for action ${act}`;
    for (const [name, value] of Object.entries(obj)) {
      required.delete(name);
      const info = meta.fields[name];
      if (name.startsWith('_')) {
	out[name] = (value.match(/^\d+$/)) ? Number(value) : value;
      }
      else if (info === undefined) {
	if (!meta.allowUnknownFields) {
	  const msg = `unknown field ${name} ${msgSuffix}`;
	  errors.push(new ModelError('BAD_FIELD', msg, name));
	}
      }
      else {
	const err = (value !== '' && info.errFn) && info.errFn(value, info);
	if (err) {
	  const msg = `bad value: "${value}": ${err.replace(/\s+/g, ' ')}`;
	  errors.push(new ModelError('BAD_FIELD_VALUE', msg, name));
	}
	else {
	  out[name] = info.val ? info.val(value) : value;
	}
      }
    } //for
    if (required.size > 0) {
      const names = Array.from(required).
	    map(n => `"${meta.fields[n].label}"`).
	    join(', ');
      errors.push(new ModelError('MISSING_FIELD',
				`missing fields ${names}.`));
    }
    if (errors.length === 0) {
      if (meta.errFn) {
	const msg = meta.errFn(obj, meta);
	if (msg) errors.push(new ModelError('FORM_ERROR', msg));
      }
    }
    if (errors.length > 0) throw errors;
    return out;
  }
  
};
