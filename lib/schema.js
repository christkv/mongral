var DefineType = require('./define_type').DefineType
  , ObjectID = require('mongodb').ObjectID
  , EmbeddedArray = require('./embedded_array').EmbeddedArray
  , inherits = require('util').inherits
  , format = require('util').format
  , buildSchemaObject = require('./schema_object').buildSchemaObject;

var Schema = module.exports = function(schema_name, specification) {
  var schema_rules = {
      name: schema_name
    , fields:{}
    , generated_fields: []
    , foreign_fields: {}
    , extensions: []
    , indexes: []
    , transform: {
      before: { 
        create: [], update: [], remove: []
      }      
    }
    , validate: {
        before: { 
          create: [], update: [], remove: []
        }
      }
  };  

  // Store the schema rule under the name
  if(!Schema.types) Schema.types = {};
  // Add to the type
  Schema.types[schema_name] = schema_rules;

  // Let's figure out the type
  var un_chain_types = function(type) {
    var types = [type.chain, type];
    var pointer = type.chain;

    while(pointer != null) {
      pointer = pointer.chain;
      if(pointer) types.unshift(pointer);
    }

    // Return the types array
    return types;
  }

  var create_schema = function(_schema_rules) {
    // Define schema fields
    var schema = function(field, transient) {
      return {
        of: function(type) {
          // Register a chained type
          if(type.chain) {
            _schema_rules.fields[field] = un_chain_types(type);
            if(transient) _schema_rules.fields[field].transient = true;
            return;
          }

          // Register a normal type
          _schema_rules.fields[field] = type.type ? {type: type.type, spec:type.spec} : {type:type};
          if(transient) _schema_rules.fields[field].transient = true;
        },

        generated: {
          by: function(type) {
            _schema_rules.fields[field] = type.type ? {type:type.type, spec:type.spec, generated:true} : {type:type, generated:true};
          }
        },

        embedded: {
          array: {
            of: function(type) {
              _schema_rules.fields[field] = type.type 
                ? {type: type.type, spec:type.spec, embedded:true, array:true} 
                : {type: type, embedded:true, array:true}
              // Return further specialization
              return {
                with: function(cardinality) {
                  // legal cardinalities
                  var re = /[\d+\:[\d+|n]]|\d+/i;
                  // If it does not match
                  if(!re.test(cardinality)) throw new Error("Cardinality must be of form Number|Number:Number|Number:n");
                  // Split it up
                  var parts = cardinality.split(":");
                  // Minimum size
                  var min = parseInt(parts[0], 10);
                  var max = 0;
                  // If we have min numbers
                  if(min > 0) {
                    _schema_rules.fields[field].min = min;
                  }

                  // We have a max
                  if(parts.length == 2) {
                    if(parts[1].match(/\d+/)) {
                      max = parseInt(parts[1], 10);
                    }
                  }

                  // We have a maximum cardinality
                  if(max > 0) {
                   _schema_rules.fields[field].max = max; 
                  }
                }
              }
            }
          }
        },
      }
    }

    // Added the field
    schema.field = schema;
    
    // Transient field
    schema.transient = {
      field: function(field) {
        return schema(field, true);
      }
    }

    schema.in = {
      collection: function(collection) {
        _schema_rules.in = {collection: collection};
      }    
    }

    schema.collection = {
      has: {
        ascending: {
          ttl: {
            index: function(field, timeout) {
              _schema_rules.indexes.push({type:'ttl', field:field, value:timeout, sort:1});
            }
          }        
        },

        descending: {
          ttl: {
            index: function(field, timeout) {
              _schema_rules.indexes.push({type:'ttl', field:field, value:timeout, sort:-1});
            }
          }        
        }
      }
    }

    schema.extend = {
      this: {
        with: function(method, func) {
          _schema_rules.extensions.push({method: method, func: func});
        }
      }
    }

    // 
    // Add transformations
    //
    schema.transform = {
      before: {
        create: function(func) {
          _schema_rules.transform.before.create.unshift({func: func});
        }, 

        update: function(func) {
          _schema_rules.transform.before.update.unshift({func: func});
        }, 

        remove: function(func) {
          _schema_rules.transform.before.remove.unshift({func: func});
        }, 
      }
    }  

    //
    // Let's you hook up custom object level validation methods
    //
    schema.validate = {
      //
      // Synchronous validators (f.ex comparing internal values like password/confirm password)
      //
      before: {
        create: function(func) {
          _schema_rules.validate.before.create.push({func: func});
        },

        update: function(func) {
          _schema_rules.validate.before.update.push({func: func});
        },

        remove: function(func) {
          _schema_rules.validate.before.update.push({func: func});
        }
      },

      //
      // Asynchronous validators (calling out f.ex to other code)
      //
      async: {
        before: {
          create: function(func) {
            _schema_rules.validate.before.create.push({func: func, async: true});
          },

          update: function(func) {
            _schema_rules.validate.before.update.push({func: func, async: true});
          },

          remove: function(func) {
            _schema_rules.validate.before.update.push({func: func, async: true});
          }
        }
      }
    }

    schema.embedded = {
      in: {
        collection: function(collection) {
          _schema_rules.in = {collection: collection, embedded: true};
          return {
            as: {
              array: function(array_field) {
                _schema_rules.in.array_field = array_field;
              }
            }
          }
        }
      }
    }

    return schema;
  }

  // Build the specification
  specification(create_schema(schema_rules));
  
  // Aggregate up all transform methods for performance
  add_transform_methods(schema_rules);

  // Build the schema instance
  return buildSchemaObject(schema_name, schema_rules, create_schema);
}

// Map the field
var map_field = function(_schema_rules, _array_name, _field, _field_name) {
  if(_field.spec && _field.spec.transform.before[_array_name].length > 0) {
    var funcs = _schema_rules.transform.before[_array_name];
    var field_funcs = _field.spec.transform.before[_array_name];
    
    // Add all the functions
    for(var j = 0; j < field_funcs.length; j++) {
      _schema_rules.transform.before[_array_name].push({func: field_funcs[j], field: _field, name: _field_name});
    }            
  }      
}

// Add transform functions to global transform queue
var add_transform_methods = function(schema_rules) {
  // Map all the field transforms into the global list of functions
  var fields = schema_rules.fields;
  var keys = Object.keys(fields);
  
  // Go over all the fields and accumulate the transforms
  for(var i = 0; i < keys.length; i++) {
    var field = fields[keys[i]];

    // Add the transform to the main list
    // Chained type
    if(Array.isArray(field)) {
      field.forEach(function(_field) {
        map_field(schema_rules, 'create', _field, keys[i]);
        map_field(schema_rules, 'update', _field, keys[i]);
        map_field(schema_rules, 'remove', _field, keys[i]);
      });
    } else if(field.spec && field.spec.transform.before.create.length > 0) {
      map_field(schema_rules, 'create', field, keys[i]);
      map_field(schema_rules, 'update', field, keys[i]);
      map_field(schema_rules, 'remove', field, keys[i]);
    }
  }  
}

// Export the Define type object
module.exports.DefineType = DefineType;
module.exports.Schema = Schema;