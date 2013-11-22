var format = require('util').format
  , StringType = require('./types/string_type').StringType;

// Returns a schema type
var define_type_schema = function(_rule) {
  // The actual type we are building on
  var define_type = {
    of: function(type) {
      // Set the type
      _rule.type = type;
      
      // Decorate the type
      if(type == String) {
        StringType(_rule.spec, define_type);
      }
      
      // Return the type again now decorated with
      // the possible options
      return define_type;
    },

    on: {
      validate: function(func) {
        if(_rule.spec.validate) 
          console.error("overriding existing validate command on DefineType");
        
        // Set the current validate function
        _rule.spec.validate = func;
      },

      validateAsync: function(func) {
        if(_rule.spec.validateAsync) 
          console.error("overriding existing validate command on DefineType");

        // Set the current validate function
        _rule.spec.validateAsync = func;
      }
    },

    extend: {
      value: {
        with: {
          function: function(name, func) {
            if(_rule.spec.functions[name]) 
              console.error(format("overriding existing function %s on DefineType", name));

            _rule.spec.functions[name] = func;
          }
        }
      }
    },

    // Transformations on custom type definitions
    transform: {
      before: {
        remove: function(func) {
          _rule.spec.transform.before.remove.push(func);
        },
 
        create: function(func) {
          _rule.spec.transform.before.create.push(func);
        },
        
        update: function(func) {
          _rule.spec.transform.before.update.push(func);
        }
      }
    }
  }

  // Return the schema
  return define_type;
}

var Rule = function(spec) {
  this.chain = null;
  this.spec = spec ? spec : {
    functions: {}
    // Transformation methods
    , transform: { 
        // Before events
        before: {
          // Before the save action
            create: []
          , update: []
          , remove: []
        }
      }
  }

  this.extend = function(specification) {
    // Create a new rule
    var rule = new Rule({
      transform: {
        before: {
            create: this.spec.transform.before.create.slice(0)
          , update: this.spec.transform.before.update.slice(0)
          , remove: this.spec.transform.before.remove.slice(0)
        }
      }
    });
    
    // Let's define the rule
    specification(define_type_schema(rule));
    
    // Save the extended rule as part of the chain
    rule.chain = this;
    return rule;
  }
}

var DefineType = function(specification) {
  // Create a new rule
  var rule = new Rule();
  // Let's get the rule setup
  specification(define_type_schema(rule));
  // Return the finished up rule
  return rule;
}

exports.DefineType = DefineType;