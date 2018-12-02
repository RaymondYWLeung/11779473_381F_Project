var http = require('http');
var url  = require('url');
var fs = require('fs');
var formidable = require('formidable');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var session = require('cookie-session');
var bodyParser = require('body-parser');
const mongourl = 'mongodb://admin:pw1234@ds251362.mlab.com:51362/s381f';
var express = require('express');
var app = express();

var users;
var searchCriteria = "";

app = express();
app.set('view engine','ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';



app.set('view engine','ejs');

app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/',function(req,res) {
	//console.log(req.session);
	res.redirect('/login');
});

app.get('/login',function(req,res) {
	res.render('login',{});
});

app.get('/main',function(req,res) {
	res.status(200);
	findAllRestaurant(res, function(result){
		res.render('main',{name:req.session.username, restaurant:result, searchCriteria:searchCriteria});
	})
});

app.get('/create_restaurant',function(req,res){
	res.render('create_restaurant',{});
})

app.get('/restaurant_detail',function(req,res){
	var restID = req.query._resID;
	findRestaurantDetail(res,req,restID,function(result){
		//console.log(result);
		res.render('restaurant_detail',{rest : result,name:req.session.username});
	});
})

app.post('/updateForm',function(req,res){
	var restID = req.body.restObjId;
	findRestaurantDetail(res,req,restID,function(result){
		//console.log(result);
		res.render('update_restaurant',{rest : result});
	});
})

app.post('/deleteForm',function(req,res){
	var restID = req.body.restObjId;
	deleteRestaurant(res,req,restID);
})

app.post('/uploadRateForm',function(req,res){
	res.render('upload_rate',{objID : req.body.restObjId});
})

app.post('/uploadRate',function(req,res){
	uploadRate(res,req);
})

app.post('/addRestForm',function(req,res){
	addRestaurant(res,req);
})

app.post('/updateRestForm',function(req,res){
	updateRestaurant(res,req);
})

app.post('/search_restaurant',function(req,res) {
	searchRestaurant(res,req,function(result){
		res.render('main',{name:req.session.username, restaurant:result, searchCriteria:searchCriteria});
	})
});

app.post('/login',function(req,res) {

	req.session.authenticated = false;

	userLogin(res,function(result){
		if(result){
			console.log(result);
			users = result;
			
	for (var i=0; i<users.length; i++) {
		console.log(users[i].user)
		if (users[i].user == req.body.name &&
		    users[i].password == req.body.password) {
			req.session.authenticated = true;
			req.session.username = users[i].user;
		}
	}
	if(req.session.authenticated){
		res.redirect('/main');
	}else{
		res.redirect('/');
	}
		}
	});

});


app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});

app.get('/api/restaurant/read/name/:restName',function(req,res){
	var query = { "name":req.params.restName };
	console.log("Restful service: GET /api/restaurant/read/name/:restName");
	apiGetRestaurant(res,req,query,function(result){
		res.status(200).json(result).end();
	});
});

app.get('/api/restaurant/read/borough/:restBorough',function(req,res){
	var query = { "borough":req.params.restBorough };
	console.log("Restful service: GET /api/restaurant/read/borough/:restBorough");
	apiGetRestaurant(res,req,query,function(result){
		res.status(200).json(result).end();
	});
});

app.get('/api/restaurant/read/cuisine/:restCuisine',function(req,res){
	var query = { "cuisine":req.params.restCuisine };
	console.log("Restful service: GET /api/restaurant/read/cuisine/:restCuisinee");
	apiGetRestaurant(res,req,query,function(result){
		res.status(200).json(result).end();
	});
});

app.post('/api/restaurant/create',function(req,res) {

	if(typeof req.body.username != "undefined" && typeof req.body.password != "undefined" && req.body.name != "undefined"){

		var authenticated = false;

		userLogin(res,function(result){
			if(result){
				users = result;

				for (var i=0; i<users.length; i++) {
					if (users[i].user == req.body.username &&
						users[i].password == req.body.password) {
						authenticated = true;
				}
			}
		}

		if(!authenticated){
			console.log("!authenticated");
			var response = {"status" : "failed"};
			res.status(404).json(response).end();
		}else{
			var newForm = {}
			newForm.name = req.body.name;
			newForm.borough = req.body.borough;
			newForm.cuisine = req.body.cuisine;

			var address = {}
			address.street = req.body.street;
			address.building = req.body.building;
			address.zipcode = req.body.zipcode;

			var coord = [];
			coord.push(req.body.lon);
			coord.push(req.body.lat);
			address.coord = coord;

			newForm.address = address;
			newForm.restaurant_id = req.body.restID;

			newForm.photo = req.body.photo;
			newForm.photo_mimetype = req.body.photo_mimetype;

			newForm.owner = req.body.username;

			apiPostRestaurant(res,req,newForm,function(result){
				if(result){
					var response = {"status" : "ok", 
					"_id" : result.ops[0]._id};
					console.log(response);
					res.status(200).json(response).end();
				}else{
					console.log("Post restaurant failed");
					var response = {"status" : "failed"};
					res.status(200).json(response).end();
				}
			})
		}
	})
	}else{
		console.log("Undefined variable");
		var response = {"status" : "failed"};
		res.status(404).json(response).end();
	}
})

app.get('*',function(req,res){
    res.status(404).end('File not found');
});

app.listen(process.env.PORT || 8099);

function userLogin(res,callback){
	MongoClient.connect(mongourl, function(err, db) {
	 	if (err) throw err;
	 	console.log("Function: userLogin()");
	 	var dbo = db.db("s381f");
	 	dbo.collection("project_ac").find({}).toArray(function(err, result) {
	    	if (err) throw err;
	    	db.close();
	    	callback(result);
	  	});
	});
}

function findAllRestaurant(res,callback){
	MongoClient.connect(mongourl, function(err, db) {
	 	if (err) throw err;
	 	console.log("Function: findAllRestaurant()");
	 	var dbo = db.db("s381f");
	 	dbo.collection("project_res").find({}).toArray(function(err, result) {
	    	if (err) throw err;
	    	db.close();
	    	callback(result);
	  	});
	});
}

function searchRestaurant(res,req,callback){

	MongoClient.connect(mongourl, function(err, db) {
	 	if (err) throw err;
	 	console.log("Function: searchRestaurant()");
	 	var dbo = db.db("s381f");
	 	//var query = req.body.search + ' : "' + req.body.keyword + '"'
	 	var search = req.body.search;
	 	var keyword = req.body.keyword;

	 	if (search == 'zipcode' || search == 'building' || search == 'street'){
	 		search = "address." + search
	 	}
 	
	 	searchCriteria = search + " : " + keyword;

	 	if (search == 'all'){

	 		keyword = new RegExp(keyword,'i');
	 		var query = {$or : [{owner:keyword} , {restaurant_id:keyword} , {name:keyword},{borough:keyword}, {cuisine:keyword},
	 					{['address.street']:keyword}, {['address.building']:keyword} , {['address.zipcode']:keyword} 
	 					,{['address.coord']:keyword}]}

	 	}else{

	 		//console.log(search + " : " + keyword );
	 		keyword = new RegExp(keyword,'i');
	 		var query = {[search]:keyword}
	 	}



	 	dbo.collection("project_res").find(query).toArray(function(err, result) {
	 		//console.log(result);
	    	if (err) throw err;
	    	db.close();
	    	callback(result);
	  	});
	});
}

function addRestaurant(res,req){
	
	    var form = new formidable.IncomingForm();
	    form.parse(req, function (err, fields, files) {
	    //console.log(files.filetoupload);

		var newForm = {};
	    var filename = files.filetoupload.path;
	      
	    if (files.filetoupload.type) {
	        var mimetype = files.filetoupload.type;
	    }
		fs.readFile(filename, function(err,data) {
	        newForm.photo_mimetype = mimetype;
	        newForm.photo = new Buffer(data).toString('base64');
	    })

	    newForm.name = fields.name;
	    newForm.borough = fields.borough;
	    newForm.cuisine = fields.cuisine;

	    var address = {}
	    address.street = fields.street;
	    address.building = fields.building;
	    address.zipcode = fields.zipcode;

	    var coord = [];
	    coord.push(fields.gps_lon);
	    coord.push(fields.gps_lat);
	    address.coord = coord;

	    newForm.address = address;
	    newForm.restaurant_id = fields.restID;

	    newForm.owner = req.session.username;

		MongoClient.connect(mongourl, function(err, db) {
		 	if (err) throw err;
		 	console.log("Function: addRestaurant()");
		 	var dbo = db.db("s381f");
		 	dbo.collection("project_res").insertOne(newForm, function(err, res) {
				    if (err) throw err;
				    console.log("1 restaurant inserted");
				    db.close();
			});
		 });

		findAllRestaurant(res, function(result){
			res.redirect('/main');
		});

	});

}

function updateRestaurant(res,req){
	
	    var form = new formidable.IncomingForm();
	    form.parse(req, function (err, fields, files) {
	    //console.log(fields);
	    console.log(JSON.stringify(files));

	    var newForm = {};

		var filename = files.filetoupload.path;
	      
	    if(files.filetoupload.size != 0){
		    if (files.filetoupload.type) {
		        var mimetype = files.filetoupload.type;
		    }
			fs.readFile(filename, function(err,data) {
		        newForm.photo_mimetype = mimetype;
		        newForm.photo = new Buffer(data).toString('base64');
		    })
		}

	    newForm.name = fields.name;
	    newForm.borough = fields.borough;
	    newForm.cuisine = fields.cuisine;

	    var address = {}
	    address.street = fields.street;
	    address.building = fields.building;
	    address.zipcode = fields.zipcode;

	    var coord = [];
	    coord.push(fields.gps_lon);
	    coord.push(fields.gps_lat);
	    address.coord = coord;

	    newForm.address = address;
	    newForm.restaurant_id = fields.restID;

	    newForm.owner = req.session.username;

		MongoClient.connect(mongourl, function(err, db) {
		  if (err) throw err;
		  var dbo = db.db("s381f");
		  var myquery = { "_id": ObjectId(fields.restaurant_id) };
		  dbo.collection("project_res").updateOne(myquery, {$set:newForm}, function(err, res) {
		    if (err) throw err;
		    console.log("1 document updated");
		    db.close();
		  });
			findAllRestaurant(res, function(result){
				res.redirect('/main');
			});

		});
	});
}

function deleteRestaurant(res,req,restID){
	MongoClient.connect(mongourl, function(err, db) {
	  if (err) throw err;
	  console.log("deleteRestaurant()");
	  var dbo = db.db("s381f");
		  var myquery = { "_id": ObjectId(restID) };
	  dbo.collection("project_res").deleteOne(myquery, function(err, obj) {
	    if (err) throw err;
	    console.log("1 document deleted");
	    db.close();
	  });
	  findAllRestaurant(res, function(result){
				res.redirect('/main');
			});
	});
}

function uploadRate(res,req){
	var grade = {};
	grade['user'] = req.session.username;
	grade['score'] = req.body.score;

	console.log(grade);


	MongoClient.connect(mongourl, function(err, db) {
		  if (err) throw err;
		  console.log("uploadRate()");
		  var dbo = db.db("s381f");
		  var myquery = { "_id": ObjectId(req.body.objID) };
		  dbo.collection("project_res").updateOne(myquery, {$push:{grades:grade}}, function(err, res) {
		    if (err) throw err;
		    console.log("1 document updated");
		    db.close();
		  });
			findAllRestaurant(res, function(result){
				res.redirect('/main');
			});
		});
}

function findRestaurantDetail(res,req,resID,callback){
	MongoClient.connect(mongourl, function(err, db) {
		 	if (err) throw err;
		 	console.log("findRestaurantDetail()");
		 	var dbo = db.db("s381f");
		 	dbo.collection("project_res").find({_id: ObjectId(resID)}).toArray(function(err, result) {
		    	if (err) throw err;
		    	db.close();
		    	callback(result);
			})
	})

}

function apiGetRestaurant(res,req,query,callback){
	MongoClient.connect(mongourl, function(err, db) {
		 	if (err) throw err;
		 	console.log("Function: apiGetRestaurant()");
		 	var dbo = db.db("s381f");
		 	dbo.collection("project_res").find(query).toArray(function(err, result) {
		    	if (err) throw err;
		    	db.close();
		    	callback(result);
			})
	})

}

function apiPostRestaurant(res,req,obj,callback){
	MongoClient.connect(mongourl, function(err, db) {
		 	if (err) throw err;
		 	console.log("Function: apiPostRestaurant()");
		 	var dbo = db.db("s381f");
		 	dbo.collection("project_res").insertOne(obj, function(err, res) {
				    if (err) throw err;
				    console.log("1 restaurant inserted");
				    db.close();
				    callback(res);
			})
		 })
}
