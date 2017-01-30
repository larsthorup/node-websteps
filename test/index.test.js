const path = require('path');

require('chai').should();
const co = require('co'); // Note: poor mans async/await

const websteps = require('..');

describe('websteps', function () {
  let browser, window;

  this.timeout(55000); // Note: end-to-end tests are slow...

  before(function () {
    return co(function * () {
      browser = yield websteps.launching({
        browser: 'chrome',
        port: 9444,
        userDataDir: path.join(__dirname, '../.tmp/userData'),
        verbose: false
      });
      window = yield browser.connecting();
    });
  });

  it('should search on github.com', function () {
    return co(function * () {
      yield window.navigating('https://github.com/search');
      yield window.waitForElement("input[name='q']");
      yield window.type('websteps', "input[name='q']");
      yield window.click("button[type='submit']");
      yield window.waitForElement("ul.repo-list");
      (yield window.textOf("ul.repo-list")).should.contain('larsthorup');
    });
  });

  after(function () {
    if (window) window.close();
    if (browser) browser.close();
  });
});