/*jshint es5: true */

var forever = require("forever-monitor")
,   httpProxy = require("http-proxy")
,   portfinder = require("portfinder")
,   express = require("express")
,   touch = require("touch")
,   utile = require("utile")
,   pth = require("path")
,   fs = require("fs")
,   apps = {}
,   spawns = {}
,   version = require("../package.json").version
,   configPath = pth.join(process.cwd(), process.argv[2]) || "/etc/bevy/config.json"
;

// load configuration
var conf = utile.mixin({
    domain:     "localhost"
,   ports:      [80]
,   store:      pth.join(process.env.TMPDIR || "/var/tmp", "bevy-store")
,   basePort:   7000
}, require(configPath));
if (!utile.isArray(conf.ports)) conf.ports = [conf.ports];
portfinder.basePort = conf.basePort;

// set up proxy
var proxy = httpProxy.createServer({ hostnameOnly: true, router: {} });
conf.ports.forEach(function (port) { proxy.listen(port); });

// handle errors (this needs improvement)
function error (msg, obj) {
    console.log("[ERROR]", msg, obj);
    process.exit(1);
}

// dynamically adds a route to the proxy
function addAppRoute (domain, port) {
    proxy.proxy.proxyTable.addRoute(domain, "127.0.0.1:" + port);
}

// get a free port
function getPort (cb) {
    portfinder.getPort(function (err, port) {
        // next time, start the search there
        if (port) portfinder.basePort = port + 1;
        cb(err, port);
    });
}

// spawn an app
function spawnApp (app, cb) {
    getPort(function (err, port) {
        if (err) return cb(err);
        if (app.static) {
            // XXX
            return error("Static server not implemented yet.");
        }
        else {
            var child = new forever.Monitor(app.startPath, {
                env:    { PORT: port }
            ,   cwd:    app.contentPath
            });
            // XXX adding logging by listening to the app's events might be good
            //  alternatively, apps could be given a log env
            spawns[app.name] = child;
            child.on("exit", function () {
                error("Unexpected exit of app " + app.name);
            });
            child.start();
        }
        app.running = true;
        app.port = port;
        touch(app.runningPath, cb);
    });
}

// stop an app
function stopApp (app, cb) {
    // XXX
    forever;
    app.running = false;
    fs.exists(app.runningPath, function (exists) {
        exists ? fs.unlink(app.runningPath, cb) : cb(null);
    });
}

// update an app
function updateApp (app, cb) {
    // XXX
    forever;
    // get stuff from git or whatever
    // stop and start
    cb(null); // if success
}

// launch the configuration API
function startAPI (port) {
    var app = express();

    // auth
    if (conf.username) app.use(express.basicAuth(conf.username, conf.password));
    
    // middleware
    app.use(express.logger());
    app.use(express.bodyParser());

    // GET /
    // server info
    app.get("/", function (req, res) {
        res.json({ bevy: version });
    });

    // GET /apps
    // lists all the apps
    app.get("/apps", function (req, res) {
        res.json(apps);
    });

    // select the app
    function pickApp (req, res, next) {
        var name = req.params.name;
        if (!apps[name]) return res.json(404, { error: "No app for this name." });
        req.bevyApp = apps[name];
        next();
    }
    
    // GET /app/app-name
    // list that app
    app.get("/app/:name", pickApp, function (req, res) {
        res.json(req.bevyApp);
    });

    function simpleResponse (res) {
        return function (err) {
            if (err) return res.json(500, { error: err });
            res.json({ ok: true });
        };
    }

    // GET /app/app-name/start
    // starts the app
    app.get("/app/:name/start", pickApp, function (req, res) {
        if (req.bevyApp.running) return res.json(418, { error: "App already running." });
        spawnApp(req.bevyApp, simpleResponse(res));
    });

    // GET /app/app-name/stop
    // stops the app
    app.get("/app/:name/stop", pickApp, function (req, res) {
        if (!req.bevyApp.running) return res.json(418, { error: "App already stopped." });
        stopApp(req.bevyApp, simpleResponse(res));
    });

    // GET /app/app-name/update
    // causes the source of the app to update from the repo
    app.get("/app/:name/update", pickApp, function (req, res) {
        updateApp(req.bevyApp, simpleResponse(res));
    });

    // PUT /app/app-name
    //     create or update a new app, with JSON
    //     {
    //         environment:    dev|prod|test
    //     ,   domain:      "foo.bast"
    //     ,   dependencies:   {}
    //     ,   repository: {
    //             type:   "git"
    //         ,   url:    "..."
    //         }
    //     ,   scripts:    {
    //             start:  "start-script.js" // default to app.js
    //         }
    //      ,   static:     true|false
    //     }
    app.put("/app/:name", function (req, res) {
        var name = req.params.name
        ,   desc = req.body;
        if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.json(400, { error: "Bad name, rule: /^[a-zA-Z0-9-_]+$/." });
        if (!desc) return res.json(400, { error: "No JSON configuration provided." });
        if (!desc.repository) return res.json(400, { error: "Field 'repository' required." });
        if (!desc.domain) return res.json(400, { error: "Field 'domain' required." });
        if (!desc.repository.type) desc.repository.type = "git";
        if (!desc.static) {
            if (!desc.environment) desc.environment = "dev";
            if (!desc.scripts) desc.scripts = {};
            if (!desc.scripts.start) desc.scripts.start = "app.js";
        }
        desc.running = apps[name] ? apps[name].running : false;
        apps[name] = desc;
        updateApp(req.bevyApp, simpleResponse(res));
    });

    app.listen(port);

    // load existing apps from store
    //  the store is created if it doesn't exist
    //  inside the store, each directory that contains a "config.json" is an app
    //  if the app directory contains a "RUNNING" file, then it's running
    //  the app directory has a "content" directory that's the app's content
    if (!fs.existsSync(conf.store)) fs.mkdirSync(conf.store);
    fs.readdir(conf.store, function (err, files) {
        if (err) return error("Failed to read directory " + conf.store, err);
        files.forEach(function (name) {
            var dir = pth.join(conf.store, name);
            fs.stat(dir, function (stat) {
                if (!stat.isDirectory()) return;
                var configPath = pth.join(dir, "config.json")
                ,   runningPath = pth.join(dir, "RUNNING")
                ,   running = fs.existsSync(runningPath);
                if (!fs.existsSync(configPath)) return;
                fs.readFile(configPath, function (err, data) {
                    if (err) return error("Could not read app configuration " + configPath, err);
                    var appConfig;
                    try {
                        appConfig = JSON.parse(data);
                    }
                    catch (e) {
                        return error("Failed to parse app configuration" + configPath, err);
                    }
                    apps[name] = appConfig;
                    appConfig.name = name;
                    appConfig.configPath = configPath;
                    appConfig.runningPath = runningPath;
                    appConfig.contentPath = pth.join(dir, "content");
                    appConfig.startPath = pth.join(appConfig.contentPath, appConfig.scripts.start);
                    if (running) spawnApp(appConfig);
                });
            });
        });
    });
}

// add the local service as an app
getPort(function (err, port) {
    if (err) return error("Failed to assign port", err);
    addAppRoute(conf.domain, port);
    startAPI(port);
});
