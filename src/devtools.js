chrome.devtools.panels.elements.createSidebarPane('Selector', sidebarReady);
chrome.devtools.panels.create('My Automation', '', 'panel.html', panelReady);

const components = {};

function sidebarReady(sidebar) {
    components.sidebar = sidebar;

    sidebar.setPage('sidebar.html');

    let win = null;

    sidebar.onShown.addListener(sidebarWindow => {
        win = sidebarWindow;
        sidebarWindow.onShown(true);
    });

    sidebar.onHidden.addListener(() => {
        if (win) {
            win.onShown(false);
            win = null;
        }
    });

}

function panelReady(panel) {
    components.panel = panel;

    let win = null;

    panel.onShown.addListener(panelWindow => {
        win = panelWindow;
        panelWindow.onShown(true);
    });

    panel.onHidden.addListener(() => {
        if (win) {
            win.onShown(false);
            win = null;
        }
    });
}

