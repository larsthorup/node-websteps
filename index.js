const childProcess = require('child_process');

const CDP = require('chrome-remote-interface');

function chromePath () {
  switch (process.platform) {
    case 'darwin':
      return 'google chrome';
    case 'win32':
      return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'; // Note: eventually improve this strategy to locate chrome.
    default:
      return 'google-chrome';
  }
}

function launching (options = {}) {
  return new Promise((resolve, reject) => {
    const browser = options.browser || 'chrome';
    const port = options.port || 9222;
    const userDataDir = options.userDataDir;
    const verbose = options.verbose;
    if (browser === 'chrome') {
      const browserPath = chromePath();
      const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`
      ];
      if (verbose) console.log(`Starting browser at ${browserPath}`);
      const cp = childProcess.spawn(browserPath, args, {});
      resolve(new Browser({browser, cp, port, verbose}));
    } else {
      reject(new Error(`Unsupported browser: ${browser}`));
    }
  });
}

class Browser {
  constructor ({browser, cp, port, verbose}) {
    this.browser = browser;
    this.cp = cp;
    this.port = port;
    this.verbose = verbose;
  }

  close () {
    if (this.verbose) console.log(`Closing ${this.browser}`);
    this.cp.kill();
  }

  connecting (url) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.verbose) console.log('Connecting to browser via CDP');
        CDP({port: this.port}, (client) => {
          Promise.all([
            client.Page.enable()
          ]).then((result) => {
            resolve(new Window({client}));
          }).catch((err) => {
            console.error(`ERROR: ${err.message}`);
            client.close();
            reject(err);
          });
        }).on('error', (err) => {
          console.error('Cannot connect to remote endpoint:', err);
          reject(err);
        });
      }, 1000); // Note: waiting for browser to start, eventually retry with shorter interval to avoid the long initial wait if not necessary
    });
  }
}

class Window {
  constructor ({client}) {
    this.client = client;
  }

  attrOf (selector, attribute) {
    return this.evaluate(`document.querySelector("${selector}").${attribute}`);
  }

  click (selector) {
    return this.evaluate(`document.querySelector("${selector}").click()`);
  }

  close () {
    this.client.close();
  }

  cssTextContains (str) {
    return this.evaluate(`
      [].slice.call(document.styleSheets).reduce((prev, styleSheet) => {
        if (styleSheet.cssRules) {
          return prev + [].slice.call(styleSheet.cssRules).reduce((prev, cssRule) => {
            return prev + cssRule.cssText;
          }, '');
        } else {
          return prev;
        }
      }, '').indexOf("${str}") >= 0;
    `);
  }

  evaluate (expression) {
    return new Promise((resolve, reject) => {
      this.client.Runtime.evaluate({expression}, (err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          // console.log('Runtime.evaluate', expression, result);
          switch (result.result.type) {
            case 'object':
              switch (result.result.subtype) {
                case 'null':
                  resolve(null);
                  break;
                default:
                  resolve(result.result); // Note: we cannot access the object more directly than this
              }
              break;
            default:
              resolve(result.result.value);
          }
        }
      });
    });
  }

  htmlOf (selector) {
    return this.evaluate(`document.querySelector("${selector}").innerHTML`);
  }

  navigating (url) {
    // console.log('CDP navigate', url)
    return this.client.Page.navigate({url});
  }

  textOf (selector) {
    return this.evaluate(`document.querySelector("${selector}").textContent`);
  }

  type (text, selector) {
    return this.evaluate(`
      (() => {
        const el = document.querySelector("${selector}");
        const evt = document.createEvent('CustomEvent');
        evt.initEvent('input', true, true);
        el.value = "${text}";
        el.dispatchEvent(evt);
      })()
    `);
  }

  waitForElement (selector) {
    return new Promise((resolve, reject) => {
      const poll = () => {
        this.evaluate(`document.querySelector("${selector}")`).then((element) => {
          if (element) {
            resolve(element);
          } else {
            setTimeout(poll, 100);
          }
        }).catch((err) => {
          reject(err);
        });
      };
      poll();
    });
  }
}

module.exports = {
  launching: launching
};
