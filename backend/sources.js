/**
 * Source configuration for data updates
 * Defines all external sources for extremist materials and related data
 */

module.exports = {
    sources: [
        {
            id: 'mininform_materials',
            name: 'Министерство информации - Список материалов',
            pageUrl: 'http://mininform.gov.by/documents/respublikanskiy-spisok-ekstremistskikh-materialov/',
            url: 'http://mininform.gov.by/upload/iblock/002/i0lup1njj76z7ozakcjcfvtf9zd5jnxn.doc',
            type: 'doc',
            parser: 'materials',
            enabled: true
        },
        {
            id: 'mvd_lists',
            name: 'МВД - Списки',
            pageUrl: 'https://mvd.gov.by/ru/news/8642',
            url: 'https://mvd.gov.by/ru/news/8642',
            type: 'web_scrape', // Need to scrape .doc links from page
            parser: 'organizations', // and individuals
            enabled: false // Disabled until scraper implemented
        }
    ]
};
