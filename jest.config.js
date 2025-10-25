export default { 
    transform: {},
    moduleFileExtensions: [
        "mjs",
        // must include "js" to pass validation https://github.com/facebook/jest/issues/12116
        "js",
      ],
      testRegex: `lib/.*.test.js$`,
};
