'use strict';

const Elm = require('./Sidebar.elm');
const elm = Elm.Sidebar.fullscreen();
const extensionId = chrome.runtime.id;

// Create a connection to the background page
let backgroundPageConnection = chrome.runtime.connect(extensionId, {
    name: 'sidebar',
});

chrome.devtools.inspectedWindow.eval('window.focus();');

chrome.devtools.panels.elements.onSelectionChanged.addListener(selectionChanged);

function selectionChanged() {
    chrome.devtools.inspectedWindow.eval('window.getElementsSimilarTo($0)', { useContentScriptContext : true }, (res, err) => {
        if (err) {
            return console.error(err);
        }
        elm.ports.pickedElements.send(res);
    });
}

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId,
});
selectionChanged();

backgroundPageConnection.onDisconnect.addListener(() => {
    console.info('sidebar: background page disconnected');
    setTimeout(() => {
        console.info('attempt to reconnect');
        backgroundPageConnection = chrome.runtime.connect(extensionId, { name: 'sidebar' });
    }, 1000);
});

backgroundPageConnection.onMessage.addListener(msg => {
    const { action, payload } = msg;

    elm.ports[action].send(payload);
});

window.onShown = () => elm.ports.visibilityChanges.send(true);

elm.ports.highlight.subscribe(([selector, index]) => {
    console.info('highlight', selector, index);
    if (selector) {
        chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); highlightElement(a[index]); } else { console.log("nothing"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')', { useContentScriptContext: true });
    } else {
        chrome.devtools.inspectedWindow.eval('highlightElement(null)', { useContentScriptContext: true });
    }
});

elm.ports.resetSelection.subscribe(() => {
    chrome.devtools.inspectedWindow.eval('resetSelection()', { useContentScriptContext: true });
});

elm.ports.inspect.subscribe(([selector, index]) => {
    console.info('inspecting', selector, index);
    chrome.devtools.inspectedWindow.eval('(function(aa) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[' + index + '].scrollIntoViewIfNeeded(); inspect(a[' + index + ']); } else { console.log("nothing"); } })($$(' + JSON.stringify(selector) + '))');
});

