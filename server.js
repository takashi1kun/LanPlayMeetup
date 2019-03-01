const express = require('express');
const app = express();
const mongoose = require('mongoose');
const dbUrl = process.env.MONGODB_URI
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const crypto = require('crypto');
var fs = require('fs');
var getIp = require('ipware')().get_ip;
const ioServer = require('socket.io')
var io = new ioServer()
io.attach(http)
var gameList = require('./games.json');
for (var i32 = 0; i32 < gameList.length; i32++) {
	gameList[i32].PlayerList = []
	gameList[i32].Players = function() {
		return this.PlayerList.length
	}
	gameList[i32].findPlayer = function(ipAdress) {
		return this.PlayerList.find( (findIp) => findIp.ip === ipAdress);
	}
	gameList[i32].findPlayerIndex = function(ipAdress) {
		return this.PlayerList.findIndex( (findIp) => findIp.ip === ipAdress);
	}
	gameList[i32].addPlayer = function(ipAdress) {
		this.PlayerList.push(new PlayerObjectGen(ipAdress, this.ID))
	}
	gameList[i32].removePlayer = function(ipAdress) {
		this.PlayerList.splice(this.findPlayerIndex(ipAdress))
	}
	gameList[i32].checkTimer = function(ipAdress) {
		return (this.findPlayer(ipAdress)).timer
	}
	gameList[i32].isTimeEnd = function(ipAdress) {
		return (this.findPlayer(ipAdress)).isTimeEnd()
	}
	gameList[i32].resetTimer = function(ipAdress) {
		(this.findPlayer(ipAdress)).resetTimer()
	}
	gameList[i32].img1 = function() {
		return "/img/img1/"+this.ID+".jpg"
	}
	gameList[i32].img2 = function() {
		return "/img/img2/"+this.ID+".jpg"
	}
	gameList[i32].ipAdresses = function() {
		var returnValue = []
		for (var i=0; i<this.PlayerList.length; i++) {
			returnValue[i] = this.PlayerList[i].ip
		}
		return returnValue
	}
	gameList[i32].checkTimers = function() {
		var ipAdresses = this.ipAdresses()
		var returnValue = []
		for (var i = 0; i<ipAdresses; i++) {
			returnValue[i] = {}
			returnValue[i].ip = ipAdresses[i]
			returnValue[i].timer = this.checkTimer(ipAdresses[i])
		}
		return returnValue
	}
}
var gameListIpList = function() {
	var returnValue = []
	for (var i = 0; i<gameList.length; i++) {
		returnValue = returnValue.concat(gameList[i].ipAdresses())
	}
	return returnValue
}
var checkNonExistingIp = function(ip) {
	var arr = gameListIpList()
	return ((arr.findIndex( (index) => index === ip)==-1)?true:false)
}

var findGameInListIndex = function(id) {
	return gameList.findIndex( (findId) => findId.ID === id);
}

var findGameInList = function(id) {
	return gameList.find( (findId) => findId.ID === id);
}

var addPlayer = function(ip, game) {
	var gameId = findGameInListIndex(game)
	gameList[gameId].addPlayer(ip)
}

var removePlayer = function(ip) {
	for (var i = 0; i<gameList.length; i++) {
		var playerIndex = gameList[i].findPlayerIndex(ip)
		if (playerIndex != -1) {
			gameList[i].removePlayer(ip)
		}
	}
}

var resetTimer = function(ip) {
	for (var i = 0; i<gameList.length; i++) {
		var playerIndex = gameList[i].findPlayerIndex(ip)
		if (playerIndex != -1) {
			gameList[i].PlayerList[playerIndex].resetTimer()
		}
	}
}

var checkGameExist = function(game) {
	var switch1 = false
	for (var i = 0; i<gameList.length; i++) {
		if (gameList[i].ID == game) {
			switch1 = true
		}
	}
	return switch1
}

var administratorIP = []


var getGameIdByIpAdress = function(ipAdress) {
	var gameId = -1
	for (var i = 0; i<gameList.length; i++) {
		if (gameList[i].PlayerList.findIndex( (findIp) => findIp.ip === ipAdress) !=-1) {
			gameId = i
		}
	}
	return gameId
}

const loopInterval = 5000;

var timerFunction = function() {
	if (administratorIP.length > 0) {
		for (var i3 = 0; i3<administratorIP.length; i3++) {
			administratorIP[i3].timer = administratorIP[i3].timer-loopInterval
			if (administratorIP[i3].timer == 0) {
				administratorIP.splice(i3)
			}
		}
	}
	for (var i = 0; i<gameList.length; i++) {
		var ipAdresses = gameList[i].ipAdresses()
		if (ipAdresses.length > 0) {
			for (var i2 = 0; i2<ipAdresses.length; i2++) {
				if (gameList[i].PlayerList[gameList[i].findPlayerIndex(ipAdresses[i2])] != undefined) {
					var time = gameList[i].PlayerList[gameList[i].findPlayerIndex(ipAdresses[i2])].timer
					if (time > loopInterval) {
						gameList[i].PlayerList[gameList[i].findPlayerIndex(ipAdresses[i2])].timer = time-loopInterval
					} else {
						gameList[i].removePlayer(ipAdresses[i2])
					}
				}
			}
		}
	}
}

var generatePlayers = function() {
	var returnValue = []
	for (var i = 0; i<gameList.length; i++) {
		returnValue[i] = {}
		returnValue[i].ID = gameList[i].ID
		returnValue[i].number = gameList[i].Players()
	}
	return returnValue
}

var timerLoop = function() {
	timerFunction()
	io.emit('players', generatePlayers());
}
setInterval(timerLoop, loopInterval)
var PlayerObjectGen = function(ip, game) {
	this.ip = ip;
	this.game = game;
	this.timer = 600000;
	this.isTimeEnd = function() {
		return ((this.timer == 0)?true:false)
	};
	this.resetTimer = function() {
		this.timer = 600000
	};
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/', express.static(__dirname + '/public'));

if (fs.existsSync('userNames.json')) {
  usersArray = require('userNames.json');
} else {
  usersArray = [];
  fs.writeFile( 'usersNames.json', JSON.stringify(usersArray), 'utf8', function(err) {
    if (err) throw err;
    console.log('complete');
  });
};

var Message = mongoose.model('Message', {message: String, user: String, room: String, time: 'Number'});
var AnonList = mongoose.model('AnonUser', {name: String});


var checkAdminIp = function(ip) {
	var returnValue = false
	for (var i = 0; i<administratorIP.length; i++) {
		if (administratorIP[i].ip == ip) {
			returnValue = true
		}
	}
	return returnValue
}

var deleteMessages = function() {
	var daQuery = Message.deleteMany({time: {$lt: getDate24HoursBefore()}})
	daQuery.exec(function(err, jedis) {
		if (err) {
			return console.log(err);
		}
		// jedis.forEach(function(jedi) {
		//	console.log("A 24h old message has been deleted in the "+jedi.room+" room");
		// });
	});
}
setInterval(deleteMessages, 300000)
var ipArray=[]

app.get('/', (req, res) => {
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (checkNonExistingIp(ipInfo)) {
		res.send(generateHtml.frontPage())
	} else {
		var gameId = getGameIdByIpAdress(ipInfo)
		res.send(generateHtml.roomPage(gameId, ipInfo))
	}
});
app.get('/admin', (req, res) => {
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (administratorIP.length > 0) {
		if (checkAdminIp(ipInfo)) {
			res.send(generateHtml.adminPanel())
		} else {
			res.send(generateHtml.login())
		}
	} else {
		res.send(generateHtml.login())
	}
});

app.get('/removeMessage/:message', (req, res) => {
  var message = req.params.message
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (administratorIP.length > 0) {
		if (checkAdminIp(ipInfo)) {
			var daQuery = Message.deleteMany({time: message})
			daQuery.exec(function(err, jedis) {
				if (err) {
					return console.log(err);
				}
			});
			res.redirect('/admin')
		} else {
			res.redirect('/admin')
		}
	} else {
		res.redirect('/admin')
	}
});

app.get('/room/:game', (req, res) => {
  var game = req.params.game
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (checkNonExistingIp(ipInfo) && checkGameExist(game)) {
		addPlayer(ipInfo, game)
	}
	res.redirect('/')
});

app.get('/resetTimer', (req, res) => {
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (!checkNonExistingIp(ipInfo)) {
		resetTimer(ipInfo)
	}
	res.redirect('/')
});

app.get('/quitRoom', (req, res) => {
	var ipInfo = getIp(req);
	ipInfo = ipInfo.clientIp
	if (!checkNonExistingIp(ipInfo)) {
		removePlayer(ipInfo)
	}
	res.redirect('/')
});

app.get('/messages', (req, res) => {
  Message.find({}, (err, messages)=> {
    res.send(messages);
  });
});
app.get('/messages', (req, res) => {
  Message.find({}, (err, messages)=> {
    res.send(messages);
  });
});
app.get('/generateUser', (req, res) => {
  generateUser(res);
});

var checkUserTaken = function(user) {
  var isTaken = false;
  if (usersArray.length !=0) {
    for (var i = 0; i<usersArray.length; i++) {
      if (user == usersArray[i]) {
        isTaken = true
      }
    }
  }
	return isTaken
};
var temporalRes
var checkExistingAnon = function(name, res) {
	AnonList.find({}, (err, messages)=> {
    console.log(messages);
  });
	var daQuery = AnonList.find({name: name})
	temporalRes = res
	daQuery.exec(function(err, jedis) {
		if (err) {
			return console.log(err);
		}
		if (jedis.length == 0) {
			var newAnon = new AnonList({name: name})
			newAnon.save((err) =>{
				if (err) {
					sendStatus(500);
				}
				res.send(name)
			});
		} else {
			generateUser(res)
		}
		// jedis.forEach(function(jedi) {
		//	console.log("A 24h old message has been deleted in the "+jedi.room+" room");
		// });
	});
}


var generateUser = function(res) {
	var user = "anon-"+Math.random().toString(36).substring(7)
	checkExistingAnon(user, res)
}

app.post('/messages', (req, res) => {
  var message = new Message(req.body);
  // message.ip = getIp(req);
  console.log(message);
  message.save((err) =>{
    if (err) {
			sendStatus(500);
		}
    io.emit('message', req.body);
    res.sendStatus(200);
  });
});

app.post('/admin/login', (req, res) =>{
	var loginData = req.body
	if (loginData.password == credentials.password && loginData.name == credentials.name) {
		var ipInfo = getIp(req);
		ipInfo = ipInfo.clientIp
		administratorIP.push(new AdministratorLogin(ipInfo))
	}
	res.redirect('/admin')
})
var AdministratorLogin = function(ip) {
	this.ip= ip;
	this.timer = 600000
}
const credentials = {name: process.env.ADMIN_NAME, password: process.env.ADMIN_PASSWORD}
io.on('connection', () =>{
  console.log('a user is connected');
});
mongoose.connect(dbUrl, {useMongoClient: true}, (err) => {
  console.log('mongodb connected', err);
});

const PORT = process.env.PORT

var server = http.listen(PORT, () => {
  console.log('server is running on port', server.address().port);
});

var generateHtml = {
	frontPage: function() {
		var html = ``
		var head = `
		<!DOCTYPE html>
		<html>

		<head>
			<script src="/socket.io/socket.io.js"></script>
			<meta charset="utf-8">
			<title>Lan Play Meetup</title>
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<link rel="icon" href="https://gamepedia.cursecdn.com/switch_gamepedia_en/6/64/Favicon.ico">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<script src="https://cdn.jsdelivr.net/npm/fingerprintjs2@2.0.6/dist/fingerprint2.min.js"></script>
			<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
			<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
			<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
			<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-beta.3/js/bootstrap.min.js" integrity="sha384-a5N7Y/aK3qNeh15eJKGWxsqtnX/wWdSZSKp+81YjTmS15nvnvxKHuzaWwXHDli+4" crossorigin="anonymous"></script>
			<script src="https://cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js"></script>

			<!--[if lt IE 9]>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script>
				<script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
			<![endif]-->

		</head>
		`
		var body1 = `<body>`
		var body2 = ``
		var body3 = `<a class="text-justify">disclaimer: By navigating in this website you accept all the cookies, all the images in this website are property of their respective owners, i am not responsible for anything show in the chat, if you see something bad in the chat contact me and i will delete it. This site was created by Aitor Rosell Torralba, aka red1reaper, aka takashi1kun, aitor.rosell.torralba@gmail.com</a><script>
		$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})
var port = location.protocol === 'https:' ? 443 : 80
	var socket = io();
	socket.on('players', function(msg){
		testo = msg
		console.log(msg)
			for (var i = 0; i<msg.length; i++){
					$("#"+msg[i].ID).text(msg[i].number)
			}

		});
		</script></body>

		</html>`
		var rowStart = `<div class="card-deck"style="margin-left: 0px;margin-right: 0px;margin-top: 15px;">`
		var rowEnd = `</div>`
		var cardArray = []
		for (var i=0; i<gameList.length; i++) {
			cardArray[i] = `
			<div class="col-auto mb-3">
			<div class="card text-center" style="width: 18rem;">
		  <img src="`+gameList[i].img1()+`" class="card-img-top" alt="...">
		  <div class="card-body">
		    <h5 class="card-title">`+gameList[i].Name+`</h5>
		    <p class="card-text" ><img data-toggle="tooltip" data-placement="left" title="Players" style="width: 22px;" src="data:image/png;base64,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" class="icon">
		<a id="`+gameList[i].ID+`">`+gameList[i].Players()+`</a></p>
		    <button onClick="window.location ='/room/`+gameList[i].ID+`'" class="btn btn-primary"><i class="fab fa-nintendo-switch"></i> Join</button>
		  </div>
		</div>
		</div>
			`
		}
		body2= `<div class="container-fluid mt-4">
    <div class="row justify-content-center">`
		for (var i=0; i<cardArray.length; i++) {
			body2 = body2+cardArray[i]
}
		body2=body2+`</div></div>`
		html = head+body1+body2+body3
		return html
	},
	roomPage: function(gameId, ipInfo) {
		var playerIndex = gameList[gameId].findPlayerIndex(ipInfo)
		var timer = gameList[gameId].PlayerList[playerIndex].timer
		var html= html2
		html = html.replace("<--/GAME/-->", gameList[gameId].Name)
		html = html.replace("<--/TIME/-->", timer)
		html = html.replace("<--/TIMER/-->", msToTime(timer))
		html = html.replace("<--/IMAGE/-->", gameList[gameId].img2())
		html = html.replace("<--/GAMEID/-->", gameList[gameId].ID)
		html = html.replace("<--/PLAYERS/-->", gameList[gameId].Players())
		return html
	},
login: function() {
	var html = fs.readFileSync('login.html', 'utf8');
	return html
},
adminPanel: function() {
	var html = fs.readFileSync('adminPanel.html', 'utf8');
	return html
}}
	var msToTime = function(s) {
		var pad = (n, z = 2) => ('00' + n).slice(-z);
  return pad((s%3.6e6)/6e4 | 0) + ':' + pad((s%6e4)/1000|0);
}
var html2 = fs.readFileSync('gameRoom.html', 'utf8');

const dayInMiliseconds = 86400000

var getDate24HoursBefore = function() {
	return (new Date()).getTime()-86400000
}
