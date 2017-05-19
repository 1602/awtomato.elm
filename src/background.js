/* global devtoolsPanelConnections devtoolsSidebarConnections contentScriptConnections */
window.devtoolsPanelConnections = window.devtoolsPanelConnections || {};
window.devtoolsSidebarConnections = window.devtoolsSidebarConnections || {};
window.contentScriptConnections = window.contentScriptConnections || {};

window.automate = async function(tabId) {

    chrome.tabs.get(tabId, async tab => {
        const page = createPageInterface(tabId);
        const host = tab.url.split('/')[2];
        const store = JSON.parse(localStorage.store);
        const contexts = store.hostData[host].contexts;
        const matchedContext = await match(page, contexts);
        console.info('matched context', matchedContext);
        await executeContext(page, matchedContext);
    });

    async function executeContext(page, context) {
        const selectors = context.selectors.map(s => s.entity.selector);
        console.info(selectors);
        const fillableSelectors = await getFillableSelectors(page, selectors);
        const interactableSelectors = await getInteractableSelectors(page, selectors);
        await fillDataIn(page, fillableSelectors);
        await interactWith(page, interactableSelectors);
    }

    async function getFillableSelectors(page, selectors) {
        const result = [];
        for (let i = 0; i < selectors.length; i += 1) {
            const isFillable = await page.callFn(checkFillable, [selectors[i]]);
            console.info(selectors[i], isFillable);
            if (isFillable) {
                result.push(selectors[i]);
            }
        }
        return result;
    }

    async function getInteractableSelectors(page, selectors) {
        const result = [];
        for (let i = 0; i < selectors.length; i += 1) {
            const isFillable = await page.callFn(checkInteractable, [selectors[i]]);
            if (isFillable) {
                result.push(selectors[i]);
            }
        }
        return result;
    }

    function checkFillable(selector) {
        const el = document.querySelector(selector);

        if (!el) {
            return false;
        }

        if (el.tagName === 'INPUT' && el.type !== 'button' && el.type !== 'submit' && el.type !== 'image') {
            return true;
        }

        return false;
    }

    function checkInteractable(selector) {
        const el = document.querySelector(selector);

        if (!el) {
            return false;
        }

        if (el.tagName !== 'INPUT' || (el.type === 'button' || el.type === 'submit' || el.type === 'image')) {
            return true;
        }

        return false;
    }

    async function fillDataIn(page, selectors) {
        console.info('fill in', selectors);
        for (let i = 0; i < selectors.length; i += 1) {
            await page.callFn(selector => {
                const el = document.querySelector(selector);
                if (el.name.match(/username/)) {
                    el.value = '';
                } else if (el.name.match(/password/)) {
                    el.focus();
                    const e = document.createEvent('KeyboardEvent');
                    e.initKeyboardEvent('keydown', true, true, null, 'P', 'P');
                    el.dispatchEvent(e);
                    el.value = '';
                    el.blur();
                }
            }, [selectors[i]]);
        }
    }

    async function interactWith(page, selectors) {
        console.info('interact with', selectors);
        for (let i = 0; i < selectors.length; i += 1) {
            await page.callFn(selector => {
                const el = document.querySelector(selector);

                const e = document.createEvent('MouseEvent');
                e.initMouseEvent('click', true, true);
                el.dispatchEvent(e);
            }, [selectors[i]]);
        }
    }

    function createPageInterface(tabId) {
        function eval(code) {
            return new Promise((resolve, reject) => {
                chrome.tabs.executeScript(tabId, { code }, result => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    setTimeout(() => resolve(result[0]), 1000);
                });
            });
        }

        return {
            eval,
            callFn: (fn, args) =>
                eval('(' + fn.toString() + ')(' + args.map(x => JSON.stringify(x)).join(',') + ')'),
        };
    }

    async function match(page, ctxs) {
        let matched = null;
        for (let i = 0; i < ctxs.length; i += 1) {
            if (ctxs[i].selectors.length === 0) {
                continue;
            }
            const isMatched = await matchSelection(page, ctxs[i].selectors.map(s => s.entity.selector));
            if (isMatched) {
                matched = ctxs[i];
                break;
            }
        }
        return matched;
    }

    async function matchSelection(page, listSelectors) {
        return await page.callFn(checkSelectors, [listSelectors]);
    }

    function checkSelectors(selectors) {
        return !selectors.some(s => !document.querySelector(s));
    }
};

chrome.runtime.onConnect.addListener(port => {

    const extensionListener = function(message, sender/*, sendResponse*/) {

        if (message.name === 'init' && sender.name === 'panel') {
            const { tabId } = message;
            if (!tabId) {
                return console.warn('Tab id is null', message, sender);
            }
            console.info('devtools panel for tab %s connected', tabId);
            devtoolsPanelConnections[tabId] = port;

            if (tabId in contentScriptConnections) {
                contentScriptConnections[tabId].postMessage({
                    action: 'devtoolsReady',
                    payload: true,
                });
            }

            chrome.tabs.get(tabId, tab => {
                port.postMessage({
                    action: 'pageReady',
                    payload: tab.url,
                });
            });

            return;
        }

        if (message.name === 'init' && sender.name === 'sidebar') {
            const { tabId } = message;
            if (!tabId) {
                return console.warn('Tab id is null', message, sender);
            }
            console.info('devtools sidebar for tab %s connected', tabId);
            devtoolsPanelConnections[tabId] = port;
            chrome.tabs.get(tabId, tab => {
                port.postMessage({
                    action: 'pageReady',
                    payload: tab.url,
                });
            });
            return;
        }

        if (message.name === 'init' && sender.name === 'page') {
            console.info('content script for tab %s connected', sender.sender.tab.id);
            contentScriptConnections[sender.sender.tab.id] = port;
            const tabId = sender.sender.tab.id;
            if (tabId in devtoolsPanelConnections) {
                devtoolsPanelConnections[tabId].postMessage({
                    action: 'pageReady',
                    payload: sender.sender.tab.url,
                });
                port.postMessage({ action: 'devtoolsReady', payload: true });
            }

            return;
        }

        // other message handling
    };

    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(port => {
        port.onMessage.removeListener(extensionListener);
        const connections = port.name === 'page' ? contentScriptConnections : devtoolsPanelConnections;
        console.info('Port "%s" disconnected', port.name);

        const tabs = Object.keys(connections);
        let tabId = null;
        for (let i = 0, len = tabs.length; i < len; i += 1) {
            if (connections[tabs[i]] === port) {
                tabId = tabs[i];
                delete connections[tabs[i]];
                break;
            }
        }

        if (tabId) {
            if (port.name === 'page') {
                if (tabId in devtoolsPanelConnections) {
                    devtoolsPanelConnections[tabId].postMessage({ action: 'pageReady', payload: null });
                }
            } else if (tabId in contentScriptConnections) {
                contentScriptConnections[tabId].postMessage({ action: 'devtoolsReady', payload: false });
            }
        }
    });
});

// Receive message from content script and relay to the devTools page for the
// current tab
chrome.runtime.onMessage.addListener((request, sender/*, sendResponse*/) => {
    if (!sender.tab) {
        console.warn('sender.tab not defined.');
        return;
    }

    const { id } = sender.tab;

    if (id in devtoolsPanelConnections) {
        devtoolsPanelConnections[id].postMessage(request);
    }

    if (id in devtoolsSidebarConnections) {
        devtoolsSidebarConnections[id].postMessage(request);
    }

});

