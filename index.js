require('dotenv').config();

const fs = require('fs');
const MarkovChain = require('purpl-markov-chain');
const Discord = require('discord.js');
const generateMeme = require('./generateMeme');
const google = require('./google');
const Utils = require('./utils');
const Reddit = require('reddit');

let MIND_DATA = require("./mind.json");

const client = new Discord.Client();

const reddit = new Reddit({
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
  appId: process.env.REDDIT_APPID,
  appSecret: process.env.REDDIT_APPSECRET,
  userAgent: 'MyApp/1.0.0 (http://example.com)'
})

console.log(MIND_DATA.length);

const SLEEP_SCHEDULE = {
  WAKE: 23,
  SLEEP: 14
};

let botAwakeState = 2; // 0 = Sleep, 1 = Waking Up, 2 = Awake, 3 = Going to sleep

let SETTINGS = {
	TRAINING_CHANNEL_NAME: "general",
	MAX_SAVED_MESSAGES: 70000,
	MAX_MESSAGE_LENGTH: 200,
  GENERAL_ON: false,
	MIN_NEW_MESSAGES_UNTIL_REPLY: 50,
	MAX_NEW_MESSAGES_UNTIL_REPLY: 55,
	GUILD_ID: "803282468798201927",
	ADMIN_ID: "649713018887864341",
  MODE: 0,
  RETARD_LEVEL: 2
};

const USELESS_WORDS = ["i","im","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself","yourselves","he","him","his","himself","she","her","hers","herself","it","its","itself","they","them","their","theirs","themselves","what","which","who","whom","this","that","these","those","am","is","are","was","were","be","been","being","have","has","had","having","do","does","did","doing","a","an","the","and","but","if","or","because","as","until","while","of","at","by","for","with","about","against","between","into","through","during","before","after","above","below","to","from","up","down","in","out","on","off","over","under","again","further","then","once","here","there","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","s","t","can","will","just","don","should","now","could","would","wasnt","us","still","you're","dont","one","else","yet","whos","opinion","opinions", "going", "cant","on", "back","next", "then","live","is", "from", "again"];

let coolDown = {};

const rapChain = new MarkovChain();

const normalChain = new MarkovChain();
const lowerChain = new MarkovChain();

const ADMIN_COMMANDS = {
	"$clear": async (message) => {
		savedMessages = [];
		message.channel.send("**Deleted all training data**");
	},
	"$save": (message) => {
		message.channel.send("**Saved all training data**");
	},
	"$log": (message) => {
		console.log({messagesNeededUntilNextReply, messagesSinceLastReply});
		console.log(savedMessages.length, savedMessages);
		message.channel.send("**Logged.**");
	},
  "$shutdown": (message) => {
		console.log({messagesNeededUntilNextReply, messagesSinceLastReply});
		console.log(savedMessages.length, savedMessages);
		message.channel.send("**Shutting down....**");
    setTimeout(() => {
      process.exit();
    }, 7000);
	},
  "$toggle": (message) => {
    SETTINGS.GENERAL_ON = !SETTINGS.GENERAL_ON;
		message.channel.send(SETTINGS.GENERAL_ON ? "i'm ready." : "reverting...");
	},
  "fubukbot_activate_rap_battle_mode": async (message) => {
    console.log("rappin 4 jesus");
    if(SETTINGS.MODE === 1) return message.channel.send(`**RAPE** Protocol Activated. ${savedMessages.length} data points secured.`);
    
    SETTINGS.MODE = 1;
    
    let loadingMessage = await message.channel.send(`**RAPE** Protocol Activating... (0 / 5)`);
    
    savedMessages = require("./data/rap.txt").split("\n");
    await loadingMessage.edit(`**RAPE** Protocol Activating... (1 / 5)`);
    console.log("split lines");
    savedMessages = savedMessages.map(a => a.trim());
    await loadingMessage.edit(`**RAPE** Protocol Activating... (2 / 5)`);
    savedMessages = savedMessages.filter(a => a);
    await loadingMessage.edit(`**RAPE** Protocol Activating... (3 / 5)`);
    savedMessages = savedMessages.slice(0, savedMessages.length / 2);
    
    await loadingMessage.edit(`**RAPE** Protocol Activating... (4 / 5)`);
    
    savedMessages.forEach(str => {
      rapChain.update(str);
    });
    
    message.channel.send(`**RAPE** Protocol Activated. ${savedMessages.length} data points secured.`);
	},
  "fubukbot_normal_mode": async (message) => {
    let trainingData = await fetchTrainingData();

    if(trainingData){
      if(trainingData.savedMessages) savedMessages = trainingData.savedMessages;
    }
    
    SETTINGS.MODE = 0;
    
    message.channel.send("reverting...");
  },
  "fubukbot_retard_level_normal": async (message) => {
    SETTINGS.RETARD_LEVEL = 0;
    
    message.channel.send("Retard level set to normal.");
  },
  "fubukbot_retard_level_1head": async (message) => {
    SETTINGS.RETARD_LEVEL = 1;
    
    message.channel.send("Retard level set to 1Head.");
  },
  "fubukbot_retard_level_5head": async (message) => {
    SETTINGS.RETARD_LEVEL = 2;
    
    message.channel.send("Retard level set to 5Head.");
  },
  "fubukbot_retard_level_10head": async (message) => {
    SETTINGS.RETARD_LEVEL = 3;
    
    message.channel.send("Retard level set to 10Head.");
  }
};

let savedMessages = ["..."];
let messagesSinceLastReply = 0;
let messagesNeededUntilNextReply = SETTINGS.MIN_NEW_MESSAGES_UNTIL_REPLY;

let lastSource = null;

let pauseTraining = false;

let makingMeme = false;

require.extensions['.txt'] = function (module, filename) {
  module.exports = fs.readFileSync(filename, 'utf8');
  console.log("read file");
};

client.on("unhandledRejection", console.log);
// client.on('debug', console.log);

client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);

	console.log(client.guilds.cache.map(a => ({id: a.id, name: a.name})));

	client.user.setActivity('you scream in agony <3 (0 / 0)', { type: 'LISTENING' });

	const guild = await client.guilds.fetch(SETTINGS.GUILD_ID);
	const mainChannel = await guild.channels.cache.find(c => c.name === SETTINGS.TRAINING_CHANNEL_NAME);

	let trainingData = await fetchTrainingData().catch(err => {
    return null;
  });

	if(trainingData){
		if(trainingData.savedMessages) savedMessages = trainingData.savedMessages;
	} else {
    return;
  }
	setInterval(() => {
    client.user.setActivity(`you scream in agony <3 (${savedMessages.length}/${SETTINGS.MAX_SAVED_MESSAGES})`, {
      type: 'LISTENING'
    });
	}, 5000);

	savedMessages.forEach(str => {
		normalChain.update(str);
	});
  
  savedMessages.map(a => a.toLowerCase()).forEach(str => {
		lowerChain.update(str);
	});
  
  console.log("updated chains");
  
  setInterval(() => {
    if(SETTINGS.MODE !== 0) return;
		saveTrainingData();
	}, 15000);
});

client.on('message', async (msg) => {
  if(msg.author.tag == client.user.tag) return;
  
  if(!msg.guild) {
    console.log(msg.author.tag, "|", msg.content);
  } else {
    if(
      SETTINGS.GUILD_ID && 
      msg.guild.id !== SETTINGS.GUILD_ID
    ) return;
  }
  
  console.log(msg.channel.name, "|", msg.author.tag, "-", msg.content);

	pauseTraining = true;
	setTimeout(() => pauseTraining = false, 100);
  
	if(msg.author.id === SETTINGS.ADMIN_ID) {
		let commandName = msg.content.split(" ")[0];
    
		if(ADMIN_COMMANDS[commandName]) {
			ADMIN_COMMANDS[commandName](msg);

			return;
		}
	}
	
	if(
		msg.mentions.has(client.user, {
			ignoreRoles: true,
			ignoreEveryone: true
		}) || !msg.guild
	){
    if(!SETTINGS.GENERAL_ON && msg.channel.name === SETTINGS.TRAINING_CHANNEL_NAME) return;
    
    if(botAwakeState === 0) return;
    if(coolDown[msg.author.tag]) return;
    coolDown[msg.author.tag] = true;
    
    setTimeout(() => {
      delete coolDown[msg.author.tag];
    }, 3000);
    
    console.log(msg.cleanContent);
    if(!msg.cleanContent.includes("@") && msg.guild) return;

		if(msg.cleanContent.toLowerCase().trim().indexOf("meme") !== -1 && !makingMeme) {
      makingMeme = true;
			msg.channel.startTyping();
      
      let promptWord = msg.cleanContent.slice(0, 200).split(" ").slice(1).filter(a => !USELESS_WORDS.includes(a.toLowerCase()) && a !== "" && a !== "post" && a !== "meme");
      console.log(promptWord);
      promptWord = Math.random() > 0.5 ? promptWord[Math.floor(Math.random() * promptWord.length)] : promptWord[promptWord.length-1];

      if(promptWord) promptWord = promptWord.replace(/[^A-Z_\:]*/gi, "");

      console.log(promptWord);
      
      let title = await generateChatMessageAsync(compileTrainingData(), promptWord, msg.cleanContent);
      let memeTitle = await generateChatMessageAsync(compileTrainingData(), promptWord, msg.cleanContent);
			let memeData = await generateMeme(memeTitle);
			const attachment = new Discord.MessageAttachment('./meme.gif');
      
      lastSource = memeData.source;

			msg.channel.stopTyping(true);
      makingMeme = false;
      
      let memeMessage = await msg.reply(attachment);
      
      memeMessage.awaitReactions(r => r.emoji.name === '⭐', { max: 3, time: 2147483643, errors: ["time"]}).then(async (collected) => {
        let memeURL = memeMessage.attachments.first().proxyURL;
        
        console.log("posting...", memeURL);
        const res = await reddit.post('/api/submit', {
          sr: 'okbuddyhololive',
          kind: 'link',
          resubmit: true,
          title: title,
          url: memeURL
        }).catch(console.error);
        
        msg.channel.send(res.json.data.url || "...");
      }).catch(e => {
        console.log();
      });

			return;
		}
    
    if(msg.content.toLowerCase().includes("source") && msg.content.toLowerCase().includes("gif")) {
      if(!lastSource) return;
      
			msg.reply("Source: `" + lastSource + "`");
      lastSource = null;
      return;
		}
		if(savedMessages.length < 10) return;
    
    let promptWord = getPromptWord(msg.cleanContent);
    
    console.log("send");
		await sendMarkovMessageToMainChannel(msg, msg.channel.name, promptWord);
	} else if(
		msg.channel.name === SETTINGS.TRAINING_CHANNEL_NAME &&
		msg.content
	) {
    if(msg.author.bot) return;
    msg.content = msg.cleanContent.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, "");
    msg.content = cleanEmojis(msg.content).replace(/\*/g, "").replace(/\\n/g, "");
		if(msg.content.length > SETTINGS.MAX_MESSAGE_LENGTH) return;
		if(msg.content.length < 5) return;

		if(messagesSinceLastReply >= messagesNeededUntilNextReply) {
			setTimeout(async () => {
        let promptWord = getPromptWord(msg.cleanContent);
				await sendMarkovMessageToMainChannel(msg, null, promptWord);

				messagesNeededUntilNextReply = getRandomInt(
					SETTINGS.MIN_NEW_MESSAGES_UNTIL_REPLY,
					SETTINGS.MAX_NEW_MESSAGES_UNTIL_REPLY
				);
				messagesSinceLastReply = 0;

				console.log({messagesNeededUntilNextReply, messagesSinceLastReply});
        
        savedMessages.unshift(msg.content);
        savedMessages = savedMessages.slice(0, SETTINGS.MAX_SAVED_MESSAGES);
        messagesSinceLastReply++;

        normalChain.update(msg.content);
        lowerChain.update(msg.content.toLowerCase());
			}, 1000);
		} else {
      savedMessages.unshift(msg.content);
      savedMessages = savedMessages.slice(0, SETTINGS.MAX_SAVED_MESSAGES);
      messagesSinceLastReply++;

      normalChain.update(msg.content);
      lowerChain.update(msg.content.toLowerCase());
    }
	}
});

client.login(process.env.DISCORD_TOKEN);

function compileTrainingData() {
	return savedMessages.concat(MIND_DATA);
}

function fetchTrainingData(backup) {
  return new Promise((resolve, reject) => {
    fs.readFile(backup ? "./memory_backup.json" : "./memory.json", async (err, data) => {
      if(err) {
        reject(err);
        return console.log(err);
      }
      
      let jsonData = null;
      try {
        jsonData = JSON.parse(data)
      } catch (e) {
        console.error(e);
      }
      
      if(!backup && jsonData === null) jsonData = await fetchTrainingData(true).catch(e => null);
      
      resolve(jsonData || {});
    });
  });
}

function saveTrainingData() {
  return new Promise((resolve, reject) => {
    fs.writeFile("./memory.json", JSON.stringify({
      savedMessages
    }), err => {
      if(err) {
        reject(err);
        return console.log(err);
      }
      resolve();
    });
  });
}

function getPromptWord(fullPrompt) {
  let promptWord;
  if(fullPrompt !== ""){
    promptWord = fullPrompt.slice(0, 200).split(" ").slice(1).filter(a => !USELESS_WORDS.includes(a.toLowerCase()) && a !== "");
    console.log(promptWord);
    promptWord = Math.random() > 0.5 ? promptWord[Math.floor(Math.random() * promptWord.length)] : promptWord[promptWord.length-1];

    if(promptWord) promptWord = promptWord.replace(/[^A-Z_\:]*/gi, "");

    return promptWord;
  }
  
  return "";
}

async function sendMarkovMessageToMainChannel(message, channelName, prompt) {
	const channel = message.guild.channels.cache.find(ch => ch.name === (
		channelName ||
		SETTINGS.TRAINING_CHANNEL_NAME
	));
	channel.startTyping();
	await sendMarkovMessageToChannel(channel, compileTrainingData(), prompt, message.content).catch(e => console.log(e));
	setTimeout(() => channel.stopTyping(true), 10);
}

async function sendMarkovMessageToChannel(channel, trainingData, prompt, full) {
	let chatMessage = await generateChatMessageAsync(trainingData, prompt, full);

	chatMessage = replaceWithGuildEmojis(channel.guild, chatMessage);
  chatMessage = replaceWithGuildMentions(channel.guild, chatMessage);

	return channel.send(chatMessage);
}

async function generateChatMessageAsync(strings, prompt, full) {
  let newStrings = strings; // Utils.shuffle(strings);
  
  if(SETTINGS.MODE === 1) {
    return `${rapChain.generate({ from: prompt || undefined, grams: 4 }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH)}
${rapChain.generate().slice(0, SETTINGS.MAX_MESSAGE_LENGTH)}
${rapChain.generate().slice(0, SETTINGS.MAX_MESSAGE_LENGTH)}
${rapChain.generate().slice(0, SETTINGS.MAX_MESSAGE_LENGTH)}
`;
  }
  
//   console.log("training");
  
  console.log("trained");
  let generatedString = "";
  
  let gramAmount = 1;
  
  if(SETTINGS.RETARD_LEVEL === 2) gramAmount = 3;
  if(SETTINGS.RETARD_LEVEL === 3) gramAmount = 4;
  
  if(SETTINGS.RETARD_LEVEL === 0 || SETTINGS.RETARD_LEVEL === 2 || SETTINGS.RETARD_LEVEL === 3) {
    let backward = Math.random() > 0.5;
    generatedString = goodGenerate(() => normalChain.generate({ from: prompt, grams: gramAmount, backward: backward }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH), 10);
    
    if(prompt && generatedString.length > 10 && !backward) {
      if(Math.random() > 0.5) {
        generatedString = goodGenerate(() => normalChain.generate({ from: prompt, grams: gramAmount, backward: backward }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH), 10).replace(prompt, "") + " " + generatedString;
      } else {
        generatedString = generatedString.replace(prompt, "");
      }
    }
    
    if(backward && Math.random() > 0.5) {
      generatedString = generatedString + normalChain.generate({ from: prompt, grams: gramAmount }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH).replace(prompt, "");
    }

    if(full.includes("google")) {
      let message = await google(full.replace(/[^A-Z_\ ]*/gi, "").replace("google", ""));

      return message;
    }

    if((newStrings.includes(generatedString) && !generatedString.startsWith(":") && generatedString.length > 15) || !generatedString || generatedString === prompt) {
      console.log("fallback 0");

      if(!prompt) prompt = "";
      let backward = Math.random() > 0.5;
      
      generatedString = lowerChain.generate({ from: prompt.toLowerCase(), grams: gramAmount, backward: backward }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH);
      if(prompt && generatedString.length > 10 && backward) generatedString = generatedString.replace(prompt.toLowerCase(), "");
    }

    if((newStrings.includes(generatedString) && !generatedString.startsWith(":") && generatedString.length > 15) || !generatedString || generatedString === prompt) {
      console.log("fallback 1");
      generatedString = longGenerate(() => normalChain.generate({ grams: gramAmount, backward: Math.random() > 0.5 }).slice(0, SETTINGS.MAX_MESSAGE_LENGTH), 20);
    }
  } else {
    generatedString = fallBackChatMessage(newStrings);
  }

	return generatedString || "...";
};

function longGenerate(generator, tries=10) {
  let longestText = generator();
  
  for(let i = 0;i < tries;i++) {
    let text = generator();
    if(text.length > longestText.length) longestText = text;
  }
  
  return longestText;
}

function goodGenerate(generator, tries=10) {
  let longestText = generator();
  
  for(let i = 0;i < tries;i++) {
    let text = generator();
    if(!savedMessages.includes(text)) {
      longestText = text;
      return longestText;
    }
  }
  
  return longestText;
}

function fallBackChatMessage(strings) {
  console.log("fallback");
  markov.clearState();
  markov.addStates(strings);
  markov.train();
  return markov.generateRandom(SETTINGS.MAX_MESSAGE_LENGTH);
}

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min) + min);
}

function cleanEmojis(str) {
  let emojis = str.match(/<[^>]*>/g) || [];
  let newStr = str;
  emojis.forEach(emoji => {
    let emojiStripped = emoji.slice(emoji.indexOf(":"), emoji.lastIndexOf(":")+1);
    if(emojiStripped === ":") return;

    newStr = newStr.replace(emoji, emojiStripped);
  });

  return newStr;
}

function replaceWithGuildEmojis(guild, str) {
	let searchStr = str.replace(/[^a-zA-Z0-9_!@#$%^&*\(\)_\-+~";':\\<>=,.\[\]{}`|/?]*/g, "");
	let emojis = Array.from(str.matchAll(/(<a:[^ >]*>)|(<:[^ >]*>)|(:[^ :]*:)/g) || [], m => ({match: m[0], index: m.index}));

	console.log(str, emojis);
  
	emojis.forEach(emoji => {
		let emojiName = (emoji.match.match(/(:[^ :]*:)/g) || [""])[0].replace(/:/g, "").trim();

		console.log(emojiName)

		if(emojiName === "" || emoji.match.includes("<")) return;

		let emojiObject = guild.emojis.cache.find(e => (e.name || "").toLowerCase().includes(emojiName.toLowerCase()));

		if(!emojiObject) emojiObject = guild.emojis.cache.random();

		str = spliceSlice(str, emoji.index, emoji.match.length, emojiObject.toString());
	});

	return str;
}

function replaceWithGuildMentions(guild, str) {
	let mentions = str.match(/@​\w+/g) || [];
  let newStr = str;
  mentions.forEach(member => {
    let memberName = member.replace(/@​/g, "").trim();
    if(memberName === "") return;
    let memberObject = guild.members.cache.find(e => (e.nickname || e.username || "").toLowerCase().includes(memberName.toLowerCase()));

    if(!memberObject) memberObject = "";

    newStr = newStr.replace(member, memberObject.toString());
  });

  return newStr;
}

function spliceSlice(str, index, count, add) {
  // We cannot pass negative indexes directly to the 2nd slicing operation.
  if (index < 0) {
    index = str.length + index;
    if (index < 0) {
      index = 0;
    }
  }

  return str.slice(0, index) + (add || "") + str.slice(index + count);
}