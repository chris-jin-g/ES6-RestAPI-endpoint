// -*- mode: JavaScript; -*-

/**

Track meta-information for each action.  

Each action must have a fields property which must be a list
specifying the following meta-properties for each field:

  name:         Internal name of field.  Required.
  label:        External name of field.  Required. 
  required:     Truthy means field is required.
  errFn:        Validation function: called with field value and
                field meta-properties.  Should returns falsy if 
                valid, error message if invalid. 
  val:          A function which converts the validated field value to 
                an internal representation.

An action can have the following additional properties:

  allowUnknownFields: If true, then allow fields other than those
                      listed in fields.
  errFn:              Validation function: called with map of
                      field name-values and action meta-info.
		      Should returns falsy if valid, error message 
		      if invalid. 
*/

function isbnError(val, info) {
  if (!val.match(/^\d+(\-\d+)*$/)) {
    return `The ${info.label} field ` +
      `must consists of one-or-more digits separated by '-'.`
  }
}

function nameError(val, info) {
  if (val.match(/[^a-zA-Z \-\'\,\.]/)) {
    return `
      The ${info.label} field can contain only alphabetic
      characters or space, hyphen, quote, comma and period characters.
    `;
  }
}

function spaceError(val, info) {
  if (!val.match(/^\S+$/)) {
    return `The ${info.label} field cannot contain whitespace.`;
  }
}

const META = {
 
  newCart: {
    fields: [],
  },

  getCart: {
    fields: [
      { name: 'cartId',
	label: 'Shopping Cart ID',
	required: true,
	errFn: spaceError,
      },	     
    ],
  },

  cartItem: {
    allowUnknownFields: true,
    fields: [
      { name: 'cartId',
	label: 'Cart ID',
	required: true,
	errFn: spaceError,
      },	     
      { name: 'sku',          //Stock Keeping Unit
	label: 'SKU',
	required: true,
	errFn: spaceError,
      },	     
      {
	name: 'nUnits', 
	label: 'Number of Units',
	required: true,
	errFn(val, info) {
	  if (!val.match(/^\d+$/)) {
	    return `The ${info.label} field must be a integer.`;
	  }
	},
	val(v) { return  Number(v) },
      },
    ],
  },
  
  addBook: {
    allowUnknownFields: true,
    fields: [      
      {
	name: 'isbn',
	label: 'ISBN',
	errFn: isbnError,
	required: true,
      },
      {
	name: 'title', 
	label: 'Book Title',
	required: true,
      },
      {
	name: 'authors', 
	label: 'Author Names',
	required: true,
	errFn(val, info) {
	  return (val instanceof Array)
	    ? val.map(v => nameError(v, info)).filter(x => x)[0]
	    : `The ${info.label} field must specify an array.`;
	},
      },
      {
	name: 'publisher', 
	label: 'Publisher',
	required: true,
	errFn: nameError,
      },
      {
	name: 'year', 
	label: 'Publication Year',
	required: true,
	errFn(val, info) {
	  if (!String(val).match(/^\d{4}$/)) {
	    return `
              The ${info.label} field must specify a 4-digit year.
            `;
	  }
	},
	val(v) { return  Number(v) },
      },
      {
	name: 'pages', 
	label: 'Number of Pages',
	errFn(val, info) {
	  if (!String(val).match(/^\d+$/) || Number(val) <= 0) {
	    return `The ${info.label} field must be a positive integer.`;
	  }
	},
	val(v) { return  Number(v) },
      },
    ],
  },

  findBooks: {
    errFn(nameValues, info) {
      if (!Object.values(nameValues).some(v => v.match(/\S/))) {
	return "At least one search field must be specified.";
      }
    },
    fields: [
      {
	name: 'isbn',
	label: 'ISBN',
	errFn: isbnError,
      },
      {
	name: 'authorsTitleSearch', 
	label: 'Author or Title Words',
      },
    ],
  },

};

export default META;
