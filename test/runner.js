// Configuration
var Configuration = require('integra').Configuration;

// console.log(argv._);
var argv = require('optimist')
    .usage('Usage: $0 -t [target] -e [environment] -n [name] -f [filename]')
    .argv;

// Configurations
var single_server_config = require('./configurations/single_server').single_server_config

// 
//  Configurations
//
var configurations = Configuration  
  // Single server configuration
  .add('single_server', single_server_config())

//
//  Runners
//
var single_server = require('./runners/single_server')(configurations)

// Running a specific test
var run_options = {};
if(argv.n) run_options.test = argv.n;
if(argv.f) run_options.file = argv.f;

// Run tests
var environment = argv.e ? argv.e : 'single_server'
single_server.runner.on('end', function() {
  process.exit(0);
});
single_server.runner.run(environment, run_options);
