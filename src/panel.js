'use strict';

/* global $0, inspect */

const db = require('./db.js');
const models = require('./models.js');
const Elm = require('./Panel.elm');
const elm = Elm.Panel.fullscreen();
const extensionId = chrome.runtime.id;

window.db = db;

db.connect();

window.models = models(db);

// Create a connection to the background page
let backgroundPageConnection = chrome.runtime.connect(extensionId, {
    name: 'panel',
});

chrome.devtools.panels.elements.onSelectionChanged.addListener(async () => {
    const payload = await callFn(() => {
        console.log('hahaha', $0);
        return window.getElementsSimilarTo($0, []);
    });
    console.log('hohoho', payload);
    elm.ports.pickedElements.send(payload);
});

function getExpressions(...exprs) {
    return new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval('[' + exprs.join(',') + ']', { useContentScriptContext: true }, (result, err) => {
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

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId,
});

backgroundPageConnection.onDisconnect.addListener(() => {
    console.info('panel: background page disconnected');
    setTimeout(() => {
        location.reload();
        backgroundPageConnection = chrome.runtime.connect(extensionId, { name: 'panel' });
    }, 1000);
});

backgroundPageConnection.onMessage.addListener(msg => {
    const { action, payload } = msg;

    if (action === 'pageReady') {
        if (payload) {
            getCurrentPage();
        } else {
            elm.ports.currentPage.send([null, []]);
        }
    } else {
        elm.ports[action].send(payload);
    }
});

window.onShown = () => elm.ports.visibilityChanges.send(true);

elm.ports.lookupWithinScope.subscribe(([selector, index = 0]) => {
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

elm.ports.queryElements.subscribe(selection => {
    chrome.devtools.inspectedWindow.eval('pickElements(' + JSON.stringify(selection) + ')', { useContentScriptContext: true }, (res, err) => { if (err) {console.error(err);}});
});

elm.ports.highlight.subscribe(([selector, index]) => {
    console.info('highlight', selector, index);
    if (selector) {
        chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); resetSelection(); highlightElement(a[index]); } else { console.log("nothing to highlight"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')', { useContentScriptContext: true },
            (res, err) => { if (err) { console.error('err', err); } });
    } else {
        chrome.devtools.inspectedWindow.eval('highlightElement(null)', { useContentScriptContext: true });
    }
});

elm.ports.resetSelection.subscribe(() => {
    chrome.devtools.inspectedWindow.eval('resetSelection()', { useContentScriptContext: true });
});

subscribe('inspect', ([selector, index]) => {
    console.info('inspecting', selector, index);
    chrome.devtools.inspectedWindow.eval('(function(aa, index) { const a = [].filter.call(aa, n => n.offsetWidth > 0); if (a.length > 0) { a[index].scrollIntoViewIfNeeded(); inspect(a[index]); } else { console.log("nothing really"); } })($$(' + JSON.stringify(selector) + '), ' + index + ')');
});

subscribe('scopedInspect', args => {
    console.info('inspecting', args);
    callFn((anchor, index, selector, parentOffset) => {
        const scope = window.setScopedLookup(anchor, index, parentOffset);
        const el = window.queryAll(selector, scope)[0];
        if (el) {
            inspect(el);
        } else {
            console.info('nothing really (scopedInspect)');
        }
    }, args);
});

subscribe('createSelection', async ([selectionId, name, pageId, selector]) => {
    await window.models.createSelection(selectionId, name, pageId, selector);
    await getCurrentPage();
});

subscribe('updateSelection', async ([selectionId, name, cssSelector]) => {
    window.models.updateSelection(selectionId, name, { cssSelector });
    await getCurrentPage();
});

subscribe('updateAttachment', async ([selectionId, attachmentId, name, cssSelector, parentOffset]) => {
    window.models.updateAttachment(selectionId, attachmentId, { name, cssSelector, parentOffset });
    await getCurrentPage();
});

subscribe('createAttachment', async ([selectionId, attachmentId, name, cssSelector, parentOffset]) => {
    const selection = await window.models.getSelection(selectionId);

    if (selection) {
        await window.models.createAttachment(selection, attachmentId, { name, cssSelector, parentOffset });
        await getCurrentPage();
    }
});

subscribe('removeSelection', async selectionId => {
    await window.models.removeSelection(selectionId);
    await getCurrentPage();
});

subscribe('removeAttachment', async ([selectionId, attachmentId]) => {
    await window.models.removeAttachment(selectionId, attachmentId);
    await getCurrentPage();
});

subscribe('getCurrentPage', getCurrentPage);

async function getCurrentPage() {
    const [host, title] = await getExpressions(
        'location.host',
        'document.title || (x => x && x.innerText)(document.querySelector("h1"))'
    );
    const pages = await window.models.getPages(host);

    let matchedPage = null;
    let matchedElements = null;
    let emptyPage = null;

    for (const ctx of pages) {
        matchedElements = await somethingMatchesIn(ctx);
        if (matchedElements) {
            matchedPage = ctx;
            break;
        }
        if (ctx.get('selections').size === 0) {
            emptyPage = ctx;
        }
    }

    if (matchedPage) {
        elm.ports.currentPage.send([
            matchedPage.toJS(),
            matchedElements,
        ]);
    } else {
        if (!emptyPage) {
            emptyPage = await window.models.createPage(host, title);
        }

        elm.ports.currentPage.send([
            emptyPage.toJS(),
            [],
        ]);
    }

    async function somethingMatchesIn(ctx) {

        const selections = ctx.get('selections');

        const [results] = await getExpressions('[' +
            selections
                .map(s => 'window.queryAll(' + JSON.stringify(s.get('cssSelector')) + ')')
                .join(', ') +
            '].map(r => r.map(el => window.makeElement(el)))');

        if (results.filter(x => x.length > 0).length === 0) {
            return null;
        }

        const matchedSelections =
            selections
                .filter((s, i) => results[i].length > 0);

        const filteredResults =
            results
                .filter(els => els.length > 0);

        const matchedSelectionIds =
            matchedSelections
                .map((s, i) => [s.get('id'), filteredResults[i]])
                .toJS();

        for (const s of matchedSelections) {
            const attachments = s.get('attachments');
            if (attachments.size > 0) {
                for (const sa of attachments) {
                    const elements = await isVisibleAttachment(
                        sa.cssSelector,
                        sa.parentOffset,
                        s.get('cssSelector'));

                    if (elements.length > 0) {
                        matchedSelectionIds.push([sa.id, elements]);
                    }
                }
            }
        }

        function isVisibleAttachment(selector, offset, parentSelector) {
            return callFn((selector, offset, parentSelector) => {
                let scope = window.queryAll(parentSelector)[0];
                if (scope) {
                    while (offset > 0 && scope.parentNode) {
                        offset += -1;
                        scope = scope.parentNode;
                    }
                    return window.queryAll(selector, scope).map(el => window.makeElement(el));
                }
            }, [selector, offset, parentSelector]);
        }

        return matchedSelectionIds;
    }

}

function callFn(fn, args = []) {
    function evl(code) {
        return new Promise((resolve, reject) => {
            chrome.devtools.inspectedWindow.eval(code, { useContentScriptContext: true }, (result, err) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    const functionBody = fn.toString();
    const functionArguments = args.map(x => JSON.stringify(x)).join(',');
    return evl('(' + functionBody + ')(' + functionArguments + ')');
}
