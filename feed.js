const rp = require('request-promise');
const cheerio = require('cheerio');
const convert = require('xml2js');
const { parse } = require('url');

const xml2js = new convert.Parser();
const js2xml = new convert.Builder();

const RSS_URL = 'https://www.mangaupdates.com/rss';
const LIST_URL = 'https://www.mangaupdates.com/lists/public';

function collectListData(id, list) {
  return new Promise((resolve, reject) => {
    rp(LIST_URL + "/" + list + "/" + id + "/0")
      .then(html => {
        const $ = cheerio.load(html);
        const entries = $('table[id=ptable] > tbody > tr:not(:first-child)');
        const seriesList = [];
        entries.each((_, tr) => {
          const tds = $(tr).children();
          seriesList.push({
            series: tds.eq(0).text(),
            status: tds.eq(1).text()
          });
        });
        resolve(seriesList);
      })
      .catch(err => reject(err));
  });
}

function createRSS(res, seriesList) {
  return new Promise((resolve, reject) => {
    rp(RSS_URL)
      .then(xml => {
        xml2js.parseString(xml, (err, result) => {
          if (err) {
            reject(err);
          } else {
            const items = result.rss.channel[0].item;
            result.rss.channel[0].item = items.filter(item =>
              seriesList.filter(i => item.title[0].includes(i.series)).length > 0
            );
            res.setHeader('Content-Type', 'text/xml');
            resolve(js2xml.buildObject(result));
          }
        });
      })
      .catch(err => reject(err));
  });
}

module.exports = (req, res) => {
  const { query } = parse(req.url, true);
  const { id, list } = query;
  collectListData(id, list)
    .then(seriesList => createRSS(res, seriesList))
    .then(rss => res.end(rss))
    .catch(err => res.end(err))
};
