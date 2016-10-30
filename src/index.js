'use strict';

require('./index.html');
const { reduce, map, slice, findIndex } = Array.prototype;

const Elm = require('./Main');
const sourceWindow = window.opener ? window.opener : window;
// map <HTMLElement node> -> <number id>
const elementsMap = new Map();
// map <number id> -> <HTMLElement node>
const elementIdsMap = Object.create(null);

let nextNodeId = 1;

const intersects = ([col1, col2], fn) =>
   col1.some(a => col2.some(b => fn([a, b])));

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
    node.zIndex = 1000000;
    document.body.appendChild(node);
}

const elm = Elm.Main.embed(node);

elm.ports.boundingRectAtPosition.subscribe(({x, y}) =>
    elm.ports.activeElement.send(
        getElementByCoordinates(x - sourceWindow.scrollX, y - sourceWindow.scrollY)
    )
);

elm.ports.pickElement.subscribe(({ elementId, rejects }) =>
    elm.ports.pickedElements.send(
        getElementsSimilarTo(elementIdsMap[elementId], rejects)
    )
);

elm.ports.getMousePosition.subscribe(() =>
    elm.ports.mousePosition.send(
        { x: lastKnownMousePositionX, y: lastKnownMousePositionY }
    )
);

function getElementsSimilarTo(node, rejects) {
    if (!node) {
        return { selector: "", elements: [] };
    }

    const selector = getSelector(node, rejects);
    const elements = queryAll(selector).map(makeElement);

    return {
        selector,
        elements
    };
}

function getSelector(node, rejects = [], fragment = null) {
    let selector = node.tagName;

    if (node.id) {
        // selector += '#' + node.id;
    }

    if (node.classList.length) {
        selector += map.call(node.classList, c => '.' + c).join('')
    }


    const elementNode = node;
    node = elementNode && elementNode.parentNode;
    let lastEfficientStrictness = selector;
    let nodesCount;
    let elements;
    let requiresCounting = false;
    if (rejects.length) {
        elements = queryAll(selector, fragment);
        nodesCount = elements.length;
    }

    console.log(rejects);
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
        .filter(x => !withinLandingArea(x));
}

function makeElement(node) {
    if (!node) {
        return null;
    }
    const r = node.getBoundingClientRect();
    const el = {
        tagName: (node.tagName || '').toLowerCase(),
        classList: slice.call(node.classList),
        id: node.id || null,
        elementId: getElementId(node),
        distanceToTop: Math.round(r.top),
        x: Math.round(r.left + sourceWindow.scrollX),
        y: Math.round(r.top + sourceWindow.scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height)
    };
    return el;
}

function getElementByCoordinates(x, y) {
    // now we get all the elements under cursor
    const elementsFromPoint = sourceWindow.document.elementsFromPoint(x, y);

    if (elementsFromPoint.length === 0) {
        return null;
    }

    // and we need to find element which was added by our app
    return makeElement(reduce.call(elementsFromPoint, function(result, node) {
        return result || withinLandingArea(node) ? result : node;
    }, null));



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

let lastKnownMousePositionX = 0;
let lastKnownMousePositionY = 0;

window.addEventListener('mousemove', e => {
    lastKnownMousePositionX = e.pageX;
    lastKnownMousePositionY = e.pageY;
});

