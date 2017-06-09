
exports.evalFn = evalFn;
exports.getExpressions = getExpressions;

function evalFn(fn, args = []) {
    const functionBody = fn.toString();
    const functionArguments = args.map(x => JSON.stringify(x)).join(',');

    return evaluate('(' + functionBody + ')(' + functionArguments + ')');

    function evaluate(code) {
        return new Promise((resolve, reject) => {
            chrome.devtools.inspectedWindow.eval(code, { useContentScriptContext: true }, (result, err) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

}

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
