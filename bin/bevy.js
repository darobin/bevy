#!/usr/bin/env node
/*jshint es5: true*/

var nopt = require("nopt")
,   pth = require("path")
,   fs = require("fs")
,   cliUtils = require("../lib/cli-utils")
,   request = require("request")
,   utile = require("utile")
,   knownOpts = {
        package:    String
    ,   bevy:       String
    ,   env:        ["development", "production"]
    ,   deploy:     String
    ,   name:       String
    ,   domain:     String
    ,   static:     Boolean
    ,   type:       ["git", "local"]
    ,   url:        String
    ,   branch:     String
    ,   path:       String
    ,   start:      String
    ,   username:   String
    ,   password:   String
    }
,   command = process.argv.splice(2, 1)[0]
,   cli = nopt(knownOpts, {}, process.argv, 2)
,   packPath = pth.resolve(process.cwd(), cli.package || "package.json")
,   bevyPath = pth.resolve(process.cwd(), cli.bevy || "bevy.json")
;
delete cli.argv;
cli.repository = {};
"type url branch path".split(" ").forEach(function (it) {
    if (cli[it]) {
        cli.repository[it] = cli[it];
        delete cli[it];
    }
});
if (!cli.env) cli.env = "development";


// go to help immediately if requested
if (command === "help") cliUtils.usage("bevy deploy|start|stop|remove|help [OPTIONS]", "bevy");
console.log(process.argv, cli);

// load the config and override it with CLI parameters
var packConf = {}, bevyConf = {};
if (fs.existsSync(packPath)) packConf = JSON.parse(fs.readFileSync(packPath, "utf8"));
else if (cli.package) cliUtils.die("Could not find package.json: " + cli.package + " (resolved to " + packPath + ")");
if (fs.existsSync(bevyPath)) bevyConf = JSON.parse(fs.readFileSync(bevyPath, "utf8"));
else if (cli.bevy) cliUtils.die("Could not find bevy.json: " + cli.bevy + " (resolved to " + bevyPath + ")");

// merge in the order: package.json < bevy.json < bevy.json[env] < cli
// we need to merge repository separately as it's deep
var conf = utile.mixin({}, packConf, bevyConf, bevyConf[cli.env], cli);
conf.repository = utile.mixin(  packConf.repository || {}
                            ,   bevyConf.repository || {}
                            ,   bevyConf[cli.env] ? bevyConf[cli.env].repository || {} : {}
                            ,   cli.repository
                            );

// validate required
conf.deploy || cliUtils.die("Missing 'deploy' information.");
conf.name || cliUtils.die("Missing 'name' information.");
if (conf.repository.type === "local") {
    conf.repository.path || cliUtils.die("Missing 'path' information for local repository.");
}
else { // git is the default
    conf.repository.url || cliUtils.die("Missing 'url' information for git repository.");
}

// defaulting
if (conf.deploy.indexOf("://") === -1) conf.deploy = "http://" + conf.deploy;
if (!/\/$/.test(conf.deploy)) conf.deploy += "/";

var reqConf = { json: true };
if (conf.username) {
    reqConf.auth = {
        user:               conf.username
    ,   pass:               conf.password
    ,   sendImmediately:    true
    };
}

function simpleRes (err, res, body) {
    if (err) console.log(body.error);
    else console.log("OK");
}

if (command === "deploy") {
    // get to see if the app exists
    // if it does, send the update signal
    // otherwise, PUT it
    request.get(conf.deploy + "app/" + conf.name, reqConf, function (err, res, body) {
        if (err) {
            // app does not exist at all, install it
            if (res.statusCode === 404) {
                reqConf.json = conf;
                request.put(conf.deploy + "app/" + conf.name, reqConf, function (err, res, body) {
                    if (err) return console.log(body.error);
                    request.get(conf.deploy + "app/" + conf.name + "/start", reqConf, simpleRes);
                });
            }
            else {
                console.log(body.error); // real error
            }
            return;
        }
        request.get(conf.deploy + "app/" + conf.name + "/update", reqConf, simpleRes);
    });
}
else if (command === "start") {
    request.get(conf.deploy + "app/" + conf.name + "/start", reqConf, simpleRes);
}
else if (command === "stop") {
    request.get(conf.deploy + "app/" + conf.name + "/stop", reqConf, simpleRes);
}
else if (command === "remove") {
    request.del(conf.deploy + "app/" + conf.name, reqConf, simpleRes);
}
else {
    cliUtils.die("Unknown command: " + command);
}

