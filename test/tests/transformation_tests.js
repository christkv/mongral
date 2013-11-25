var connect = require('../../lib/mongral')
  , MongoClient = require('mongodb').MongoClient
  , Schema = connect.Schema;

// MongoDB Connection URL
var connectUrl = 'mongodb://localhost:27017/mapper_test';

// Create reusable custom type for a string
var StringType = Schema.DefineType(function(r) {
  r.of(String);
});

// Transformation Class for timestamps
var CreateTimestamp = Schema.DefineType(function(r) {
  r.of(Date);

  // Before the creation of the object
  r.transform.before.create(function(value, callback) {
    callback(null, new Date());
  });
});

// Transformation Class for timestamps
var UpdateTimestamp = Schema.DefineType(function(r) {
  r.of(Date);

  // Before the creation of the object
  r.transform.before.create(function(value, callback) {
    callback(null, new Date());
  });

  // Set a new date object when we update the object
  r.transform.before.update(function(value, callback) {
    callback(null, new Date());
  });    
});

// Address schema
var Address = Schema('Address', function(r) {
  // Map to collection
  r.in.collection('addresses');

  // Fields
  r.field('address').of(StringType);
  r.field('post_code').of(StringType);
  r.field('city').of(StringType);

  // Transformation class
  r.field('created_on').generated.by(CreateTimestamp);
  r.field('updated_on').generated.by(UpdateTimestamp);
});

exports["Should correctly save a new address with automatically generated create stamp"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new signup object
  	var address = new Address({
  			address: "address"
  		, post_code: "33333"
  		, city: "somecity"
  	});

  	// Save the address
  	address.save(function(err, address1) {
  		test.equal(null, err);
  		test.ok(address1.created_on != null);
  		var created_on = address1.created_on
  		var updated_on = address1.updated_on

  		// Update a field
  		address1.city = 'someothercity';
  		address1.save(function(err, address2) {
	  		test.equal(null, err);
	  		test.ok(address2.created_on != null);
	  		test.equal(created_on, address2.created_on);	  	
	  		test.ok(address2.updated_on.getTime() != updated_on.getTime());

	  		test.done();
	  		mongral.close();
  		});
  	});
	});	
};

var Stat = Schema('Stat', function(r) {
  // Map to collection
  r.embedded.in.collection('logins').as.array('stats');

  // Fields
  r.field('accessed_on').of(Date);
});

// Address schema
var Login = Schema('Login', function(r) {
  // Map to collection
  r.in.collection('logins');

  // Basic fields
  r.field('name').of(StringType);
  r.field('username').of(StringType);
  // Stats field
  r.field('stats').embedded.array.of(Stat).with("0:n");

  // Adds a a stats element for each time the item is changed
  var addStatsMethod = function(self, callback) {
  	self.stats.push(new Stat({
  		accessed_on: new Date()
  	}))

  	callback(null, null);
  }

  // Add as both create and update transform
  r.transform.before.create(addStatsMethod);
  r.transform.before.update(addStatsMethod);
});

exports["Should correctly save a new object with a transformation step that adds some stats"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new signup object
  	var login = new Login({
  			name: 'ole dole'
  		, username: 'ole_dole'
  	});

  	// Save the address
  	login.save(function(err, login1) {
  		test.equal(null, err);
  		test.equal(1, login1.stats.length());
  		test.ok(login1.stats.get(0).accessed_on != null);

  		// Get the raw object
  		mongral.db().collection('logins').findOne({username: 'ole_dole'}, function(err, doc) {
  			test.equal(null, err);
  			test.equal('ole dole', doc.name);
  			test.equal('ole_dole', doc.username);
  			test.equal(1, doc.stats.length);
  			test.ok(doc.stats[0].accessed_on != null);
  			test.ok(doc.stats[0]._id != null);

	  		test.done();
	  		mongral.close();
  		});
  	});
	});	
};


// // Extend the Address schema
// var SignupAddress = Address.extend('SignupAddress', function(r) {
//   r.embedded.in.collection('signups').as.array('addresses');

//   r.field('default').of(Boolean);
// });

// // Create a user
// var SignUp = Schema('SignUp', function(r) {
//   // Map to collection
//   r.in.collection('signups');

//   // Basic fields
//   r.field('name').of(StringType);
//   r.field('secondary_email').of(StringType);
//   r.field('phone_number').of(StringType);
//   r.field('addresses').embedded.array.of(SignupAddress).with("1:n");
// });

// exports["Should correctly save a new signup"] = function(configuration, test) {
//   connect(connectUrl, function(err, mongral) {
//   	test.equal(null, err);

//   	// Create a new signup object
//   	var signup = new SignUp({
//   			name: 'name'
//   		,	secondary_email: 'name@name.com'
//   		, phone_number: '2223334444'
//   		, addresses: [{
//   				address: 'address'
//   			,	post_code: 'code'
//   			, city: 'city'
//   			, default: true
//   		}]
//   	});

//   	signup.save(function(err, signup1) {
//   		// Find a single document
//   		mongral.db().collection('signups').findOne({name: 'name'}, function(err, doc) {
//   			test.equal(null, err);
//   			test.equal('name', doc.name);
//   			test.equal('name@name.com', doc.secondary_email);
//   			test.equal('2223334444', doc.phone_number);
//   			test.equal(1, doc.addresses.length);
//   			test.equal('address', doc.addresses[0].address);
//   			test.equal('code', doc.addresses[0].post_code);
//   			test.equal('city', doc.addresses[0].city);
//   			test.equal(true, doc.addresses[0].default);
//   			test.ok(doc.addresses[0]._id != null);

// 		    mongral.close();
// 		    test.done();
//   		});
//   	});
//   });
// }

// exports["Should fail due to missing addresses array"] = function(configuration, test) {
//   connect(connectUrl, function(err, mongral) {
//   	test.equal(null, err);

//   	// Create a new signup object
//   	var signup = new SignUp({
//   			name: 'name'
//   		,	secondary_email: 'name@name.com'
//   		, phone_number: '2223334444'
//   	});

//   	signup.save(function(err, signup1) {
//   		test.equal(1, err.length);
//   		test.equal('addresses requires at least 1 elements', err[0].message);
//   		test.equal('addresses', err[0].field);

// 	    mongral.close();
// 	    test.done();
//   	});
//   });
// }
