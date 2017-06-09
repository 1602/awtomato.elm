/* global $0 */

exports.analysePage = analysePage;

function analysePage() {
    let nodesCount = 0, proxiesCount = 0, prunesCount = 0, finalNodesCount = 0,
        finalDataCount = 0;

    const types = [
        { 'Price': [], '*Price': [], 'Time': [], '*Time': [], 'Int': [], '*Int': [], 'Float': [], '*Float': [], 'Currency': [], '*Currency': [] },
        {},
        {},
        {},
        {},
    ];

    /*
    const conversions = {
        '(Currency-Float)': 'Price',
        '(Float-Currency)': 'Price',
    };
    */

    class Price {
        constructor(value, currency) {
            this.value = value;
            this.currency = currency;
        }
    }

    class Currency {
        toString() {
            return this.code;
        }
    }

    /*
    class Airport {
        constructor(code) {
            this.code = code;
        }

        toString() {
            return this.code;
        }
    }
    */

    const Currencies = {
        Gbp: new (class Gbp extends Currency { get code() { return 'GBP'; } }),
        Usd: new (class Usd extends Currency { get code() { return 'USD'; } }),
        Eur: new (class Eur extends Currency { get code() { return 'EUR'; } }),
    };


    const tree = analyseNode($0 || document.body, 0);
    console.info('raw', tree);

    const pruned = inferCompexTypes(pruneProxies(pruneNodesWithNoData(tree)));

    walkTree(pruned);

    //const pruned = pruneNodesWithNoNumbers(tree);

    console.info('pruned', pruned);
    console.info(`
        initial nodes count     ${ nodesCount }
        pruned non-data leaves  ${ prunesCount }
        pruned proxies count    ${ proxiesCount }
        final nodes count       ${ finalNodesCount }
        data leaves count       ${ finalDataCount }
    `);

    function getMax(obj) {
        return obj[Object.keys(obj).sort((a, b) => {
            return obj[a].length - obj[b].length;
        }).pop()] || [];
    }

    function flatten(arr) {
        return arr.reduce((flat, toFlatten) => {
            return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
        }, []);
    }

    console.warn('types', types);

    const collection2 = getMax(types[2]).map(flatten);
    console.warn('c2', collection2);

    const collection3 = getMax(types[3]).map(flatten);
    console.warn('c3', collection3);

    const collection4 = getMax(types[4]).map(flatten);
    console.warn('c4', collection4);

    // console.info(JSON.stringify(max, null, '  '));

    function inferCompexTypes(node) {
        if (!node) {
            return null;
        }

        if (node.type === 'Node' && node.data.length) {
            node.data = node.data.map(inferCompexTypes).filter(Boolean);
            if (node.data.every(n => n.type !== 'Node')) {
                const [type, value] = makeCompexType(node.data);
                if (type) {
                    node.type = type;
                    node.value = value;
                }
            }
        }

        return node;
    }

    function allOfSameType(dataNodes) {
        if (dataNodes.length === 0) {
            return false;
        }

        const { type } = dataNodes[0];

        return dataNodes.every(dn => dn.type === type);
    }

    function calcTypename(dataNodes, registryLevel) {
        let typename = '', level = registryLevel;
        let value = dataNodes.map(n => n.value);


        if (allOfSameType(dataNodes)) {
            typename = '*' + dataNodes[0].type;
            level += -1;
        } else if (dataNodes.length > 1 && dataNodes[1].type === 'Price' && allOfSameType(dataNodes.slice(1))) {
            typename = '(' + dataNodes[0].type + '-*' + dataNodes[1].type + ')';
            value = [value[0], value.slice(1)];
        } else {
            typename = '(' + dataNodes.map(n => n.type).join('-') + ')';
        }

        if (typename === '(Float-Currency)') {
            typename = 'Price';
            value = new Price(value[0], value[1]);
        } else if (typename === '(Currency-Float)') {
            typename = 'Price';
            value = new Price(value[1], value[0]);
        } else if (typename === '(Float-Price)' && value[0] === value[1].value) {
            typename = 'Price';
            value = value[1];
        } else if (typename === '*Price' && value.length === 2 && value[0].value === value[1].value) {
            value = value[0];
            typename = 'Price';
            level += 1;
        }

        if (!(typename in types[registryLevel])) {
            types[level][typename] = [];
        }

        types[level][typename].push(value);

        return [typename, value, level];
    }

    function makeCompexType(dataNodes) {
        if (dataNodes.every(n => n.type in types[0])) {
            return calcTypename(dataNodes, 1);

        } else if (dataNodes.every(n => (n.type in types[0]) || (n.type in types[1]))) {
            return calcTypename(dataNodes, 2);

        } else if (dataNodes.every(n => (n.type in types[0]) || (n.type in types[1]) || (n.type in types[2]))) {
            return calcTypename(dataNodes, 3);

        } else if (dataNodes.every(n => (n.type in types[0]) || (n.type in types[1]) || (n.type in types[2]) || (n.type in types[3]))) {
            return calcTypename(dataNodes, 4);
        }

        return [];
    }

    function walkTree(node) {
        if (!node) {
            return;
        }

        if (node.type === 'Node') {
            finalNodesCount += 1;
            node.data.forEach(walkTree);
        } else {
            finalDataCount += 1;
        }
    }

    function pruneProxies(node) {
        if (!node) {
            return null;
        }

        if (node.type === 'Node') {
            if (node.data.length === 1) {
                proxiesCount += 1;
                return pruneProxies(node.data[0]);
            }

            node.data = node.data.map(pruneProxies).filter(Boolean);
        }

        return node;
    }

    function pruneNodesWithNoData(node) {
        if (node.type !== 'Node') {
            return node;
        }

        if (node.data) {
            node.data = node.data.map(n => pruneNodesWithNoData(n)).filter(Boolean);
        }

        if (node.hasData || (node.data && node.data.length)) {
            return node;
        }

        prunesCount += 1;

        return null;
    }

    function pruneNodesWithNoNumbers(node) {
        if (node.type !== 'Node') {
            return node;
        }

        if (node.data) {
            node.data = node.data.map(n => pruneNodesWithNoNumbers(n)).filter(Boolean);
        }

        if (node.data && node.data.length && node.data.some(n => n.type === 'Node' || n.type === 'Int')) {
            return node;
        }

        return null;
    }
    pruneNodesWithNoNumbers;


    function analyseNode(node) {
        const time = /^[012]\d:[0-5]\d$/;
        const gbpPrice = /^£(\d+)$/;
        const { tagName } = node;
        const result = {
            type: 'Node',
            hasData: false,
            data: [],
        };

        if (tagName === 'SCRIPT' || tagName === 'STYLE' || node.childNodes.length === 0) {
            return;
        }

        for (const n of node.childNodes) {
            if (n.nodeType === 3) {
                const val = n.nodeValue.trim();
                if (val) {
                    let hasData = true;
                    if (val.match(/^(:?^|\s)(?=.)((?:0|(?:[1-9](?:\d*|\d{0,2}(?:,\d{3})*)))?)(?!\S)$/)) {
                        result.data.push({
                            type: 'Int',
                            node: n,
                            value: parseInt(val.replace(/,/g, ''), 10),
                        });
                    } else if (val.match(/^(:?^|\s)(?=.)((?:0|(?:[1-9](?:\d*|\d{0,2}(?:,\d{3})*)))?(?:\.\d*)?)(?!\S)$/)) {
                        result.data.push({
                            type: 'Float',
                            node: n,
                            value: parseFloat(val.replace(/,/g, '')),
                        });
                    } else if (val === 'GBP' || val === '£') {
                        result.data.push({
                            type: 'Currency',
                            node: n,
                            value: Currencies.Gbp,
                        });
                    } else if (val === 'EUR' || val === '€') {
                        result.data.push({
                            type: 'Currency',
                            node: n,
                            value: Currencies.Eur,
                        });
                    } else if (val === 'USD' || val === '$') {
                        result.data.push({
                            type: 'Currency',
                            node: n,
                            value: Currencies.Usd,
                        });
                    } else if (val.match(time)) {
                        result.data.push({
                            type: 'Time',
                            node: n,
                            value: val,
                        });
                    } else if (val.match(gbpPrice)) {
                        // console.debug('matched price', val);
                        const [, value] = val.match(gbpPrice);
                        result.data.push({
                            type: 'Price',
                            node: n,
                            value: new Price(value, Currencies.Gbp),
                        });
                    } else {
                        hasData = false;
                    }

                    result.hasData = hasData;

                }
            } else {
                const childNode = analyseNode(n);
                if (childNode) {
                    result.data.push(childNode);
                }
            }
        }

        nodesCount += 1;

        return result;
    }

}