var connect = require('../../lib/mongral')
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
  r.field('post_code').of(StringType);
  r.field('city').of(StringType);
});

// Extend the Address schema
var SignupAddress = Address.extend('SignupAddress', function(r) {
  r.embedded.in.collection('signups').as.array('addresses');

  r.field('default').of(Boolean);
});

// Create a user
var SignUp = Schema('SignUp', function(r) {
  // Map to collection
  r.in.collection('signups');

  // Basic fields
  r.field('name').of(StringType);
  r.field('secondary_email').of(StringType);
  r.field('phone_number').of(StringType);
  r.field('addresses').embedded.array.of(SignupAddress).with("1:n");
});

exports["Should correctly save a new signup"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new signup object
  	var signup = new SignUp({
  			name: 'name'
  		,	secondary_email: 'name@name.com'
  		, phone_number: '2223334444'
  		, addresses: [{
  				address: 'address'
  			,	post_code: 'code'
  			, city: 'city'
  			, default: true
  		}]
  	});

  	signup.save(function(err, signup1) {
  		// Find a single document
  		mongral.db().collection('signups').findOne({name: 'name'}, function(err, doc) {
  			test.equal(null, err);
  			test.equal('name', doc.name);
  			test.equal('name@name.com', doc.secondary_email);
  			test.equal('2223334444', doc.phone_number);
  			test.equal(1, doc.addresses.length);
  			test.equal('address', doc.addresses[0].address);
  			test.equal('code', doc.addresses[0].post_code);
  			test.equal('city', doc.addresses[0].city);
  			test.equal(true, doc.addresses[0].default);
  			test.ok(doc.addresses[0]._id != null);

		    mongral.close();
		    test.done();
  		});
  	});
  });
}

exports["Should fail due to missing addresses array"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new signup object
  	var signup = new SignUp({
  			name: 'name'
  		,	secondary_email: 'name@name.com'
  		, phone_number: '2223334444'
  	});

  	signup.save(function(err, signup1) {
  		test.equal(1, err.length);
  		test.equal('addresses requires at least 1 elements', err[0].message);
  		test.equal('addresses', err[0].field);

	    mongral.close();
	    test.done();
  	});
  });
}
