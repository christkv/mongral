var Runner = require('integra').Runner;

module.exports = function(configurations) {
  //
  //  Single server runner
  //
  //

  // Configure a Run of tests
  var tests = Runner
    // Add configurations to the test runner
    .configurations(configurations)
    
    // Execute serially
    .exeuteSerially(true)
    
    // No hints
    .schedulerHints(null)

    // The list of files to execute
    .add("tests",
      [
      	"/test/simple_model_tests.js"
      ]
    );

  // Export runners
  return {
      runner: tests
  }    
}
