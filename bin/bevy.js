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
    ,   to:         String
    ,   secure:     Boolean
    }
,   command = process.argv.splice(2, 1)[0]
,   cli = nopt(knownOpts, {}, process.argv, 2)
,   packPath = pth.resolve(process.cwd(), cli.package || "package.json")
,   bevyPath = pth.resolve(process.cwd(), cli.bevy || "bevy.json")
,   staging = false
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
if (command === "stage") {
    command = "deploy";
    staging = true;
}


// go to help immediately if requested, same for version
if (command === "help") cliUtils.usage("bevy deploy|start|stop|remove|update|stage|help [OPTIONS]", "bevy");
if (command === "version") {
    console.log(require("../package.json").version);
    process.exit(0);
}

// load the config and override it with CLI parameters
var packConf = {}, bevyConf = {};
if (fs.existsSync(packPath)) packConf = JSON.parse(fs.readFileSync(packPath, "utf8"));
else if (cli.package) cliUtils.die("Could not find package.json: " + cli.package + " (resolved to " + packPath + ")");
if (fs.existsSync(bevyPath)) bevyConf = JSON.parse(fs.readFileSync(bevyPath, "utf8"));
else if (cli.bevy) cliUtils.die("Could not find bevy.json: " + cli.bevy + " (resolved to " + bevyPath + ")");

// merge in the order: package.json < bevy.json < bevy.json[env] < cli
// we need to merge repository separately as it's deep
var conf = utile.mixin({}, packConf, bevyConf, bevyConf[cli.env] || {}, cli);
conf.repository = utile.mixin(  packConf.repository || {}
                            ,   bevyConf.repository || {}
                            ,   bevyConf[cli.env] ? bevyConf[cli.env].repository || {} : {}
                            ,   cli.repository
                            );
if (staging) conf.env = "production";

// validate required
conf.deploy || cliUtils.die("Missing 'deploy' information.");
conf.name || cliUtils.die("Missing 'name' information.");

// defaulting
if (conf.deploy.indexOf("://") === -1) conf.deploy = "http://" + conf.deploy;
if (!/\/$/.test(conf.deploy)) conf.deploy += "/";

// process proxy options
if (cli.to) {
    var opt = {};
    if (/^\d+$/.test(cli.to)) opt.port = 1 * cli.to;
    else if (/^\//.test(cli.to)) opt.path = cli.to;
    else {
        var spl = cli.to.split(":");
        opt.host = spl[0];
        opt.port = 1 * spl[1];
    }
    opt.secure = cli.secure;
    conf.to = opt;
}

var reqConf = {};
function simpleRes (err, res, body) {
    if (err) return console.log(err);
    body = (typeof body === "string") ? JSON.parse(body) : body;
    if (body && body.error) return console.log(body.error);
    console.log("OK");
}

function pollSession (id, reqConf, done) {
    var url = conf.deploy + "session/" + id
    ,   poll = function () {
            request.get(url, reqConf, function (err, res, body) {
                if (err) return console.log(err);
                body = (typeof body === "string") ? JSON.parse(body) : body;
                if (body && body.error) return console.log(body.error);
                if (body.done) return done();
                for (var i = 0, n = body.messages.length; i < n; i++) {
                    var msg = body.messages[i];
                    if (msg[0] === "error") console.log("[ERROR]" + msg[1]);
                    if (msg[0] === "end") console.log("Session terminating.");
                    else process.stdout.write(msg[1]);
                }
                setTimeout(poll, 3000);
            });
        }
    ;
    poll();
}

if (command === "deploy") {
    if (!conf.to) {
        if (conf.repository.type === "local") {
            conf.repository.path || cliUtils.die("Missing 'path' information for local repository.");
        }
        else { // git is the default
            conf.repository.url || cliUtils.die("Missing 'url' information for git repository.");
        }
    }
    // get to see if the app exists and put it
    request.get(conf.deploy + "app/" + conf.name, reqConf, function (err, res) {
        if (err) return console.log(err);

        var notExists = res.statusCode === 404;
        reqConf.json = conf;
        request.put(conf.deploy + "app/" + conf.name, reqConf, function (err, res, body) {
            if (err) return console.log(err);
            if (body && body.error) return console.log(body.error);

            delete reqConf.method; // I'm starting to hate this library
            delete reqConf.json;

            var whenDone = function () {
                if (notExists) {
                    request.post(conf.deploy + "app/" + conf.name + "/start", reqConf, simpleRes);
                }
                else {
                    console.log("OK");
                }
            };
            
            // a session for a long-running job was opened, poll
            if (res.statusCode === 202) {
                pollSession(body.id, reqConf, whenDone);
            }
            // this succeeded immediately
            else {
                whenDone();
            }
        });
    });
}
else if (command === "start") {
    request.post(conf.deploy + "app/" + conf.name + "/start", reqConf, simpleRes);
}
else if (command === "stop") {
    request.post(conf.deploy + "app/" + conf.name + "/stop", reqConf, simpleRes);
}
else if (command === "update") {
    request.post(conf.deploy + "app/" + conf.name + "/update", reqConf, function (err, res, body) {
        if (err) return console.log(err);
        if (body && body.error) return console.log(body.error);
        var done = function () { console.log("OK"); }
        if (res.statusCode === 202) pollSession(body.id, reqConf, done);
        else done();
    });
}
else if (command === "remove") {
    request.del(conf.deploy + "app/" + conf.name, reqConf, simpleRes);
}
else {
    cliUtils.die("Unknown command: " + command);
}

