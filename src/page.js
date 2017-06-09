const { evalFn } = require('./inspected-window.js');

module.exports = models => {

    return {
        matchCurrentPage,
        somethingMatchesIn,
    };

    async function matchCurrentPage() {
        console.warn('about to start matching a current page');
        const [host, title] = await evalFn(() => {
            const { host } = location;
            let title = document.title;
            if (!title) {
                const heading = document.querySelector('h1,h2,h3');
                if (heading) {
                    title = heading.innerText.trim();
                }
            }

            return [host, title || 'untitled'];
        });

        const pages = await models.getPages(host);

        let matchedPage = null;
        let matchedElements = null;
        let emptyPage = null;

        for (const page of pages) {
            matchedElements = await somethingMatchesIn(page);
            if (matchedElements) {
                matchedPage = page;
                break;
            }
            if (page.get('selections').size === 0) {
                emptyPage = page;
            }
        }

        if (matchedPage) {
            return [
                matchedPage.toJS(),
                matchedElements,
            ];
        }

        if (!emptyPage) {
            emptyPage = await models.createPage(host, title);
        }

        return [
            emptyPage.toJS(),
            [],
        ];

    }

    async function somethingMatchesIn(page) {

        const selections = page.get('selections');

        const results = await evalFn(cssSelectors =>
            cssSelectors
                .map(cssSelector =>
                    window
                        .queryAll(cssSelector)
                        .map(el => window.makeElement(el))
                ),
            [selections
                .map(s => s.get('cssSelector'))
                .toJS()]
        );


        if (results.filter(x => x.length > 0).length === 0) {
            return null;
        }

        const matchedSelections =
            selections
                .filter((s, i) => results[i].length > 0);

        const filteredResults =
            results
                .filter(els => els.length > 0);

        const matchedSelectionIds =
            matchedSelections
                .map((s, i) => [s.get('id'), filteredResults[i]])
                .toJS();

        for (const s of matchedSelections) {
            const attachments = s.get('attachments');
            if (attachments.size > 0) {
                for (const sa of attachments) {
                    const elements = await isVisibleAttachment(
                        sa.cssSelector,
                        sa.parentOffset,
                        s.get('cssSelector'));

                    if (elements.length > 0) {
                        matchedSelectionIds.push([sa.id, elements]);
                    }
                }
            }
        }

        function isVisibleAttachment(selector, offset, parentSelector) {
            return evalFn((selector, offset, parentSelector) => {
                let scope = window.queryAll(parentSelector)[0];
                if (scope) {
                    while (offset > 0 && scope.parentNode) {
                        offset += -1;
                        scope = scope.parentNode;
                    }
                    return window.queryAll(selector, scope).map(el => window.makeElement(el));
                }
            }, [selector, offset, parentSelector]);
        }

        return matchedSelectionIds;
    }

};
