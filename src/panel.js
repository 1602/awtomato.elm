'use strict';

const Elm = require('./Panel.elm');
const elm = Elm.Panel.fullscreen();
const uuid = require('uuid');
const Immutable = require('./immutable.min.js');

// Create a connection to the background page
let backgroundPageConnection = chrome.runtime.connect({
    name: 'panel',
});

chrome.devtools.inspectedWindow.eval('window.focus();');

chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    chrome.devtools.inspectedWindow.eval('console.log($0)');
});

function getExpressions(...exprs) {
    return new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval('[' + exprs.join(',') + ']', {}, (result, err) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function subscribe(portName, handler) {
    elm.ports[portName].subscribe(async function() {
        try {
            handler.apply(null, arguments);
        } catch (e) {
            console.error('Error in subscription to ' + portName, e);
        }
    });
}

function getHostData(host) {
    const store = localStorage.store ? JSON.parse(localStorage.store) : {};
    const hostData = store.hostData || {};
    const currentHostData = hostData[host] || {};

    return Immutable.fromJS({
        host,
        selectedContext: currentHostData.selectedContext || '',
        contextName: currentHostData.contextName || '',
        contexts: currentHostData.contexts || [],
        selectors: currentHostData.selectors || [],
    });
}

function setHostData(host, data) {
    const store = localStorage.store ? JSON.parse(localStorage.store) : {};
    const hostData = store.hostData || {};
    hostData[host] = data;
    store.hostData = hostData;
    localStorage.store = JSON.stringify(store);
}

/*
function addToList(item, list, identityKey = 'id') {
    const i = list.findIndex(i => i[identityKey] === item[identityKey]);

    if (i === -1) {
        return list.push(item);
    }

    return list.set(i, item);
}

subscribe('commitContext', async context => {

    if (context.id === '') {
        context.id = uuid.v4();
    }

    const [host] = await getExpressions(['location.host']);
    const hostData = getHostData(host)
        .update('contexts', c => addToList(context, c))
        .set('selectors', Immutable.List())
        .set('contextName', '');

    setHostData(host, hostData);

    try {
        elm.ports.storeUpdated.send(hostData.toJS());
    } catch (e) {
        console.error('Will wipe store', e);
        localStorage.store = '';
    }

});
*/

subscribe('updateStore', async hostData => {
    hostData.contexts.forEach(e => {
        if (e.id === '') {
            e.id = uuid.v4();
        }
    });
    setHostData(hostData.host, hostData);
});

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId,
});

backgroundPageConnection.onDisconnect.addListener(() => {
    console.info('panel: background page disconnected');
    setTimeout(() => {
        console.info('attempt to reconnect');
        backgroundPageConnection = chrome.runtime.connect({ name: 'panel' });
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
        chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); resetSelection(); highlightElement(a[index]); } else { console.log("nothing"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')', { useContentScriptContext: true },
            (res, err) => { if (err) { console.error('err', err); } });
    } else {
        chrome.devtools.inspectedWindow.eval('highlightElement(null)', { useContentScriptContext: true });
    }
});

elm.ports.resetSelection.subscribe(() => {
    chrome.devtools.inspectedWindow.eval('resetSelection()', { useContentScriptContext: true });
});

elm.ports.inspect.subscribe(([selector, index]) => {
    console.info('inspecting', selector, index);
    chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); inspect(a[index]); } else { console.log("nothing"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')');
});

subscribe('loadData', async () => {
    const [host, title] = await getExpressions('location.host', 'document.title');
    const hostData = getHostData(host)
        .update('contextName', t => t || title);

    const [visibility] = await getExpressions('[' +
        hostData
            .get('selectors')
            .map(s => 'document.querySelector(' + JSON.stringify(s.selector) + ')')
            .join(', ') +
        '].map(r => r !== null)');

    try {
        elm.ports.storeUpdated.send(hostData
            .update('selectors', s => s.filter((s, i) => visibility[i]))
            .toJS()
        );
    } catch (e) {
        console.error('Will wipe store', e);
        localStorage.store = '';
    }
});

