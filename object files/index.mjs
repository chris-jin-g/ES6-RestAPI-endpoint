#!/usr/bin/env node
// -*- mode: JavaScript; -*-

//debugger; //uncomment to force loading into chrome debugger

import assert from 'assert';
import child_process from 'child_process';
import fs from 'fs';
import Path from 'path';
import readline from 'readline';
import util from 'util';

import Model from './model.mjs';

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const exec = util.promisify(child_process.exec);


/************************* Top level routine ***************************/

async function go(cmd, options, args) {
  let model;
  try {
    model = await Model.make(options.dbUrl);
    const results = await doCommand(model, cmd, options, args);
    if (results !== undefined && results !== null) {
      if (results.length !== undefined) {
	console.log(JSON.stringify(results, null, 2));
      }
      else {
	console.log(results);
      }
    }
  }
  catch (err) {
    handleErrors(err);
  }
  finally {
    if (model) await model.close();
  }
}

/************************** Arguments Handling *************************/



function dataFilePath(args, argsMap) {
  if (args.length === 0) {
    usage(`DATA_FILE_PATH must be specified`);
  }
  argsMap.dataFilePath = args[0];
  return args.slice(1);
}

function namesArgs(args, argsMap) {
  argsMap.names =  (args.length > 0) ? args : [];
  return [];
}

//gets name=value from args.  Two special cases:
//value is of '[v1 ; v2; v3]' : splits into [v1, v2, v3]
//name is _json: merges in JSON given by path value.
async function nameValuesArgs(args, argsMap) {
  const dataDir = '.';
  const nameValues = {};
  let n = 0;
  for (const def of args) {
    const splits = def.trim().split('=');
    if (splits.length === 1) {
      break;
    }
    else if (splits.length !== 2) {
      usage(`bad NAME=VALUE argument '${def}'`);
    }
    let [name, value] = splits;
    if (name === '_json') {
      Object.assign(nameValues, await findAndReadJson(dataDir, value));
      n += 1;
    }
    else {
      if (value.startsWith('[') && value.endsWith(']')) {
	value = value.slice(1, -1).split(/\s*;\s*/).map(s => s.trim());
      }
      nameValues[name] = value;
      n += 1;
    }
  }
  argsMap.nameValues = nameValues;
  return args.slice(n);
}

async function findAndReadJson(dataDir, value) {
  let path;
  if (fs.existsSync(value)) {
    path = value;
  }
  else {    
    path = Path.join(dataDir, value);
    if (!fs.existsSync(path)) {
      console.error(`cannot find file at path '${value}'`);
      return {};
    }
  }
  return await readJson(path);
}

/*************************** Command Handling **************************/

async function doCommand(model, command, options, args) {
  const commandInfo = COMMANDS[command];
  assert(commandInfo);
  const argsMap = {};
  for (const argsFn of commandInfo.args) {
    args = await argsFn(args, argsMap);
  }
  if (args.length != 0) {
    usage(`unknown arguments ${args}`);
  }
  return await commandInfo.handler(model, argsMap, options);
}

/** handler for add-book */
async function addBookHandler(model, argsMap) {
  const { nameValues} = argsMap;
  return await model.addBook(nameValues)
}


/** handler for clear command */
async function clearHandler(model, argsMap) {
  await model.clear();
}

/** handler for find-book command */
async function findBooksHandler(model, argsMap) {
  const {nameValues, names=[]} = argsMap;
  const results = await model.findBooks( nameValues);
  if (names.length === 0) {
    return results;
  }
  else {
    return results.
      map(result => Object.fromEntries(names.map(n => [n, result[n]])));
  }
}

/** handler for new-cart */
async function newCartHandler(model, argsMap) {
  const { nameValues} = argsMap;
  return await model.newCart(nameValues)
}


/** handler for find-cart */
async function getCartHandler(model, argsMap) {
  const { nameValues} = argsMap;
  return await model.getCart(nameValues)
}

/** handler for cart-item */
async function cartItemHandler(model, argsMap) {
  const { nameValues} = argsMap;
  return await model.cartItem(nameValues)
}

/** handler for load-books */
async function loadBooksHandler(model, argsMap) {
  const { dataFilePath } = argsMap;
  const data = await readJson(dataFilePath);
  for (const datum of data) {
    await model.addBook(datum);
  }
}


function helpHandler() { usage(); }

/** command dispatch table and command help messages */
const COMMANDS = {
  clear: { 
    msg: 'clear model database',
    argsDescr: '',
    args: [],
    handler: clearHandler,
  },
  help: {
    msg: 'print this help message',
    argsDescr: '',
    args: [],
    handler: helpHandler,
  },  
  'new-cart': { 
    msg: 'create a new shopping cart, returning cart id',
    argsDescr: `NAME=VALUE...`,
    args: [ nameValuesArgs, ],
    handler: newCartHandler,
  },
  'get-cart': { 
    msg: 'find cart with specific cartId',
    argsDescr: `NAME=VALUE...`,
    args: [ nameValuesArgs, ],
    handler: getCartHandler,
  },
  'cart-item': {
    msg: 'update/create/delete cart item',
    argsDescr: `NAME=VALUE...`,
    args: [ nameValuesArgs, ],
    handler: cartItemHandler,
  },
  'add-book': {
    msg: 'create or update a book',
    argsDescr: `NAME=VALUE...`,
    args: [ nameValuesArgs, ],
    handler: addBookHandler,
  },
  'find-books': {
    msg: 'return list of books with specified isbn and titleAuthors',
    //argsDescr: `NAME=VALUE... NAME...`,
    //args: [ nameValuesArgs, namesArgs ],
    argsDescr: `NAME=VALUE...`,
    args: [ nameValuesArgs, ],
    handler: findBooksHandler,
  },
  'load-books': {
    msg: 'load books in file at DATA_FILE_PATH into model',
    argsDescr: `DATA_FILE_PATH`,
    args: [ dataFilePath, ],
    handler: loadBooksHandler,
  },
};


/****************************** Helpers ********************************/

function handleErrors(err) {
  if (typeof err === 'object' && err instanceof Array) {
    for (const e of err) { console.error(e.toString()); }
  }
  else {
    console.error(err);
  }
}

async function readJson(jsonPath) {
  try {
    let text;
    if (jsonPath.endsWith('.gz')) {
      const {stdout, stderr} = await exec(`zcat ${jsonPath}`);
      if (stderr) throw stderr;
      text = stdout.trim();
    }
    else {
      text = await readFile(jsonPath, 'utf8');
    }
    return JSON.parse(text);
  }
  catch (err) {
    throw [ `cannot read ${jsonPath}: ${err}` ];
  }
}

/************************** Command-Line Handling **********************/

const OPTIONS = {
};

/** handler for help command */
const CMD_WIDTH = 12;
function usage(msg) {
  if (msg) console.error('*** ', msg);
  const prog = Path.basename(process.argv[1]);
  const options = Object.keys(OPTIONS).join('|');
  console.error(`usage: ${prog} MONGO_DB_URL COMMAND`);
  console.error(`  where COMMAND is one of `);
  Object.keys(COMMANDS).sort().
    forEach(k => {
      const v = COMMANDS[k];
      console.error(`  ${k.padEnd(CMD_WIDTH)}${v.argsDescr}`);
      console.error(`      ${v.msg}`);
    });
  process.exit(1);
}


function getArgs(args) {
  const options = {};
  let i;
  for (i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      break;
    }
    else {
      const opt = arg;
      const option = OPTIONS[opt];
      if (!option) {
	usage(`unknown option ${opt}`);
      }
      options[option] = true;
    }
  } //for
  if (args.length - i < 2) { //minimally mongoUrl COMMAND
    usage();
  }
  const [ mongoUrl, cmd, ...rest ] = args.slice(i);
  if (!mongoUrl.startsWith('mongodb://')) {
    usage(`bad mongo url ${mongoUrl}`);
  }
  options.dbUrl = mongoUrl;
  if (COMMANDS[cmd] === undefined) {
    usage(`bad command ${cmd}`);
  }
  return [cmd, options, args.slice(i + 2)];
}

//top-level code
if (process.argv.length < 4) usage();


(async () => await go(...getArgs(process.argv.slice(2))))();
