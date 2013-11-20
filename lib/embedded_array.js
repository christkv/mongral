var ObjectID = require('mongodb').ObjectID;

var EmbeddedArray = function(self, values, name, rule, lifecycle) {  
  var self = this;
  var array = Array.isArray(values[name]) ? values[name] : [];

  this.get = function(index, callback) {
    // Convert to basic BSON document
    var object = array[index].toBSON ? array[index].toBSON() : array[index];
    var instance = new rule.type(object, {   
        lifecycle: lifecycle 
      , parent: name
      , embedded: true
      , array: self
      , index: index
    });

    if(typeof callback == 'function') return callback(null, instance);
    return instance;
  }

  this.load = function(callback) {    
    callback(null, null);
  }

  this.push = function(element) {
    // If no $push statement exists add one
    if(lifecycle.updateStatement['$push'] == null) lifecycle.updateStatement['$push'] = {};
    // Push element to the embedded array
    lifecycle.updateStatement['$push'][name] = element;
    // Add to internal array
    array.push(element);
  }

  this.validate = function(callback) {
    callback(null, null);
  }

  this.length = function(callback) {
    if(typeof callback == 'function') callback(null, array.length);
    return array.length;
  }

  // Convert the representation to bson
  this.toBSON = function() {
    return array;
  }

  // Convert the representation to json
  this.toJSON = function() {
    return array;
  }
}

exports.EmbeddedArray = EmbeddedArray;