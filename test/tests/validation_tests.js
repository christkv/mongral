var connect = require('../../lib/mongral')
  , MongoClient = require('mongodb').MongoClient
  , Schema = connect.Schema
  , format = require('util').format;

// MongoDB Connection URL
var connectUrl = 'mongodb://localhost:27017/mapper_test';

/*************************************************************************************
 *
 * Basic simple validation
 *
 ************************************************************************************/
var NumberValidationType = function(maxValue) {
	return Schema.DefineType(function(r) {
		r.of(Number);

		// The actual validation method
		r.on.validate(function(name, value) {
			if(value == null) return new Error(format("the field %s cannot be undefined", name));
			if(typeof value != 'number') return new Error(format("the field %s must be a number", name));
			if(value > maxValue) return new Error(format("the field %s must be smaller than %d", name, maxValue));
		});
	});
}

// Define a Simple MailBox Schema
var MailBox = Schema('MailBox', function(r) {
  // Map to collection
  r.in.collection('mailboxes');
  // Number of mails is a number with a max bound of 1000
  r('number_of_mails').of(NumberValidationType(1000));
});

exports["Should Correctly Apply Simple Numeric Validation"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var mailBox = new MailBox({
  		number_of_mails: 1
  	});

  	mailBox.save(function(err, mailBox1) {
  		test.equal(null, err);
  		test.equal(1, mailBox1.number_of_mails);

  		mongral.db().collection('mailboxes').findOne({_id: mailBox1._id}, function(err, result) {
  			test.equal(null, err);
  			test.equal(1, result.number_of_mails);

				mongral.close();
				test.done();
  		});
  	});
	});
};

exports["Should Correctly Apply Simple Numeric Validation and Fail Due To Null Value"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var mailBox = new MailBox({});

  	// Save the mailbox
  	mailBox.save(function(err) {  		
  		test.equal(1, err.length);
  		test.equal('number_of_mails', err[0].field);
  		test.equal('the field number_of_mails cannot be undefined', err[0].message);

  		// Set a non-number for the number_of_mails
  		mailBox.number_of_mails = "hello";
	  	mailBox.save(function(err) {
	  		test.equal(1, err.length);
	  		test.equal('number_of_mails', err[0].field);
	  		test.equal('the field number_of_mails must be a number', err[0].message);

	  		// Set a non-number for the number_of_mails
	  		mailBox.number_of_mails = 2000;
		  	mailBox.save(function(err) {
		  		test.equal(1, err.length);
		  		test.equal('number_of_mails', err[0].field);
		  		test.equal('the field number_of_mails must be smaller than 1000', err[0].message);

					mongral.close();
					test.done();
		  	});
	  	});
  	});
	});
};

/*************************************************************************************
 *
 * Basic simple Async validation
 *
 ************************************************************************************/
var NumberValidationTypeAsync = function(maxValue) {
	return Schema.DefineType(function(r) {
		r.of(Number);

		// The actual validation method
		r.on.validateAsync(function(name, value, callback) {
			if(value == null) return callback(new Error(format("the field %s cannot be undefined", name)));
			if(typeof value != 'number') callback(new Error(format("the field %s must be a number", name)));
			if(value > maxValue) return callback(new Error(format("the field %s must be smaller than %d", name, maxValue)));
		});
	});
}

// Define a Simple MailBox Schema
var MailBox2 = Schema('MailBox2', function(r) {
  // Map to collection
  r.in.collection('mailboxes');
  // Number of mails is a number with a max bound of 1000
  r('number_of_mails').of(NumberValidationTypeAsync(1000));
  r('number_of_mails2').of(NumberValidationTypeAsync(1000))
});

exports["Should Correctly Apply Simple Numeric Validation and Fail Due To Null Value with ASYNC validator"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var mailBox = new MailBox2({});

  	// Save the mailbox
  	mailBox.save(function(err) {  		
  		test.equal(2, err.length);
  		test.equal('number_of_mails', err[0].field);
  		test.equal('the field number_of_mails cannot be undefined', err[0].message);
  		test.equal('number_of_mails2', err[1].field);
  		test.equal('the field number_of_mails2 cannot be undefined', err[1].message);

  		// Set a non-number for the number_of_mails
  		mailBox.number_of_mails = "hello";
  		mailBox.number_of_mails2 = "hello";
  		// Attempt to save the mailbox
	  	mailBox.save(function(err) {
	  		test.equal(2, err.length);
	  		test.equal('number_of_mails', err[0].field);
	  		test.equal('the field number_of_mails must be a number', err[0].message);
	  		test.equal('number_of_mails2', err[1].field);
	  		test.equal('the field number_of_mails2 must be a number', err[1].message);

	  		// Set a non-number for the number_of_mails
	  		mailBox.number_of_mails = 2000;
	  		mailBox.number_of_mails2 = 2000;
	  		// Attempt to save the mailBox
		  	mailBox.save(function(err) {
		  		test.equal(2, err.length);
		  		test.equal('number_of_mails', err[0].field);
		  		test.equal('the field number_of_mails must be smaller than 1000', err[0].message);
		  		test.equal('number_of_mails2', err[1].field);
		  		test.equal('the field number_of_mails2 must be smaller than 1000', err[1].message);

					mongral.close();
					test.done();
		  	});
	  	});
  	});
	});
};

/*************************************************************************************
 *
 * Extend an existing validation type
 *
 ************************************************************************************/
var NonEmptyType = Schema.DefineType(function(r) {
  // Type is of type String
  r.of(String);

  // Validate the email
  r.on.validate(function(name, value) {
    if(value == null) return new Error(format("%s cannot be undefined", name));
    return null;
  });
});

//
// All the countries
var countries = "AFGHANISTAN;AF@ÅLAND ISLANDS;AX@ALBANIA;AL@ALGERIA;DZ@AMERICAN SAMOA;AS@ANDORRA;AD@ANGOLA;AO@ANGUILLA;AI@ANTARCTICA;AQ@ANTIGUA AND BARBUDA;AG@ARGENTINA;AR@ARMENIA;AM@ARUBA;AW@AUSTRALIA;AU@AUSTRIA;AT@AZERBAIJAN;AZ@BAHAMAS;BS@BAHRAIN;BH@BANGLADESH;BD@BARBADOS;BB@BELARUS;BY@BELGIUM;BE@BELIZE;BZ@BENIN;BJ@BERMUDA;BM@BHUTAN;BT@BOLIVIA, PLURINATIONAL STATE OF;BO@BONAIRE, SINT EUSTATIUS AND SABA;BQ@BOSNIA AND HERZEGOVINA;BA@BOTSWANA;BW@BOUVET ISLAND;BV@BRAZIL;BR@BRITISH INDIAN OCEAN TERRITORY;IO@BRUNEI DARUSSALAM;BN@BULGARIA;BG@BURKINA FASO;BF@BURUNDI;BI@CAMBODIA;KH@CAMEROON;CM@CANADA;CA@CAPE VERDE;CV@CAYMAN ISLANDS;KY@CENTRAL AFRICAN REPUBLIC;CF@CHAD;TD@CHILE;CL@CHINA;CN@CHRISTMAS ISLAND;CX@COCOS (KEELING) ISLANDS;CC@COLOMBIA;CO@COMOROS;KM@CONGO;CG@CONGO, THE DEMOCRATIC REPUBLIC OF THE;CD@COOK ISLANDS;CK@COSTA RICA;CR@CÔTE D'IVOIRE;CI@CROATIA;HR@CUBA;CU@CURAÇAO;CW@CYPRUS;CY@CZECH REPUBLIC;CZ@DENMARK;DK@DJIBOUTI;DJ@DOMINICA;DM@DOMINICAN REPUBLIC;DO@ECUADOR;EC@EGYPT;EG@EL SALVADOR;SV@EQUATORIAL GUINEA;GQ@ERITREA;ER@ESTONIA;EE@ETHIOPIA;ET@FALKLAND ISLANDS (MALVINAS);FK@FAROE ISLANDS;FO@FIJI;FJ@FINLAND;FI@FRANCE;FR@FRENCH GUIANA;GF@FRENCH POLYNESIA;PF@FRENCH SOUTHERN TERRITORIES;TF@GABON;GA@GAMBIA;GM@GEORGIA;GE@GERMANY;DE@GHANA;GH@GIBRALTAR;GI@GREECE;GR@GREENLAND;GL@GRENADA;GD@GUADELOUPE;GP@GUAM;GU@GUATEMALA;GT@GUERNSEY;GG@GUINEA;GN@GUINEA-BISSAU;GW@GUYANA;GY@HAITI;HT@HEARD ISLAND AND MCDONALD ISLANDS;HM@HOLY SEE (VATICAN CITY STATE);VA@HONDURAS;HN@HONG KONG;HK@HUNGARY;HU@ICELAND;IS@INDIA;IN@INDONESIA;ID@IRAN, ISLAMIC REPUBLIC OF;IR@IRAQ;IQ@IRELAND;IE@ISLE OF MAN;IM@ISRAEL;IL@ITALY;IT@JAMAICA;JM@JAPAN;JP@JERSEY;JE@JORDAN;JO@KAZAKHSTAN;KZ@KENYA;KE@KIRIBATI;KI@KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF;KP@KOREA, REPUBLIC OF;KR@KUWAIT;KW@KYRGYZSTAN;KG@LAO PEOPLE'S DEMOCRATIC REPUBLIC;LA@LATVIA;LV@LEBANON;LB@LESOTHO;LS@LIBERIA;LR@LIBYA;LY@LIECHTENSTEIN;LI@LITHUANIA;LT@LUXEMBOURG;LU@MACAO;MO@MACEDONIA, THE FORMER YUGOSLAV REPUBLIC OF;MK@MADAGASCAR;MG@MALAWI;MW@MALAYSIA;MY@MALDIVES;MV@MALI;ML@MALTA;MT@MARSHALL ISLANDS;MH@MARTINIQUE;MQ@MAURITANIA;MR@MAURITIUS;MU@MAYOTTE;YT@MEXICO;MX@MICRONESIA, FEDERATED STATES OF;FM@MOLDOVA, REPUBLIC OF;MD@MONACO;MC@MONGOLIA;MN@MONTENEGRO;ME@MONTSERRAT;MS@MOROCCO;MA@MOZAMBIQUE;MZ@MYANMAR;MM@NAMIBIA;NA@NAURU;NR@NEPAL;NP@NETHERLANDS;NL@NEW CALEDONIA;NC@NEW ZEALAND;NZ@NICARAGUA;NI@NIGER;NE@NIGERIA;NG@NIUE;NU@NORFOLK ISLAND;NF@NORTHERN MARIANA ISLANDS;MP@NORWAY;NO@OMAN;OM@PAKISTAN;PK@PALAU;PW@PALESTINE, STATE OF;PS@PANAMA;PA@PAPUA NEW GUINEA;PG@PARAGUAY;PY@PERU;PE@PHILIPPINES;PH@PITCAIRN;PN@POLAND;PL@PORTUGAL;PT@PUERTO RICO;PR@QATAR;QA@RÉUNION;RE@ROMANIA;RO@RUSSIAN FEDERATION;RU@RWANDA;RW@SAINT BARTHÉLEMY;BL@SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA;SH@SAINT KITTS AND NEVIS;KN@SAINT LUCIA;LC@SAINT MARTIN (FRENCH PART);MF@SAINT PIERRE AND MIQUELON;PM@SAINT VINCENT AND THE GRENADINES;VC@SAMOA;WS@SAN MARINO;SM@SAO TOME AND PRINCIPE;ST@SAUDI ARABIA;SA@SENEGAL;SN@SERBIA;RS@SEYCHELLES;SC@SIERRA LEONE;SL@SINGAPORE;SG@SINT MAARTEN (DUTCH PART);SX@SLOVAKIA;SK@SLOVENIA;SI@SOLOMON ISLANDS;SB@SOMALIA;SO@SOUTH AFRICA;ZA@SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS;GS@SOUTH SUDAN;SS@SPAIN;ES@SRI LANKA;LK@SUDAN;SD@SURINAME;SR@SVALBARD AND JAN MAYEN;SJ@SWAZILAND;SZ@SWEDEN;SE@SWITZERLAND;CH@SYRIAN ARAB REPUBLIC;SY@TAIWAN, PROVINCE OF CHINA;TW@TAJIKISTAN;TJ@TANZANIA, UNITED REPUBLIC OF;TZ@THAILAND;TH@TIMOR-LESTE;TL@TOGO;TG@TOKELAU;TK@TONGA;TO@TRINIDAD AND TOBAGO;TT@TUNISIA;TN@TURKEY;TR@TURKMENISTAN;TM@TURKS AND CAICOS ISLANDS;TC@TUVALU;TV@UGANDA;UG@UKRAINE;UA@UNITED ARAB EMIRATES;AE@UNITED KINGDOM;GB@UNITED STATES;US@UNITED STATES MINOR OUTLYING ISLANDS;UM@URUGUAY;UY@UZBEKISTAN;UZ@VANUATU;VU@VENEZUELA, BOLIVARIAN REPUBLIC OF;VE@VIET NAM;VN@VIRGIN ISLANDS, BRITISH;VG@VIRGIN ISLANDS, U.S.;VI@WALLIS AND FUTUNA;WF@WESTERN SAHARA;EH@YEMEN;YE@ZAMBIA;ZM@ZIMBABWE;ZW".split("@");
// Parsed into a list of country codes
var country_codes = countries.map(function(country) { return country.split(";")[1].toLowerCase(); });

//
// Country validator extends the NonEmpty type and adds additional validations
// Note the mix of sync validation and ASYNC validation showing you can extend and mix types
var CountryType = NonEmptyType.extend(function(r) {  
  // Validate the email
  r.on.validateAsync(function(name, value, callback) {
    if(typeof value == 'string' && country_codes.indexOf(value.toLowerCase()) == -1)
      return callback(new Error(format("%s must be in the set of values [%s]", name, country_codes)), null);

    return callback(null, null);
  });
});

var Address = Schema('Address', function(r) {  
  // Map to collection
  r.in.collection('addresses');

  // Fields
  r.field('address').of(NonEmptyType);
  r.field('post_code').of(NonEmptyType);
  r.field('city').of(NonEmptyType);
  r.field('country').of(CountryType);
});

exports["Should correctly save a new address"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var address = new Address({
  			address: 'address'
  		, post_code: '00000'
  		, city: 'city'
  		, country: 'es'
  	});

  	// Save the address
  	address.save(function(err, address) {
  		test.equal(null, err);
  		test.ok(address._id != null);

			mongral.close();
			test.done();
  	});
	});
};

exports["Should fail to save due to no country set"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var address = new Address({
  			address: 'address'
  		, post_code: '00000'
  		, city: 'city'
  	});

  	// Save the address
  	address.save(function(err, address) {
  		test.ok(err != null);
  		test.equal(1, err.length);
  		test.equal('country cannot be undefined', err[0].message);
  		test.equal('country', err[0].field);

			mongral.close();
			test.done();
  	});
	});
};

exports["Should fail to save due to illegal country set"] = function(configuration, test) {
  connect(connectUrl, function(err, mongral) {
  	test.equal(null, err);

  	// Create a new mailbox entry
  	var address = new Address({
  			address: 'address'
  		, post_code: '00000'
  		, city: 'city'
  		, country: 'xx'
  	});

  	// Save the address
  	address.save(function(err, address) {
  		test.ok(err != null);
  		test.equal(1, err.length);
  		test.ok(err[0].message.indexOf("country must be in the set of values") != -1);
  		test.equal('country', err[0].field);

			mongral.close();
			test.done();
  	});
	});
};
