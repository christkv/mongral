var Configuration = require('integra').Configuration
  , mongodb = require('mongodb')
  , Db = mongodb.Db
  , Server = mongodb.Server
  , ServerManager = require('../helper/server_manager').ServerManager;

var single_server_config = function(options) {
  var dbName = "integration_tests";

  return function() {
    var self = this;
    options = options != null ? options : {};

    // Server Manager options
    var server_options = {
      purgedirectories: true
    }

    // Merge in any options
    for(var name in options) {
      server_options[name] = options[name];
    }

    // Server manager
    var serverManager = new ServerManager(server_options);

    //
    // Test suite start
    this.start = function(callback) {
      var self = this;

      serverManager.start(true, function(err) {
        if(err) throw err;

        // Open a new db instance
        self.newDbInstance().open(function(err, db) {
          if(err) throw err;

          // Drop the database
          db.dropDatabase(function(err, r) {
            if(err) throw err;
            callback();
          })
        });
      });
    }

    //
    // Test suite stop
    this.stop = function(callback) {
      serverManager.killAll(function(err) {
        callback();
      });        
    };

    //
    // Pr test setup
    this.setup = function(callback) { 
      callback(); 
    }
    
    //
    // Pr test teardown
    this.teardown = function(callback) { 
      callback(); 
    };

    // Returns the package for using Mongo driver classes
    this.getMongoPackage = function() {
      return mongodb;
    }

    this.newDbInstance = function(db_options, server_options) {
      db_options = db_options == null ? {w:1} : db_options;
      return new Db(dbName, new Server("127.0.0.1", 27017, server_options), db_options);
    }
  }
}

exports.single_server_config = single_server_config;