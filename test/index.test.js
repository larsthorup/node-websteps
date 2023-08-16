const path = require('path');

require('chai').should();

const websteps = require('..');

describe('websteps', function () {
  let browser, window;

  this.timeout(55000); // Note: end-to-end tests are slow...

  before(async function () {
    browser = await websteps.launching({
      browser: 'chrome',
      port: 9444,
      userDataDir: path.join(__dirname, '../.tmp/userData'),
      verbose: false
    });
    window = await browser.connecting();
  });

  it.skip('should search on github.com', async function () { // Note: Github search page changed
    await window.navigating('https://github.com/search?q=websteps&type=repositories');
    await window.waitForElement("input[name='q']");
    await window.reload();
    await window.waitForElement("input[name='q']");
    await window.type('websteps', "input[name='q']");
    await window.click("button[type='submit']");
    await window.waitForElement("ul.repo-list");
    (await window.textOf("ul.repo-list")).should.contain('larsthorup');
  });

  it('should search on npmjs.com', async function () {
    await window.navigating('https://www.npmjs.com/');
    await window.waitForElement("input[name='q']");
    await window.reload();
    await window.waitForElement("input[name='q']");
    await window.type('websteps', "input[name='q']");
    await window.click("button[type='submit']");
    // await window.waitForElement("ul.repo-list");
    // (await window.textOf("ul.repo-list")).should.contain('larsthorup');
    await window.waitForElement('#repository-link');
    (await window.textOf('#repository-link')).should.contain('github.com/larsthorup/node-websteps');
  });

  after(function () {
    if (window) window.close();
    if (browser) browser.close();
  });
});
