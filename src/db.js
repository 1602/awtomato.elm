const MEGABYTE = 1024 * 1024;

const db = openDatabase(
    'automation-cloud',
    '1',
    'Automation assets database',
    5 * MEGABYTE
);

module.exports = {
    connect,
    query,
};

async function connect() {
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
}

function query(sql, params) {
    console.warn('will run sql query', sql);
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            console.info('transaction', tx);
            tx.executeSql(sql, params, (tx, results) => {
                // console.info(results);
                resolve([].slice.call(results.rows));
            }, (tx, err) => {
                console.error('hhhhhhh', tx, err);
                reject(err);
            });
        }, function(nu, haha) {
            console.warn('null data handler called', nu, haha);
            console.info('here', arguments);
            reject(nu);
        });
    });
}
