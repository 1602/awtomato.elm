'use strict';

require('./index.html');

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

elm.ports.boundingRectAtPosition.subscribe(function ({x, y}) {
    elm.ports.activeElement.send(
        getElementByCoordinates(x - sourceWindow.scrollX, y - sourceWindow.scrollY)
    );
});

function makeElement(node) {
    if (!node) {
        return null;
    }
    const r = node.getBoundingClientRect();
    const el = {
        tagName: (node.tagName || '').toLowerCase(),
        classList: Array.prototype.slice.call(node.classList),
        id: node.id || null,
        elementId: getElementId(node),
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
    const { reduce, reverse } = Array.prototype;

    if (elementsFromPoint.length === 0) {
        return null;
    }

    // and we need to find element which was added by our app
    return makeElement(reduce.call(elementsFromPoint, function(result, node) {
        return result || withinLandingArea(node) ? result : node;
    }, null));

    function withinLandingArea(node) {
        return node && (
            node.id === 'awtomato-landing-area' ||
            withinLandingArea(node.parentNode)
        );
    }


    // if (within && !within.some(nodeId => isParentNode(node, elementIdsMap[nodeId]))) {
        // return;
    // }

}

