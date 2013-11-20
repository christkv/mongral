var connect = require('../lib/mongral')
  , MongoClient = require('mongodb').MongoClient
  , Schema = connect.Schema;

// MongoDB Connection URL
var connectUrl = 'mongodb://localhost:27017/mapper_test';

// Create reusable custom type for a string
var StringType = Schema.DefineType(function(r) {
  r.of(String);
});

// Address schema
var Address = Schema('Address', function(r) {  
  // Map to collection
  r.embedded.in.collection('users').as.array('addresses');
  // Fields
  r.field('address').of(StringType);
});

// Define a User schema
var UserWithAddresses = Schema('User2', function(r) {
  // Map to collection
  r.in.collection('users');
  // First name is string type definition
  r('first_name').of(StringType);
  // Last name is string type definition
  r('last_name').of(StringType)
  // Add Embedded address documents
  r.field('addresses').embedded.array.of(Address).with("1:n");
});

exports["Should correctly define a simple model, with embedded array doing push of object"] = function(configuration, test) {
  // Connect
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	var address = new Address({
  		address: "test address"
  	})

    var user = new UserWithAddresses({
        first_name: 'ole'
      , last_name: 'hansen2'
      , addresses: [address]
    });

    // Save the user
    user.save(function(err, user1) {
    	test.equal(null, err);
    	
    	// Push a new address to the user
    	user1.addresses.push(new Address({address: "address 2"}));
    	user1.save(function(err, user2) {
    		test.equal(null, err);
    		test.equal(2, user2.addresses.length())

    		// Update internal array element
    		address = user2.addresses.get(0);
    		address.address = "damn";

    		// Save user 2
    		user2.save(function(err, user3) {
          test.equal(null, err);
          test.equal("damn", user3.addresses.get(0).address);

          // Fetch the doc using driver
          mongral.db().collection('users').findOne({last_name: "hansen2"}, function(err, r) {
            test.equal(null, err);
            test.equal("damn", r.addresses[0].address);

            mongral.close();
            test.done();
          });
    		});
    	});
    });
  });
}

// Define a User schema
var User = Schema('User', function(r) {
  // Map to collection
  r.in.collection('users');
  // First name is string type definition
  r('first_name').of(StringType);
  // Last name is string type definition
  r('last_name').of(StringType)
});

exports["Should correctly define a simple model, save and update first_name field"] = function(configuration, test) {
  // Connect
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

    var user = new User({
        first_name: 'ole'
      , last_name: 'hansen'
    });

    // Save the user
    user.save(function(err, user1) {
    	test.equal(null, err);

    	// Update the first_name
    	user1.first_name = 'born'

    	// Save the user
    	user1.save(function(err, user2) {
	    	test.equal(null, err);
	    	test.equal('born', user2.first_name);

				mongral.close();
				test.done();
    	});
    });
  });
}

exports["Should correctly define a simple model and save an instance"] = function(configuration, test) {
  // Connect
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

    var user = new User({
        first_name: 'ole'
      , last_name: 'hansen'
    });

    // Ensure basic fields set
    test.equal('ole', user.first_name);
    test.equal('hansen', user.last_name);

    // Save the user
    user.save(function(err, user1) {
    	test.equal(null, err);
    	test.ok(user1._id != null);
	    test.equal('ole', user1.first_name);
	    test.equal('hansen', user1.last_name);

			mongral.close();
			test.done();
    });
  });
}