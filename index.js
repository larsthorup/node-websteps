const childProcess = require('child_process');
const fs = require('fs');

const CDP = require('chrome-remote-interface');

function chromePath () {
  switch (process.platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'win32':
      const localPath = `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
      if (fs.existsSync(localPath)) {
        console.log({localPath})
        return localPath;
      }
      const globalPath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
      return globalPath;
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
      const args = (options.args || []).concat([
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        `--enable-logging=stdout`,
        '-no-first-run'
      ]);
      if (verbose) console.log(`Starting browser at ${browserPath}`);
      const cp = childProcess.spawn(browserPath, args, {stdio: 'inherit'});
      if (verbose) console.log(cp);
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
    if (process.platform === 'win32') {
      // Note: Inspired by https://github.com/GoogleChrome/puppeteer/commit/ac109dba6ddaa62a32fe920e864238d41bf22251#diff-cd756d74c4f724a8d0ebe5f47fff175aR107
      try {
        childProcess.execSync(`taskkill /pid ${this.cp.pid} /T /F`);
      } catch (err) {
        console.log(`Ignoring: ${err.message}`);
      }
    } else {
      this.cp.kill();
    }
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
    this.client.Page.navigate({url}); // Note: workaround for https://github.com/cyrus-and/chrome-remote-interface/issues/324
    return this.client.Page.navigate({url});
  }

  reload () {
    return this.client.Page.reload();
  }

  textOf (selector) {
    return this.evaluate(`document.querySelector("${selector}").textContent`);
  }

  type (text, selector) {
    // Note: see https://github.com/vitalyq/react-trigger-change
    return this.evaluate(`
      (() => {
        const el = document.querySelector("${selector}");
        const descriptor = Object.getOwnPropertyDescriptor(el, 'value');
        const focusEvent = document.createEvent('UIEvents');
        focusEvent.initEvent('focus', false, false);
        el.dispatchEvent(focusEvent);
        delete el.value;
        el.value = "${text}";
        const inputEvent = document.createEvent('HTMLEvents');
        inputEvent.initEvent('input', true, false);
        el.dispatchEvent(inputEvent);
        Object.defineProperty(el, 'value', descriptor);
      })()
    `);
  }

  waitForElement (selector, options) {
    options = options || {};
    let timeout = options.timeout || 5000;
    const pollTime = 100;
    return new Promise((resolve, reject) => {
      const poll = () => {
        this.evaluate(`document.querySelector("${selector}")`).then((element) => {
          if (element) {
            resolve(element);
          } else {
            timeout -= pollTime;
            if (timeout <= 0) {
              reject(new Error(`Failing to find "${selector}"`));
            } else {
              setTimeout(poll, pollTime);
            }
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
