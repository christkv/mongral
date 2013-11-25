var ObjectID = require('mongodb').ObjectID
  , EmbeddedArray = require('./embedded_array').EmbeddedArray
  , format = require('util').format;

var buildSchemaObject = function(schema_name, rules, schema) {
	var Schema = require('./schema').Schema;

	// Object to build
	var SchemaObject = function(values, options) {
	  var self = this;
	  options = options || {};
	  
	  // Add our type constructor
	  rules.type = SchemaObject;
	  // Collection
	  var _collection = Schema.default_db.collection(rules.in.collection);
	  // Contains the entire objects life cycle
	  var lifecycle = options.lifecycle ? options.lifecycle : { updateStatement: {}, isNew: false };
	  
	  // If we have no _id field set one
	  if(values._id == null) {
	    values._id = new ObjectID();
      lifecycle.isNew = true;
	  }

	  // Set up _id property
	  set_up_id_property(self, values);

	  // Set up the properties
	  for(var name in rules.fields) {
	    if(!rules.fields[name].transient) {
	      set_up_property(this, values, name, rules.fields[name], lifecycle, rules, options);
	    } else {
	      set_up_transient_property(this, values, name, rules.fields[name], lifecycle, rules, options);
	    }
	  } 

	  // Decorate the object with custom functions
	  for(var i = 0; i < rules.extensions.length; i++) {
	    var extension = rules.extensions[i];
	    self[extension.method] = extension.func;
	  }    

	  // Save function
	  self.save = function(callback) {
	    if(!Schema.default_db) throw new Error("no db connection found");

	    // State of the save
	    var state = lifecycle.isNew ? 'new' : 'update';
	    
	    // Validate the object
	    self.validate({state: state}, function(err) {
	      if(err) return callback(err);
	      // New document (no _id field)
	      if(lifecycle.isNew) {
	        // Apply all create level transformations
	        apply_create_transforms(self, values, rules, function(err, result) {
            if(err) return callback(err);
	          // Insert the document
	          _collection.insert(values, function(err, result) {
              if(err) return callback(err);
              // No longer a new object
              lifecycle.isNew = false;
              // Return the object
	            callback(null, self);
	          });
	        });
	      } else if(Object.keys(lifecycle.updateStatement).length > 0) {
          // Compile the update statement and perform the update
          executeUpdate(self, values, rules, lifecycle, _collection, options, function(err, result) {
            if(err) return callback(err);
            lifecycle.updateStatement = {};
            callback(null, self);
          });
	      } else {
	        callback(null, self);
	      }
	    });
	  }

	  // Validate is using a callback to support both
	  // sync and async validations
	  self.validate = function(options, callback) {
	    if(!Schema.default_db) throw new Error("no db connection found");
	    if(typeof options == 'function') {
	      callback = options;
	      options  = {};
	    }

	    // Holds all the state of the validation process
	    var errors = [];
	    var keys = Object.keys(rules.fields);
	    var number_to_validate = keys.length;

	    // Validate the values against the rules
	    for(var i = 0; i < keys.length; i++) {
	      var key = keys[i];
	      var value = values[key];

	      // Validate the key
	      validate_rule(self, key, value, rules.fields[key], options, function(err) {
	        if(err) errors = errors.concat(err);

	        // Adjust the number of validation's left
	        number_to_validate = number_to_validate - 1;

	        // We've finished validating
	        if(number_to_validate == 0) {
	          apply_custom_validations(self, rules, errors, options, callback);
	        }
	      })
	    }
	  }

	  self.destroy = function(callback) {
	    _collection.remove({_id: self._id}, function(err, number_of_removed) {
	      if(err) return callback(err, null);
	      if(number_of_removed == 0) 
	        return callback(new Error(format("failed to destroy %s object with _id %s", schema_name, self._id)), null);
	      // Done
	      return callback(null, null);
	    });
	  }

	  self.toBSON = function() {
	    return values;
	  }
	}

	Object.defineProperty(SchemaObject, 'schema', {
	  get: function() {
	    return rules;
	  },
	  enumerable:false
	});

	Object.defineProperty(SchemaObject, 'types', {
	  get: function() {
	    return Schema.types;
	  },
	  enumerable:false
	});

	// Scope thing
	SchemaObject.find = function(selector) {
	  return {
	    updateOneAndGet: function(update, callback) {
	      // Retrieve the schema collection
	      var collection = Schema.default_db.collection(rules.in.collection);
	      collection.findAndModify(selector, {}, update, {new:true}, function(err, doc) {
	        if(err) return callback(err, null);
	        if(!doc) return callback(null, null);
	        return callback(null, new SchemaObject(doc, {parent: doc._id}));
	      });
	    }
	  }
	}

	// FindOne method for the Schema object
	SchemaObject.findOne = function(selector, options, callback) {
	  if(typeof options == 'function') {
	    callback = options;
	    options = {};
	  }

	  // Retrieve the schema collection
	  var collection = Schema.default_db.collection(rules.in.collection);
	  // Initial projection for the query
	  var projection = {};

	  // If it's an embedded field, we need to rewrite the selector    
	  if(rules.in.embedded && rules.in.array_field) {
	    var _selector = {}
	    // Rewrite the query
	    for(var name in selector) {
	      _selector[rules.in.array_field + "." + name] = selector[name];
	    }
	    // Set the projection
	    projection[rules.in.array_field] = {$elemMatch: selector};
	    // Set the new selector
	    selector = _selector;
	  }

	  // Execute the findOne
	  collection.findOne(selector, projection, function(err, doc) {
	    if(err) return callback(err);
	    if(!doc) return callback(err, null);
	    // Return document 
	    var return_doc = null;
	    // If it's embedded
	    if(rules.in.embedded && rules.in.array_field) {
	      return_doc = doc[rules.in.array_field][0];
	    } else {
	      return_doc = doc;
	    }

	    // Return the document
	    return callback(null, new SchemaObject(return_doc, {parent: doc._id}));
	  });
	}

	SchemaObject.extend = function(new_schema_name, specification) {
	  // New schema rule
	  var _schema_rules = {
	      name: new_schema_name
	    , fields:rules.fields
	    , generated_fields: rules.generated_fields.slice(0)
	    , foreign_fields: {}
	    , extensions: rules.extensions.slice(0)
	    , indexes: rules.indexes.slice(0)
	    , transform: {
	        before: { 
	            create: rules.transform.before.create.slice(0)
	          , update: rules.transform.before.update.slice(0)
	          , remove: rules.transform.before.remove.slice(0)
	        }      
	    }
	    , validate: {
	        before: { 
	            create: rules.validate.before.create.slice(0)
	          , update: rules.validate.before.update.slice(0)
	          , remove: rules.validate.before.remove.slice(0)
	        }
	      }
	  };

	  // Add the in part
	  if(rules.in) {
	    var _in = {};
	    for(var name in rules.in) {
	      _in[name] = rules.in[name];
	    }
	    _schema_rules.in = _in;
	  }

	  // Build the specification
	  specification(schema(_schema_rules));
	  // Build the schema instance
	  return buildSchemaObject(schema_name, _schema_rules);
	}

	return SchemaObject;
}

/**
 *
 *	Helper methods
 *
 */
var set_up_id_property = function(self, values) {
  Object.defineProperty(self, '_id', {
    get: function() {
      return values['_id'];
    },
    enumerable:true
  });
}

var set_up_transient_property = function(self, values, name, rule, lifecycle, rules, options) {
  var value = values[name] ? values[name] : null;
  delete values[name];

  // Setting up value that's not saved
  Object.defineProperty(self, name, {
    get: function() {
      return value;
    },

    set: function(_value) {
      value = _value;
    }
  });  
}

var set_up_property = function(self, values, name, rule, lifecycle, rules, options) {
  if(rule.array) 
    return set_up_array_property(self, values, name, rule, lifecycle, rules, options);

  Object.defineProperty(self, name, {
    get: function() {
      var value = values[name];
      // Decorate the value with any functions
      if(rule.spec && Object.keys(rule.spec.functions).length > 0) {
        var new_value = {};
        var keys = Object.keys(rule.spec.functions);

        // Decorate with new functions
        for(var i = 0; i < keys.length; i++) {
          new_value[keys[i]] = rule.spec.functions[keys[i]];
        }

        // Build a wrapper object around the value
        new_value.value = value;
        new_value.define_type = rule;
        new_value.field = name;
        // Override internal value
        value = new_value;        
      }

      // Return the value
      return value;
    },

    set: function(value) {
      if(value.define_type) {
        value = value.value;
      }

      // Set the value
      values[name] = value;
  
      // Get reference to update statement
      var updateStatement = lifecycle.updateStatement;

      // If we are updating a field inside an array
      if(values._id && options.embedded && options.array) {
        if(lifecycle.updateStatement['$set'] == null) lifecycle.updateStatement['$set'] = {};
        var updateName = options.parent + "." + options.index + "." + name
        lifecycle.updateStatement['$set'][updateName] = value;
        return
      }


      // If we are updating a single field
      if(values._id) {
        if(lifecycle.updateStatement['$set'] == null) lifecycle.updateStatement['$set'] = {};
        lifecycle.updateStatement['$set'][name] = value;
        return
      }
    },
    enumerable: true
  });
}

var set_up_array_property = function(self, values, name, rule, lifecycle, rules, options) {
  var array = null;
  if(rule.embedded) {
    array = new EmbeddedArray(self, values, name, rule, lifecycle);
  }

  // Set up the array
  Object.defineProperty(self, name, {
    get: function() {
      return array;
    },
    enumerable: true
  });
}

//
// Validate the rules
var validate_rule = function(self, name, value, rule, options, callback) {
  var errors = [];

  if(rule.generated) {
    callback(null, true);
  } else if(rule.spec && rule.spec.validate) {
    var result = toValidationErrors(rule.spec.validate(name, value), name, rule, options);
    callback(result, result ? false : true);
  } else if(rule.spec && rule.spec.validateAsync) {
    rule.spec.validateAsync(name, value, function(err, result) {
      var err = toValidationErrors(err, name, rule, options);
      callback(err, result);
    });
  } else if(rule.array) {
    validate_array(self, name, rule, value, options, function(err, result) {
      callback(toValidationErrors(err, name, rule, options), result)
    });
  } else if(Array.isArray(rule)) {
    validate_array_of_rules(self, name, value, rule, options, function(err, result) {
      callback(toValidationErrors(err, name, rule, options), result)      
    });
  } else {
    callback(null, true);
  }
}

var toValidationErrors = function(err, name, rule, options) {
  if(err && Array.isArray(err)) {
    return err.map(function(value) {
      return toValidationError(name, rule, value, options);
    });
  } else if(err) {
    return [toValidationError(name, rule, err, options)];
  }

  return [];
}

var toValidationError = function(field, rule, error, options) {
  error.name = 'ValidationError';
  error.field = field;
  error.rule = rule;
  error.options = options;
  return error;
}

//
// Apply custom validations
var apply_custom_validations = function(self, rules, errors, options, callback) {
  // Operations to apply
  var operations = [];

  // Depending on the state
  if(options.state == 'new') {
    operations = rules.validate.before.create.slice(0);
  } else if(options.state == 'update') {
    operations = rules.validate.before.update.slice(0);
  } else if(options.state == 'remove') {
    operations = rules.validate.before.remove.slice(0);
  }

  // We've got no validations
  if(operations.length == 0) {
    if(errors.length > 0) return callback(errors, false);    
    return callback(null, true);
  }

  // Let's get moving on the validations
  var total_validations = operations.length;

  // Iterate over all the operations
  for(var i = 0; i < operations.length; i++) {
    var op = operations[i];

    if(op.async) {
      op.func.call(self, self, function(err, results) {
        total_validations = total_validations - 1;
  
        // Add any custom errors
        errors = add_custom_errors(errors, err);

        // No more validations left
        if(total_validations == 0) {
          if(errors.length > 0) return callback(errors, false);    
          return callback(null, true);
        }
      });
    } else {
      var result = op.func.call(self, self);
      total_validations = total_validations - 1;
      
      // Add any custom errors
      errors = add_custom_errors(errors, result);

      // No more validations left
      if(total_validations == 0) {
        if(errors.length > 0) return callback(errors, false);    
        return callback(null, true);
      }
    }
  }
}

// Add any errors
var add_custom_errors = function(errors, result) {
  if(Array.isArray(result)) {
    return errors.concat(result.map(function(error) { 
      if(error.name == 'ValidationError') return error;
      return toValidationError('custom', null, error, {parent:null, field:null});
    }));
  } else if(result instanceof Error) {
    if(result.name == 'ValidationError') errors.push(error);
    else errors.push(toValidationError('custom', null, result, {parent:null, field:null}));
  } 

  return errors;
}

//
//  Apply any transformations on fields at create
//
var apply_create_transforms = function(self, values, rules, callback) {
  // No transforms return
  if(rules.transform.before.create.length == 0)
    return callback(null, null);

  var transforms = rules.transform.before.create;
  var total_transforms = transforms.length;
  // Apply all transforms
  for(var i = 0; i < transforms.length; i++) {
    // Execute transform
    var f = function(_transform, _values) {
      if(_transform.field) {
        _transform.func(_values[_transform.field], function(err, value) {
          total_transforms = total_transforms - 1;
          // Set the transformed field
          _values[_transform.name] = value;
          // No more transforms finish up
          if(total_transforms == 0) 
            callback(null, null);
        });          
      } else {
        _transform.func(self, function(err, value) {
          total_transforms = total_transforms - 1;          
          // No more transforms finish up
          if(total_transforms == 0) 
            callback(null, null);
        })
      }
    };

    // Execute
    f(transforms[i], values);
  }
}

var update_transformations = function(self, rules, lifecycle, callback) {
  // Transform the object
  var transforms = rules.transform.before.update;
  var total_transforms = transforms.length;

  // Return if we have no transforms
  if(transforms.length == 0) return callback(null, null);
  
  // Wrap a function to execute
  var executeTransform = function(_self, _transform, callback) {
    // Field specific transform
    if(_transform.field) {
      var _value = _self[_transform.field];
      // Transform the field
      return _transform.func(_value, function(err, value) {
        if(err) return callback(err, null);
        if(err == null) {
          _self[_transform.name] = value;
        }

        // Return no error
        callback(null, null);
      });      
    }

    // General object level transform
    _transform.func(_self, function(err, value) {
      if(err) return callback(err, null);
      callback(null, null);
    });
  }

  // All possible errors from the transformations
  var errors = [];

  // Apply all transforms
  for(var i = 0; i < transforms.length; i++) {
    executeTransform(self, transforms[i], function(err, result) {
      if(err) errors.push(err);
      total_transforms = total_transforms - 1;

      if(total_transforms == 0) {
        callback(errors.length == 0 ? null : errors, null);
      }
    });
  }
}

//
// Execute the update
var executeUpdate = function(self, values, rules, lifecycle, collection, options, callback) {
  options = options || {};
  // If this is an embedded object use the parent id in the selector
  var selector = {_id: options.parent ? options.parent : values._id};

  // Update all the transformations
  update_transformations(self, rules, lifecycle, function(err, result) {
    if(err) return callback(err, null);
    // Update the document  
    collection.update(selector, lifecycle.updateStatement, function(err, result) {
      if(err) return callback(err);
      if(result == 0) return callback(new Error(format("Failed to update record with _id %s", values._id)));
      return callback(null, null);
    });        
  });
}

//
// Apply any transforms
var apply_update_transforms = function(field, update, selector, values, callback) {
  // Apply the operation
  var apply_field = function(_field, _update, _selector, _value) {
    if(_field.op == '$set') {
      if(!_update['$set']) _update['$set'] = {};
      _update['$set'][_field.name] = _value;
    } else if(_field.op == '$set_in_a') {
      if(!_update['$set']) _update['$set'] = {};
      _selector[_field.parent + "._id"] = _field._id;
      _update['$set'][_field.parent + ".$." + _field.name ] = _value;
    } else if(_field.op == '$push') {
      if(!_update['$push']) _update['$push'] = {};
      _update['$push'][_field.name] = _value;
    }        
  }


  // Check if we have a transformation chain
  if(field.rule 
    && field.rule.spec
    && field.rule.spec.transform.before.update.length > 0) {
      field.rule.spec.transform.before.update[0](field.value, function(err, value) {
        values[field.name] =  value;
        // Apply the field
        apply_field(field, update, selector, value);
        // Perform callback
        callback();
      });
  } else {
    // Apply the field
    apply_field(field, update, selector, field.value);
    // Perform callback
    callback();
  }
}

var validate_array_of_rules = function(self, name, value, rules, options, callback) {
  var validations = rules.length;
  var errors = [];

  // Go through all the validations
  for(var i = 0; i < rules.length; i++) {
    var _validate_rule = function(_self, _name, _value, _rule, _options, _callback) {
      // Validate a rule
      validate_rule(_self, _name, _value, _rule, _options, function(err) {
        validations = validations - 1;

        // Concatenate errors
        if(err) errors = errors.concat(err);

        // If no more validations we are done
        if(validations == 0) {
          callback(errors.length > 0 ? errors : null, null);
        }
      });      
    }

    // Execute the validation
    _validate_rule(self, name, value, rules[i], options, callback);
  }
}


var validate_array = function(self, name, rule, value, options, callback) {
  var array = self[name];
  // Extract the length
  array.length(function(err, length) {
    if(rule.min && length < rule.min) {
      callback(new Error(format("%s requires at least %d elements", name, rule.min)));
    } else if(rule.max && length > rule.max) {
      callback(new Error(format("%s requires at most %d elements", name, rule.max)));
    } else {
      var remaining = length;
      var errors = [];

      // If no length we are done
      if(length == 0) return callback(null, null);

      // We need to validate each of the elements
      for(var i = 0; i < length; i++) {
        array.get(i, function(err, doc) {
          // If we have an error save the error
          if(err) {
            remaining = remaining - 1;
            errors.push(err);
            // If it was the last element
            if(remaining == 0) {
              callback(errors.length > 0 ? errors : null, null);
            }
          } else {
            doc.validate({parent: name, index: i, state: options.state}, function(err, result) {
              remaining = remaining - 1;

              // Concatenate the errors if any
              if(Array.isArray(err)) {
                errors = errors.concat(err);
              }
  
              // If it was the last element
              if(remaining == 0) {
                callback(errors.length > 0 ? errors : null, null);
              }
            });
          }
        });
      }
    }
  });
}

exports.buildSchemaObject = buildSchemaObject;