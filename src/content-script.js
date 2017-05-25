'use strict';

//require('./index.html');
const { map, slice, findIndex, filter } = Array.prototype;

const Elm = require('./ContentScript.elm');
const sourceWindow = window;// window.opener ? window.opener : window;
// map <HTMLElement node> -> <number id>
const elementsMap = new Map();
// map <number id> -> <HTMLElement node>
const elementIdsMap = Object.create(null);

let nextNodeId = 1;
let lastKnownMousePositionX = 0;
let lastKnownMousePositionY = 0;

// const intersects = ([col1, col2], fn) =>
   // col1.some(a => col2.some(b => fn([a, b])));

function getElementId(node) {
    let id = elementsMap.get(node);
    if (!id) {
        id = nextNodeId;
        nextNodeId += 1;
        elementsMap.set(node, id);
        elementIdsMap[id] = node;
    }
    return id;
}

let node = document.querySelector('#awtomato-landing-area');
if (!node) {
    node = document.createElement('div');
    node.id = 'awtomato-landing-area';
    node.zIndex = 9999999999;
    document.body.appendChild(node);
}

const elm = Elm.ContentScript.embed(node);

elm.ports.boundingRectAtPosition.subscribe(({ x, y }) =>
    elm.ports.activeElement.send(
        getElementByCoordinates(x - sourceWindow.scrollX, y - sourceWindow.scrollY)
    )
);

window.getElementsSimilarTo = getElementsSimilarTo;
window.pickElements = pickElements;

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

function getElementsSimilarTo(node, rejects) {
    if (!node) {
        return { primaryPick: 0, selector: '', elements: [] };
    }

    const selector = getSelector(node, rejects);
    const nodes = queryAll(selector);
    const elements = nodes.map(makeElement);
    const primaryPick = [].indexOf.call(nodes, node);

    return {
        selector,
        elements,
        primaryPick,
    };
}

function getSelector(node, rejects = [], fragment = null) {
    let selector = node.tagName;

    if (node.id && !node.id.match(/\d/)) {
        selector += '#' + CSS.escape(node.id);
    }

    if (node.name) {
        selector += '[name="' + CSS.escape(node.name) + '"]';
    }

    if (node.tagName === 'LABEL' && node.htmlFor) {
        selector += '[for="' + CSS.escape(node.htmlFor) + '"]';
    }

    if (queryAll(selector, fragment).length === 1) {
        return selector;
    }

    if (node.classList.length) {
        selector += map.call(node.classList, c => '.' + CSS.escape(c)).join('');
    }

    const elementNode = node;
    node = elementNode && elementNode.parentNode;
    let lastEfficientStrictness = selector;
    let nodesCount = 0;
    let elements = [];
    let requiresCounting = false;
    if (rejects.length) {
        elements = queryAll(selector, fragment);
        nodesCount = elements.length;
    }

    while (rejects.length && node && node.tagName !== 'HTML') {
        requiresCounting = true;
        if (elements.map(getElementId).some(id => rejects.includes(id))) {
            const parentSelector = getSelector(node, [], fragment);
            selector = parentSelector ? (parentSelector + ' > ') + selector : selector;
            node = node.parentNode;
            elements = queryAll(selector, fragment);
            if (nodesCount > elements.length) {
                nodesCount = elements.length;
                lastEfficientStrictness = selector;
            }
        } else {
            requiresCounting = false;
            break;
        }
        if (fragment && elementsMap.has(node) && fragment.includes(elementsMap.get(node))) {
            break;
        }
    }

    if (requiresCounting) {
        let head = lastEfficientStrictness.split(' > ');
        let tail = head.pop();
        head = head.join(' > ');
        const parent = elementNode.parentNode;
        const res = parent.children;
        const index = findIndex.call(res, n => n === elementNode);
        if (index > -1) {
            tail += ':nth-child(' + (index + 1) + ')';
        }
        lastEfficientStrictness = [head, tail].filter(Boolean).join(' > ');
    }

    return lastEfficientStrictness;

}

function queryAll(selector) {
    return slice.call(sourceWindow.document.querySelectorAll(selector))
        .filter(x => !withinLandingArea(x))
        .filter(x => isVisible(x));
}

function makeElement(node, dataExtractor) {
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
        data: dataExtractor ? extractData(node, dataExtractor) : null,
    };
    return el;
}

function beginScopedLookup(selector, index) {

}

function pickElements(selector, dataExtractor) {
    const els = queryAll(selector)
        .map(el => makeElement(el, dataExtractor));
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
        const text = node.innerText.trim();
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
    return null;

}

function getElementByCoordinates(x, y) {
    // now we get all the elements under cursor
    const elementsFromPoint = sourceWindow.document.elementsFromPoint(x, y);

    if (elementsFromPoint.length === 0) {
        return null;
    }

    // and we need to exclude element which was added by our app
    const filteredElementsFromPoint = filter.call(elementsFromPoint, node => !withinLandingArea(node));

    // non-absolutely-positioned elements have higher priority (overlay for image on asos.com)
    // not sure if good idea
    // const nonAbsoluteElement = filteredElementsFromPoint.filter(node => sourceWindow.getComputedStyle(node, null).position !== 'absolute').shift();
    // if (nonAbsoluteElement) {
    //     return makeElement(nonAbsoluteElement);
    // }

    // return makeElement(filteredElementsFromPoint.sort((a, b) => (a.offsetHeight * a.offsetWidth) - (b.offsetHeight * b.offsetWidth))[0]);

    return makeElement(filteredElementsFromPoint[0]);


    // if (within && !within.some(nodeId => isParentNode(node, elementIdsMap[nodeId]))) {
        // return;
    // }

}

function withinLandingArea(node) {
    return node && (
        node.id === 'awtomato-landing-area' ||
        withinLandingArea(node.parentNode)
    );
}

function isVisible(node) {
    return node.offsetWidth > 0 && node.offsetHeight > 0;
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
        const payload = getElementsSimilarTo(elementIdsMap[elementId], rejects);
        elm.ports.pickedElements.send(payload);
        chrome.runtime.sendMessage({ action: 'pickedElements', payload });
    });

}

function connectToBackgroundPage() {
    try {
        backgroundPageConnection = chrome.runtime.connect({ name: 'page' });
    } catch (e) {
        console.warn('Can not connect to chrome extension', e);
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

