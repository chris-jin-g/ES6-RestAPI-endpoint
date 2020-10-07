// -*- mode: JavaScript; -*-

export default class ModelError {
  constructor(code,   /** documented error code */
	      msg,    /** undocumented descriptive error message */ 
	      name='' /** name of widget which is in error */ )
  {
    this.name = name;
    this.code = code;
    this.message = msg;
  }

  toString() { return `${this.name}:${this.code}: ${this.message}`; }
}