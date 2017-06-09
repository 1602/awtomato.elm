'use strict';

/* global $0, inspect */

const { makeApp } = require('./elm-utils.js');
const db = require('./db.js');
const models = require('./models.js')(db);
const panelView = makeApp(require('./Panel.elm'));
const extensionId = chrome.runtime.id;
const { analysePage } = require('./page-analyser.js');
const { evalFn } = require('./inspected-window.js');
const { matchCurrentPage } = require('./page.js')(models);

window.db = db;

db.migrate();

window.models = models;

// Create a connection to the background page
const backgroundPageConnection = chrome.runtime.connect(extensionId, {
    name: 'panel',
});

chrome.devtools.panels.elements.onSelectionChanged.addListener(async () => {
    const payload = await evalFn(() => {
        return window.getElementsSimilarTo($0, []);
    });
    panelView.send('pickedElements', payload);
});

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId,
});

backgroundPageConnection.onDisconnect.addListener(() => setTimeout(() => location.reload(), 1000));

backgroundPageConnection.onMessage.addListener(msg => {
    const { action, payload } = msg;

    if (action === 'pageReady') {
        if (payload) {
            getCurrentPage();
        } else {
            panelView.send('currentPage', [null, []]);
        }
    } else {
        panelView.send(action, payload);
    }
});

window.onShown = () => panelView.send('visibilityChanges', true);


panelView.subscribe('analysePage', async () => console.info(await evalFn(analysePage)));


panelView.subscribe('lookupWithinScope', ([selector, index = 0]) => {
    if (!selector) {
        chrome.devtools.inspectedWindow.eval('window.setScopedLookup("");',
            { useContentScriptContext: true },
            (res, err) => {if (err) { console.error(err); }});
    } else {
        chrome.devtools.inspectedWindow.eval(
            'window.setScopedLookup(' + JSON.stringify(selector) + ',' + index + ', 0);',
            { useContentScriptContext: true },
            (res, err) => {if (err) { console.error(err); }});
    }
});


panelView.subscribe('queryElements', selection => {
    chrome.devtools.inspectedWindow.eval('pickElements(' + JSON.stringify(selection) + ')', { useContentScriptContext: true }, (res, err) => { if (err) {console.error(err);}});
});


panelView.subscribe('highlight', ([selector, index]) => {
    console.info('highlight', selector, index);
    if (selector) {
        chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); resetSelection(); highlightElement(a[index]); } else { console.log("nothing to highlight"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')', { useContentScriptContext: true },
            (res, err) => { if (err) { console.error('err', err); } });
    } else {
        chrome.devtools.inspectedWindow.eval('highlightElement(null)', { useContentScriptContext: true });
    }
});

panelView.subscribe('resetSelection', () => {
    chrome.devtools.inspectedWindow.eval('resetSelection()', { useContentScriptContext: true });
});

panelView.subscribe('saveHtml', async () => {
    const [page] = await matchCurrentPage();
    const [html, url] = await evalFn(() => [document.documentElement.outerHTML, location.href], []);
    window.models.saveHtml(page.id, html, url);
});

panelView.subscribe('inspect', ([selector, index]) => {
    console.info('inspecting', selector, index);
    chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); inspect(a[index]); } else { console.log("nothing really"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')');
});

panelView.subscribe('scopedInspect', args => {
    evalFn((anchor, index, selector, parentOffset) => {
        const scope = window.setScopedLookup(anchor, index, parentOffset);
        const el = window.queryAll(selector, scope)[0];
        if (el) {
            inspect(el);
        }
    }, args);
});

panelView.subscribe('createSelection', async ([selectionId, name, pageId, selector]) => {
    await window.models.createSelection(selectionId, name, pageId, selector);
    await getCurrentPage();
});

panelView.subscribe('updateSelection', async ([selectionId, name, cssSelector]) => {
    window.models.updateSelection(selectionId, name, { cssSelector });
    await getCurrentPage();
});

panelView.subscribe('updateAttachment', async ([selectionId, attachmentId, name, cssSelector, parentOffset]) => {
    window.models.updateAttachment(selectionId, attachmentId, { name, cssSelector, parentOffset });
    await getCurrentPage();
});

panelView.subscribe('createAttachment', async ([selectionId, attachmentId, name, cssSelector, parentOffset]) => {
    const selection = await window.models.getSelection(selectionId);

    if (selection) {
        await window.models.createAttachment(selection, attachmentId, { name, cssSelector, parentOffset });
        await getCurrentPage();
    }
});

panelView.subscribe('removeSelection', async selectionId => {
    await window.models.removeSelection(selectionId);
    await getCurrentPage();
});

panelView.subscribe('removeAttachment', async ([selectionId, attachmentId]) => {
    await window.models.removeAttachment(selectionId, attachmentId);
    await getCurrentPage();
});

panelView.subscribe('getCurrentPage', getCurrentPage);

async function getCurrentPage() {
    panelView.send('currentPage', await matchCurrentPage());
}

