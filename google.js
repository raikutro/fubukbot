const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

async function google(query) {
  let queryText = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&rlz=1C1GCEU_enUS938US938&aqs=chrome..69i57.3358j0j1&sourceid=chrome&ie=UTF-8`).then(a => a.text());
  let $ = cheerio.load(queryText);
  
  let link = $(".kCrYT").eq(1).find("a").attr("href").trim().split("&sa=U")[0].replace("/url?q=", "");
  let htmlText = await fetch(decodeURIComponent(link)).then(a => a.text());
  
  $ = cheerio.load(htmlText);
  
  let answer = $("meta[name='twitter:description']").attr("content") || $("meta[name='og:description']").attr("content") || "...";
  
  console.log(decodeURIComponent(link));
  
  fs.writeFile("some.html", htmlText, console.log);
  
  return answer;
}

module.exports = google;