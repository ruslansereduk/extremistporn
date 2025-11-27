/**
 * Source configuration for data updates
 * Defines all external sources for extremist materials and related data
 */

module.exports = {
    sources: [
        {
            id: 'mininform_materials',
            name: 'Министерство информации - Список материалов',
            url: 'http://mininform.gov.by/upload/iblock/446/r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc',
            type: 'doc',
            parser: 'materials',
            enabled: true
        },
        {
            id: 'mvd_organizations',
            name: 'МВД - Организации',
            url: 'https://mvd.gov.by/ru/page/o-merah-protivodejstviya-ekstremizmu-i-reabilitacii-nacizma',
            type: 'web_scrape', // Need to scrape .doc links from page
            parser: 'organizations',
            enabled: true,
            linkPattern: /Перечень организаций.*\.doc/i
        },
        {
            id: 'mvd_individuals_citizens',
            name: 'МВД - Граждане РБ',
            url: 'https://mvd.gov.by/ru/page/o-merah-protivodejstviya-ekstremizmu-i-reabilitacii-nacizma',
            type: 'web_scrape',
            parser: 'individuals',
            category: 'citizen',
            enabled: true,
            linkPattern: /Перечень граждан.*Часть [1-3].*\.doc/i
        },
        {
            id: 'mvd_individuals_foreign',
            name: 'МВД - Иностранцы',
            url: 'https://mvd.gov.by/ru/page/o-merah-protivodejstviya-ekstremizmu-i-reabilitacii-nacizma',
            type: 'web_scrape',
            parser: 'individuals',
            category: 'foreign',
            enabled: true,
            linkPattern: /Перечень граждан.*Часть 4.*\.doc/i
        }
    ]
};
