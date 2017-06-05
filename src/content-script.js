'use strict';

//require('./index.html');
const { slice, filter } = Array.prototype;
const extensionId = chrome && chrome.runtime && chrome.runtime.id;
const { queryAll, getSelector, withinLandingArea, getElementById, getElementId } = require('./selector-builder');

const Elm = require('./ContentScript.elm');
const sourceWindow = window;// window.opener ? window.opener : window;
// map <HTMLElement node> -> <number id>
let lastKnownMousePositionX = 0;
let lastKnownMousePositionY = 0;

// const intersects = ([col1, col2], fn) =>
   // col1.some(a => col2.some(b => fn([a, b])));


let node = document.querySelector('#awtomato-landing-area');
if (!node) {
    node = document.createElement('div');
    node.id = 'awtomato-landing-area';
    node.zIndex = 9999999999;
    document.body.appendChild(node);
}

const elm = Elm.ContentScript.embed(node);

elm.ports.boundingRectAtPosition.subscribe(({ x, y }) => {
    const e = getElementByCoordinates(x - sourceWindow.scrollX, y - sourceWindow.scrollY);
    const [scope, offset] = getCommonParent(window.lookupInScopeOf, e);

    if (scope) {
        elm.ports.scopeSet.send([makeElement(scope), offset]);
    }

    elm.ports.activeElement.send(makeElement(e));
});

elm.ports.scopeLevel.subscribe(increment => {
    let e = window.lookupInScopeOf;
    let level = window.scopeLevel = window.scopeLevel + increment;
    while (e && e.parentNode && e !== document.body && level > 0) {
        e = e.parentNode;
        level += -1;
    }
    elm.ports.scopeSet.send([makeElement(e), window.scopeLevel]);
});

window.makeElement = makeElement;
window.getElementsSimilarTo = getElementsSimilarTo;
window.pickElements = pickElements;
window.lookupInScopeOf = null;
window.scopeLevel = 0;
window.setScopedLookup = function(selector, index = 0, level = 0) {
    window.scopeLevel = level;
    if (selector) {
        window.lookupInScopeOf = queryAll(selector)[index];
    } else {
        window.lookupInScopeOf = null;
    }
    let e = window.lookupInScopeOf;
    while (e && e.parentNode && level > 0) {
        e = e.parentNode;
        level += -1;
    }
    elm.ports.scopeSet.send([makeElement(e), window.scopeLevel]);
    return e;
};
window.queryAll = queryAll;

window.highlightElement = node => elm.ports.activeElement.send(makeElement(node));

window.toggleHighlightedElement = node => {
    const rect = makeElement(node);
    if (window.wasRecentlyHighlighted === node) {
        window.wasRecentlyHighlighted = null;
        elm.ports.activeElement.send(null);
    } else {
        window.wasRecentlyHighlighted = node;
        elm.ports.activeElement.send(rect);
    }
};

window.resetSelection = function() {
    elm.ports.resetSelection.send(true);
};

elm.ports.getMousePosition.subscribe(() =>
    elm.ports.mousePosition.send(
        { x: lastKnownMousePositionX, y: lastKnownMousePositionY }
    )
);

function getCommonParent(scope, node) {
    if (!scope || !node) {
        return [];
    }

    if (isChildOf(node, scope)) {
        return [scope, 0];
    }

    const p1 = [];
    const p2 = [];

    //console.info('getting a common parent for', scope, node);

    while (scope.parentNode) {
        p1.unshift(scope.parentNode);
        scope = scope.parentNode;
    }

    while (node.parentNode) {
        p2.unshift(node.parentNode);
        node = node.parentNode;
    }

    let lastCommonParent = document.body;
    let offset = 0;
    p1.forEach((n, i) => {
        if (n === p2[i]) {
            offset += 1;
            lastCommonParent = n;
        }
    });

    //console.info('parent is', lastCommonParent);

    return [lastCommonParent, p1.length - offset + 1];
}

function getElementsSimilarTo(node, rejects) {
    if (!node) {
        return { primaryPick: 0, selector: '', parentOffset: 0, elements: [] };
    }

    const [scope, offset] = getCommonParent(window.lookupInScopeOf, node);

    const selector = getSelector(node, rejects, scope);
    const nodes = queryAll(selector, scope);
    const elements = nodes.map(makeElement);
    const primaryPick = [].indexOf.call(nodes, node);
    const parentOffset = offset || 0;
    const id = getElementId(node);

    return {
        id,
        selector,
        elements,
        primaryPick,
        parentOffset,
    };
}

function makeElement(node, selection) {
    if (!node) {
        return null;
    }
    // console.log('makeElement', node);
    const r = node.getBoundingClientRect();
    const el = {
        tagName: (node.tagName || '').toLowerCase(),
        classList: slice.call(node.classList),
        id: node.id || null,
        elementId: getElementId(node),
        distanceToTop: Math.round(r.top),
        hasChildren: node.childElementCount > 0,
        x: Math.round(r.left + sourceWindow.scrollX),
        y: Math.round(r.top + sourceWindow.scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height),
        label: getLabel(node),
        // hacky way of avoiding default configuration for data extraction
        // TODO: move default or make it official
        data: extractData(node, selection && selection.dataExtractor || { source: 'innerText' }),
        properties: extractProperties(node, selection && selection.properties),
    };
    return el;
}

function extractProperties(anchorNode, props) {
    if (!props) {
        return [];
    }

    return props.map(prop => {
        const nodes = queryAll(prop.entity.selector, getNthParent(anchorNode, prop.entity.parentOffset));
        // console.info('querying', prop.entity.selector, anchorNode, prop.entity.parentOffset);
        //if (prop.isCollection) {
            //result[prop.name] = nodes.map(e => makeElement(e, prop));
        //} else {
        const el = makeElement(nodes[0], prop);
        if (el) {
            el.name = prop.name;
        }
        return el;
        //}
    }).filter(Boolean);
}

function pickElements(selection) {
    const els = queryAll(selection.entity.selector)
        .map(el => makeElement(el, selection));
    chrome.runtime.sendMessage({ action: 'justElements', payload: els });
}

function extractData(node, dataExtractor) {
    const { source } = dataExtractor;

    return node[source] || null;
}

function getLabel(node) {
    if (node.tagName === 'BUTTON') {
        return node.innerText.trim();
    }
    if (node.tagName !== 'INPUT' && node.tagName !== 'SELECT') {
        const text = node.innerText ? node.innerText.trim() : '';
        if (text.length < 33) {
            return text;
        }
        return text.substr(0, 30) + '…';
    }
    const allLabels = document.querySelectorAll('label');
    const label = [].find.call(allLabels, label => label.control === node);
    if (label) {
        return label.innerText.trim();
    }
    if (node.placeholder) {
        return node.placeholder.trim();
    }
    if (node.name) {
        return node.name;
    }
    return null;

}

function getNthParent(node, level) {
    while (node && node.parentNode && node !== document.body && level > 0) {
        node = node.parentNode;
        level += -1;
    }
    return node;
}

function getElementByCoordinates(x, y) {
    // now we get all the elements under cursor
    let elementsFromPoint = sourceWindow.document.elementsFromPoint(x, y);

    if (elementsFromPoint.length === 0) {
        return null;
    }

    // and we need to exclude element which was added by our app
    elementsFromPoint = filter.call(elementsFromPoint, node => !withinLandingArea(node));

    // non-absolutely-positioned elements have higher priority (overlay for image on asos.com)
    // not sure if good idea
    // const nonAbsoluteElement = filteredElementsFromPoint.filter(node => sourceWindow.getComputedStyle(node, null).position !== 'absolute').shift();
    // if (nonAbsoluteElement) {
    //     return makeElement(nonAbsoluteElement);
    // }

    // return makeElement(filteredElementsFromPoint.sort((a, b) => (a.offsetHeight * a.offsetWidth) - (b.offsetHeight * b.offsetWidth))[0]);

    if (window.lookupInScopeOf) {
        // const root = getNthParent(window.lookupInScopeOf, window.scopeLevel);
        // console.log('lookup within scope', elementsFromPoint.length);
        // elementsFromPoint = elementsFromPoint.filter(el => isChildOf(el, root));
        // console.log('lookup within scope', elementsFromPoint[0]);
    }

    return elementsFromPoint[0];

    // if (within && !within.some(nodeId => isParentNode(node, elementIdsMap[nodeId]))) {
        // return;
    // }

}

function isChildOf(node, parentNode) {
    return node && (node.parentNode === parentNode || isChildOf(node.parentNode, parentNode));
}

window.addEventListener('mousemove', e => {
    lastKnownMousePositionX = e.pageX;
    lastKnownMousePositionY = e.pageY;
});

let backgroundPageConnection = null;

connectToBackgroundPage();

if (backgroundPageConnection) {

    initConnection();

    elm.ports.saveElement.subscribe(selector => {
        chrome.runtime.sendMessage({ action: 'saveElement', payload: selector });
    });

    elm.ports.pickElement.subscribe(({ elementId, rejects }) => {
        const payload = getElementsSimilarTo(getElementById(elementId), rejects);
        elm.ports.pickedElements.send(payload);
        chrome.runtime.sendMessage({ action: 'pickedElements', payload });
    });

}

function connectToBackgroundPage() {
    try {
        backgroundPageConnection = chrome.runtime.connect(extensionId, { name: 'page' });
    } catch (e) {
        console.warn('Can not connect to chrome extension', extensionId, e);
    }
}

function initConnection() {

    backgroundPageConnection.onMessage.addListener(msg => {
        const { action, payload } = msg;

        elm.ports[action].send(payload);

    });

    backgroundPageConnection.onDisconnect.addListener(() => {

        console.warn('we disconnected from background page!');
        setTimeout(() => {
            location.reload();
            console.info('attempt to reconnect');
            connectToBackgroundPage();

            if (backgroundPageConnection) {
                initConnection();
            }
        }, 1000);
    });

    backgroundPageConnection.postMessage({
        name: 'init',
    });
}

