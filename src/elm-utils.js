exports.makeApp = makeApp;

function makeApp(Elm) {
    const elm = Elm.Panel.fullscreen();

    return {
        subscribe,
        send,
    };

    function subscribe(portName, handler) {
        return elm.ports[portName].subscribe(async function() {
            try {
                handler.apply(null, arguments);
            } catch (e) {
                console.error('Error in subscription to ' + portName, e);
            }
        });
    }

    function send(portName, payload) {
        return elm.ports[portName].send(payload);
    }
}


