const MEGABYTE = 1024 * 1024;

const db = openDatabase(
    'automation-cloud',
    '1',
    'Automation assets database',
    5 * MEGABYTE
);

module.exports = {
    migrate,
    query,
};

async function migrate() {
    await query(`
        CREATE TABLE IF NOT EXISTS pages (
            id VARCHAR(36) UNIQUE,
            hostname VARCHAR(100),
            name VARCHAR(200)
        )
    `, []);

    await query(`
        CREATE TABLE IF NOT EXISTS selections (
            id VARCHAR(36) UNIQUE,
            pageId VARCHAR(36),
            name VARCHAR(200),
            config TEXT
        )
    `, []);

    await query(`
        CREATE TABLE IF NOT EXISTS html (
            id VARCHAR(36) UNIQUE,
            pageId VARCHAR(36),
            url VARCHAR(200),
            html TEXT
        )
    `, []);
}

function query(sql, params) {
    // console.warn('will run sql query', sql);
    return new Promise((resolve, reject) =>
        db.transaction(tx => tx.executeSql(
            sql,
            params,
            (tx, results) => resolve([].slice.call(results.rows)),
            (tx, err) => reject(err)
        ),
        nu => reject(nu))
    );
}

