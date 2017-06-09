const uuid = require('uuid');
const { Map, List } = require('./immutable.min.js');

module.exports = db => {

    return {
        createPage,
        updatePage,
        deletePage,
        getPages,
        createSelection,
        removeSelection,
        getSelection,
        updateSelection,
        createAttachment,
        removeAttachment,
        updateAttachment,
        saveHtml,
    };

    async function createPage(hostname, name) {
        const id = uuid.v4();
        await db.query('INSERT INTO pages VALUES (?, ?, ?)', [id, hostname, name]);
        const context = Map({ id, name, selections: List() });
        return context;
    }

    function updatePage(id, name) {
        return db.query('UPDATE pages SET name = ? WHERE id = ?', [name, id]);
    }

    async function deletePage(id) {
        await db.query('DELETE FROM pages WHERE id = ?', [id]);
        return db.query('DELETE FROM selections WHERE pageId = ?', [id]);
    }

    async function getPages(hostname) {
        const pages = await db.query('SELECT * FROM pages WHERE hostname = ?', [hostname]);
        const ids = pages.map(x => JSON.stringify(x.id)).join(',');
        const selections = await db.query('SELECT * FROM selections WHERE pageId in (' + ids + ')');
        return pages.map(c =>
            Map({
                id: c.id,
                name: c.name,
                selections: List(selections
                    .filter(s => s.pageId === c.id)
                    .map(constructSelection)
                ),
            })
        );
    }

    async function createSelection(id, name, pageId, cssSelector) {
        await db.query('INSERT OR REPLACE INTO selections VALUES (?, ?, ?, ?)',
            [id, pageId, name, JSON.stringify({ cssSelector })]);
        return Map({
            id,
            name,
            config: { cssSelector, attachments: List() },
        });
    }

    function removeSelection(id) {
        return db.query('DELETE FROM selections WHERE id = ?', [id]);
    }

    async function removeAttachment(selectionId, attachmentId) {
        const selection = await getSelection(selectionId);

        if (selection) {
            return updateSelection(selection.get('id'), selection.get('name'), Map({
                cssSelector: selection.get('cssSelector'),
                attachments: selection.get('attachments').filter(at => at.id !== attachmentId),
            }).toJS());
        }
    }

    async function getSelection(id) {
        const s = await db.query('SELECT * FROM selections WHERE id = ?', [id]);
        if (s && s[0]) {
            return constructSelection(s[0]);
        }

        return null;
    }

    async function updateSelection(id, name, config) {
        const selection = await getSelection(id);

        if (selection) {
            return db.query('UPDATE selections SET config = ?, name = ? WHERE id = ?', [
                JSON.stringify(selection.merge(config).remove('name').remove('id')),
                name,
                id,
            ]);
        }
    }

    async function updateAttachment(selectionId, attachmentId, { name, cssSelector, parentOffset }) {
        const selection = await getSelection(selectionId);

        if (selection) {
            const config = selection.remove('name').remove('id').toJS();
            config.attachments.forEach(sa => {
                if (sa.id === attachmentId) {
                    sa.name = name;
                    sa.cssSelector = cssSelector;
                    sa.parentOffset = parentOffset;
                }
            });

            return db.query('UPDATE selections SET config = ?, name = ? WHERE id = ?', [
                JSON.stringify(selection.merge(config).remove('name').remove('id')),
                selection.get('name'),
                selectionId,
            ]);
        }
    }

    function createAttachment(selection, id, { name, cssSelector, parentOffset }) {

        const att = { id, name, cssSelector, parentOffset };

        const attachments = selection.get('attachments').toJS();
        const foundAttachment = attachments.findIndex(a => a.id === id);

        if (foundAttachment > -1) {
            attachments[foundAttachment] = att;
        } else {
            attachments.push(att);
        }

        return updateSelection(
            selection.get('id'),
            selection.get('name'),
            {
                cssSelector: selection.get('cssSelector'),
                attachments,
            }
        );
    }

    function constructSelection(s) {
        const config = JSON.parse(s.config);

        const selection = Map({
            id: s.id,
            name: s.name,
            cssSelector: config.cssSelector,
            attachments: List(config.attachments || []),
        });

        return selection;
    }

    function saveHtml(pageId, html, url) {
        return db.query('INSERT INTO html (id, pageId, url, html) VALUES (?, ?, ?, ?)',
            [pageId, pageId, url, html]);
    }

};

