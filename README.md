# node-websteps

[![npm version](https://badge.fury.io/js/websteps.svg)](https://www.npmjs.com/package/websteps)
[![Dependency Status](https://david-dm.org/larsthorup/node-websteps.png)](https://david-dm.org/larsthorup/node-websteps#info=dependencies)
[![devDependency Status](https://david-dm.org/larsthorup/node-websteps/dev-status.png)](https://david-dm.org/larsthorup/node-websteps#info=devDependencies)


End-to-end web testing on top of Chrome Debugging Protocol

Pure JavaScript except for Chrome itself. No Java-based Selenium or platform-specific binary chromedriver required.

API described by the [test](test/index.test.js).

    npm install
    npm test
    
### Roadmap

Pull requests are most welcome!

* Add strategy for finding Chrome binary on OSX and Linux
* Travis-CI job
* Better strategy for finding Chrome binary on Windows
