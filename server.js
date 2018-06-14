var express = require('express');
var exphbs = require('express-handlebars');
var hbs = require('./helpers/handlebars')(exphbs);
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;

const mongoHost = process.env.MONGO_HOST || 'classmongo.engr.oregonstate.edu';
const mongoPort = process.env.MONGO_PORT || 27017;
const mongoUser = process.env.MONGO_USER || 'cs290_luuph';
const mongoPassword = process.env.MONGO_PASSWORD || '9';
const mongoDBName = process.env.MONGO_DB_NAME || 'cs290_luuph';
const mongoURL = 'mongodb://' + mongoUser + ':' + mongoPassword + '@' +
                  mongoHost + ':' + mongoPort + '/' + mongoDBName;

var mongoDB = null;
var allUsers = null;
var currentUser = null;
var count = 0;


var app = express();
const port = process.env.PORT || 22222;

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.use(bodyParser.json());
app.use(express.static('public'));


/**
 * Make routes for whatever we make in the <nav> section (aka, the .navlinks)
 * The list of links is not final yet, as we need to all agree what's on the list.
 *
 * These below are just my proposal and are subject to change.
 */

// "Home" page is the default page every user ends up on.
// It should display only the goal for the day and the user's progress on that day.
app.get('/', function(req, res, next) {
  res.status(200).render('home', {
    userList: allUsers,
    user: currentUser,
    hasSidebar: true,
    activities: currentUser.activities,
    goals: currentUser.goals
  });
});

// "About" page talks about us and the project itself. It's a tutorial for new
// users how to use the web app.
app.get('/about', function(req, res, next) {
  res.status(200).render('about', {
    user: currentUser
  });
});

// "Calendar" page will show a calendar where the user's workout plans are displayed
app.get('/calendar', function(req, res, next) {
  res.status(200).render('calendar', {
    user: currentUser,
    days: currentUser.days
  });
});

// "Leaderboard" page. I'm not sure about this. I just want to find something to
// integrate the database and multi-account into the web app. IMO, this is
// expected to change.
app.get('/leaderboard', function(req, res, next) {
  res.status(200).render('leaderboard', {
    userList: allUsers,
    user: currentUser
  });
});

app.post('/activity/log', function(req, res, next) {
  if (req.body && req.body.description && req.body.progress
      && !isNaN(req.body.progress) && !isNaN(req.body.percentage)
      && req.body.activity.content && !isNaN(req.body.activity.percent)) {
    mongoDB.collection('users').updateOne(
      { name: currentUser.name, 'goals.description': req.body.description },
      { $set: {
        'goals.$.progress': req.body.progress,
        'goals.$.percentage': req.body.percentage
      }}
    );
    mongoDB.collection('users').updateOne(
      { name: currentUser.name },
      { $addToSet: {
        "activities": {
          content: req.body.activity.content,
          percent: req.body.activity.percent
        }
      }}
    );
    res.status(200).send('Activity logged');
    updateUsers();
  } else {
    res.status(400).send('Bad request');
  }
});

app.post('/goal/add', function(req, res, next) {
  if (req.body && req.body.description && req.body.goal
     && req.body.progress !== undefined && req.body.percentage !== undefined) {
    mongoDB.collection('users').updateOne(
      { name: currentUser.name },
      { $addToSet: {
        'goals': {
          'description': req.body.description,
          'goal': req.body.goal,
          'progress': req.body.progress,
          'percentage': req.body.percentage
        }
      }}
    );
    res.status(200).send('New goal created');
    updateUsers();
  } else {
    res.status(400).send('Bad request');
  }
});

app.post('/goal/remove', function(req, res, next) {
  if (req.body && req.body.description !== '') {
    mongoDB.collection('users').updateOne(
      { name: currentUser.name },
      { $pull: {
        goals: { 'description': req.body.description }
      }}
    );
    res.status(200).send('Goal removed');
    updateUsers();
  } else {
    res.status(400).send('Bad request');
  }
});

app.post('/calendar/update', function(req, res, next) {
  if (req.body && req.body.weekday && req.body.content) {
    mongoDB.collection('users').updateOne(
      { name: currentUser.name, "days.weekday": req.body.weekday },
      { $set: { "days.$.content" : req.body.content }}
    );
    res.status(200).send('New plan created');
    updateUsers();
  } else {
    res.status(400).send('Bad request');
  }
});

app.post('/user/add', function(req, res, next){
  if(req.body && req.body.name && req.body.profilePicUrl){
    mongoDB.collection('users').insertOne(req.body);
    updateUsers();
    //changeUser(req.body.name);
    res.status(200).send('New user added');
  }
  else{
    res.status(400).send('Bad request');
  }
});

app.post('/user/change', function(req, res, next){
  if(req.body && req.body.name){
    //updateUsers();
    changeUser(req.body.name);
    res.status(200).send('user changed');
  }
  else{
    res.status(400).send('Bad request');
  }
});

app.get('*', function(req, res) {
  res.status(404).render('404', {
    user: currentUser
  });
});


function updateUsers() {
  var userCollection = mongoDB.collection('users');
  userCollection.find().toArray(function (err, userTable) {
    if (err) {
      throw err;
    }
    //console.log(userTable);
    allUsers = userTable;
    currentUser = allUsers[count];
  });
}

function changeUser(userName){
  var userCollection = mongoDB.collection('users');
  userCollection.find().toArray(function (err, userTable) {
    if (err) {
      throw err;
    }
    //console.log(userTable);
    allUsers = userTable;
    count = 0;
    while(allUsers[count]){
      if(allUsers[count].name == userName){
        currentUser = allUsers[count];
        break;
      }
      else{
        count += 1;
      }
    }
  });

}

MongoClient.connect(mongoURL, function(err, client) {
  if (err) {
    throw err;
  }
  mongoDB = client.db(mongoDBName);

  var userCollection = mongoDB.collection('users');
  //userCollection.remove({"_id": ObjectId("5b21e48df2da1a5ed9235704")});
  userCollection.find().toArray(function (err, userTable) {
    if (err) {
      throw err;
    }
    allUsers = userTable;
    currentUser = allUsers[0];
    console.log(currentUser);
  });

  app.listen(port, function() {
    console.log('========================================');
    console.log('  Server is listening on port', port);
    console.log('========================================');
  });
});
