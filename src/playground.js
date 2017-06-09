const {
    getSelector, getElementId, queryAll, getElementById,
} = require('./selector-builder.js');

const { analysePage } = require('./page-analyser.js');

getSelector;
queryAll;

const pageId = location.search && location.search.substr(1);

const db = require('./db.js');

(async () => {
    const page = await db.query('SELECT * FROM html WHERE id = ?', [pageId]);
    if (page.length) {
        document.write(page[0].html);
        const base = document.createElement('base');
        base.href = page[0].url;
        document.head.appendChild(base);
    }
})();

window.analysePage = analysePage;

const pads = {};

function pad(n) {
    if (!(n in pads)) {
        pads[n] = '  '.repeat(n);
    }
    return pads[n];
}

pad;

/*
const s1 = span({ innerHTML: 's1' });
const s2 = span({ innerHTML: 's2' });
const s3 = span({ innerHTML: 's3' });
const s4 = span({ innerHTML: 's4' });
const li1 = li({}, [s1]);
const li2 = li({}, [s2]);
const li3 = li({}, [s3]);
const li4 = li({}, [s4]);

document.body.appendChild(ul({ className: 'just-list' }, [li1, li2]));
document.body.appendChild(ul({ className: 'just-list' }, [li3, li4]));
document.body.appendChild(ul({ className: 'another-list' }, [li({}, [span({ innerHTML: 'hello' })])]));

const selector = getSelector(s1, [getElementId(s4), getElementId(s2)]);
const els = queryAll(selector);
console.info(JSON.stringify(selector), els, els.map(e => e.innerText));

function li(props, childNodes) {
    return tag('li', props, childNodes);
}

function ul(props, childNodes) {
    return tag('ul', props, childNodes);
}

function span(props, childNodes) {
    return tag('span', props, childNodes);
}

function tag(name, props = {}, childNodes = []) {
    const el = document.createElement(name);
    Object.keys(props).forEach(k => el[k] = props[k]);
    childNodes.forEach(node => el.appendChild(node));
    return el;
}
*/

window.getElementById = getElementById;
window.getElementId = getElementId;

