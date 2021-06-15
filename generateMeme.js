const gifmeme = require('./gifmeme')();
const fs = require('fs');
const fetch = require('node-fetch');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function generateMeme(text) {
	let randomNumber = Math.floor(Math.random() * 150) + 1;
	let json = await fetch(`https://g.tenor.com/v1/search?q=hololive&key=${process.env.TENOR_API_KEY}&pos=${randomNumber}&limit=1&media_filter=minimal`).then(a => a.json());
//   console.log(json.results);
  if(!json.results[0]) return {source: ""};
	let gifURL = json.results[0].media[0].gif.url;
  
  let topText = text.slice(0, 20);
  let bottomText = text.slice(20, 40);

  await downloadFile(gifURL, "./temp.gif").catch(console.error);
  await exec("gifsicle ./temp.gif --resize-fit 350x350 --colors 256 -o ./temp.gif").catch(console.error);
	await gifmeme.generate('./temp.gif', topText, bottomText).catch(console.error);
  await exec("mogrify -layers 'optimize' -fuzz 7% ./tmp/temp.gif").catch(console.error);
  await exec("gifsicle ./tmp/temp.gif --colors 128 -o meme.gif").catch(console.error);

	return {
		source: json.results[0].url
	};
}

const downloadFile = (async (url, path) => {
	const res = await fetch(url);
	const fileStream = fs.createWriteStream(path);
	await new Promise((resolve, reject) => {
		res.body.pipe(fileStream);
		res.body.on("error", reject);
		fileStream.on("finish", resolve);
	});
});

module.exports = generateMeme;