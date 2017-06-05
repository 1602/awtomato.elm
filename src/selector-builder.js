'use strict';

const uuid = require('uuid');

exports.queryAll = queryAll;
exports.getSelector = getSelector;
exports.isVisible = isVisible;
exports.getElementId = getElementId;
exports.getElementById = getElementById;
exports.withinLandingArea = withinLandingArea;

const { map, slice, findIndex } = Array.prototype;
const elementsMap = new Map();
// map <number id> -> <HTMLElement node>
const elementIdsMap = Object.create(null);


function getElementById(elementId) {
    return elementIdsMap[elementId];
}

function getElementId(node) {
    let id = elementsMap.get(node);
    if (!id) {
        id = uuid.v4();
        elementsMap.set(node, id);
        elementIdsMap[id] = node;
    }
    return id;
}

function queryAll(selector, scope) {
    let nodes = null;
    if (scope) {
        nodes = scope.querySelectorAll(':scope ' + selector);
    } else {
        nodes = document.querySelectorAll(selector);
    }

    return slice.call(nodes)
        .filter(x => !withinLandingArea(x))
        .filter(x => isVisible(x));
}


function withinLandingArea(node) {
    return node && (
        node.id === 'awtomato-landing-area' ||
        withinLandingArea(node.parentNode)
    );
}

function getSelector(node, rejectedElementIds = [], scope) {
    let rejects = rejectedElementIds.slice();
    rejectedElementIds.forEach(id => {
        getParentIds(id).forEach(parentId => {
            if (rejects.indexOf(parentId) === -1) {
                rejects.push(parentId);
            }
        });
    });
    const parentsOfNode = getParentIds(getElementId(node));
    rejects = rejects.filter(id => parentsOfNode.indexOf(id) === -1);

    return calcSelector(node);

    function calcSelector(node, subselector) {

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

        const naiveSelector = selector;
        const naiveSelectorResult = test(naiveSelector);

        if (naiveSelectorResult.length === 1) {
            return naiveSelector;
        }

        if (node.classList && node.classList.length) {
            selector += map.call(node.classList, c => '.' + CSS.escape(c)).join('');
        }

        const selectorWithClasses = selector;
        const selectorWithClassesResult = test(selectorWithClasses);

        console.warn('cls vs naive', selectorWithClassesResult.length, naiveSelectorResult.length, selectorWithClasses, naiveSelector, subselector);
        if (selectorWithClassesResult.length === naiveSelectorResult.length) {
            selector = naiveSelector;
        }

        const elementNode = node;
        node = elementNode && elementNode.parentNode;
        let lastEfficientStrictness = selector;
        let nodesCount = 0;
        let elements = [];
        let requiresCounting = false;
        if (rejects.length) {
            elements = queryAll(selector, scope);
            nodesCount = elements.length;
        }

        while (rejects.length && node && node !== document && (!scope || scope !== node)) {
            requiresCounting = true;
            if (elements.map(getElementId).some(id => rejects.includes(id))) {
                const parentSelector = calcSelector(node, selector);
                selector = parentSelector ? (parentSelector + ' > ') + selector : selector;
                node = node.parentNode;
                elements = queryAll(selector, scope);
                if (nodesCount > elements.length) {
                    nodesCount = elements.length;
                    lastEfficientStrictness = selector;
                }
            } else {
                requiresCounting = false;
                break;
            }
            // if (fragment && elementsMap.has(node) && fragment.includes(elementsMap.get(node))) {
                // break;
            // }
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

        function test(selector) {
            return queryAll(selector + (subselector ? ' > ' + subselector : ''), scope);
        }

    }

    function getParentIds(id) {
        const res = [];
        let node = getElementById(id);
        const limit = scope || document.body;
        while (node.parentNode && node.parentNode !== limit) {
            res.push(getElementId(node.parentNode));
            node = node.parentNode;
        }
        return res;
    }

}

function isVisible(node) {
    return node.offsetWidth > 0 && node.offsetHeight > 0;
}


