const fs = require('fs');
const pixelWidth = require('string-pixel-width');
const gm = require('gm').subClass({imageMagick: true});

const endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

const getFontSize = function(text, width, height) {
  let fontSize = 100;
  let textWidth = 0;

  while(1) {
    textWidth = pixelWidth(text, {size:fontSize, font:'open sans'});
    if( ( textWidth < (width-15)) && (fontSize < height/10) ) {
      break;
    }
    fontSize-=2;
  }

  return {fontSize:fontSize, width:textWidth};
};

module.exports = function(outputDirectory, appendedFilename){
    this.outputDirectory = './tmp';
    this.appendedFilename = '';

    this.generate = function(file, topText, bottomText){
    	return new Promise((resolve,reject) => {
    		if(!fs.existsSync(this.outputDirectory)){
    	        fs.mkdirSync(this.outputDirectory);
    	    }

    	    if(!endsWith(this.outputDirectory, '/')){
    	        this.outputDirectory = this.outputDirectory + '/';
    	    }

    	    let memefilename = file.split('/');
    	    memefilename = memefilename[memefilename.length-1];

    	    let parts = memefilename.split('.');
    	    let ext = parts.pop();
    	    parts.push(this.appendedFilename+'.'+ext);

    	    memefilename = parts.join('');

    	    topText = topText.toUpperCase();
    	    bottomText = bottomText.toUpperCase();

    	    gm(file).size((err, size) => {
				console.log(err, size);
    	        if(err){
    	            reject(err);
    	        }

    	        const width = size.width;
    	        const height = size.height;

    	        const topFontSize = getFontSize(topText, width, height);
    	        const bottomFontSize = getFontSize(bottomText, width, height);

    	        gm(file).coalesce()
    	            .font(__dirname+"/sans.ttf")
    	            .stroke("#000000")
    	            .fill('#ffffff')
    	            .fontSize(topFontSize.fontSize)
    	            .strokeWidth(1.5)
    	            .drawText(0, 15,  topText, "North")
    	            .fontSize(bottomFontSize.fontSize)
    	            .drawText(0, height-15-bottomFontSize.fontSize, bottomText, "North")
    	            .write(this.outputDirectory + memefilename, (err) => {
    	                if (err) {
    	                    reject(err);
    	                } else {
    	                    resolve(this.outputDirectory + memefilename);
    	                }
    	        });
    	    });
    	});
    };

    return this;
};