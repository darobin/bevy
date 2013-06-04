/*jshint es5: true */

var forever = require("forever-monitor")
,   httpProxy = require("http-proxy")
,   portfinder = require("portfinder")
,   express = require("express")
,   repo = require("./repo")
,   touch = require("touch")
,   utile = require("utile")
,   deepEquals = require("deep-equal")
,   pth = require("path")
,   fs = require("fs")
,   os = require("os")
,   version = require("../package.json").version
,   staticServerPath = pth.join(__dirname, "static-server.js")
;

function Bevy (conf) {
    var apps = {}
    ,   spawns = {}
    ;
    if (!conf) conf = {};

    // load configuration
    var conf = utile.mixin({
        domain:     "localhost"
    ,   ports:      [80]
    ,   store:      pth.join(process.env.TMPDIR || "/var/tmp", "bevy-store")
    ,   basePort:   7000
    ,   security:   "local"
    }, conf);
    if (!utile.isArray(conf.ports)) conf.ports = [conf.ports];
    portfinder.basePort = conf.basePort;

    // set up proxy
    var proxy = httpProxy.createServer({ hostnameOnly: true, router: {}, enable: { xforward: true } });
    conf.ports.forEach(function (port) { proxy.listen(port); });

    // handle errors (this needs improvement)
    function error (msg, obj) {
        console.log("[ERROR]", msg, obj);
        process.exit(1);
    }

    // dynamically adds/removes a route to the proxy
    function addAppRoute (domain, port) {
        proxy.proxy.proxyTable.addRoute(domain, "127.0.0.1:" + port);
    }
    function removeAppRoute (domain) {
        proxy.proxy.proxyTable.removeRoute(domain);
    }

    // get a free port
    function getPort (cb) {
        portfinder.getPort(function (err, port) {
            // next time, start the search there
            if (port) portfinder.basePort = port + 1;
            cb(err, port);
        });
    }

    // launch a child
    function startChild (conf) {
        return new forever.Monitor(conf.startPath, {
            env:        {
                PORT:       conf.port
            ,   BEVY_ROOT:  conf.cwd
            ,   NODE_ENV:   conf.env || "development"
            }
        ,   cwd:        conf.cwd
        ,   logFile:    pth.join(conf.logPath, "forever.log")
        ,   outFile:    pth.join(conf.logPath, "access.log")
        ,   errFile:    pth.join(conf.logPath, "error.log")
        });
    }

    // spawn an app
    function spawnApp (app, cb) {
        getPort(function (err, port) {
            if (err) return cb(err);
            var conf;
            if (app.static) {
                conf = {
                    startPath:  staticServerPath
                ,   port:       port
                ,   cwd:        (app.repository.type === "local") ? app.repository.path : app.contentPath
                ,   logPath:    app.storePath
                };
            }
            else {
                conf = {
                    startPath:  app.startPath
                ,   port:       port
                ,   cwd:        app.contentPath
                ,   logPath:    app.storePath
                };
            }
            var child = startChild(conf);
            spawns[app.name] = child;
            child.on("error", function (error) {
                error("Unexpected error in app " + app.name + ": " + error);
            });
            child.start();

            addAppRoute(app.domain, port);
            app.running = true;
            app.port = port;
            touch(app.runningPath, cb);
        });
    }

    // stop an app
    function stopApp (app, cb) {
        var child = spawns[app.name];
        if (!child) return cb(null);
        child.stop();
        delete spawns[app.name];
        removeAppRoute(app.domain);
        app.running = false;
        if (fs.existsSync(app.runningPath)) fs.unlinkSync(app.runningPath);
        cb(null);
    }
    
    function restartApp (app, cb) {
        stopApp(app, function (err) {
            if (err) return cb(err);
            spawnApp(app, cb);
        });
    }

    // update an app
    //  note that this does not start an app upon installation
    function updateApp (app, cb) {
        if (!fs.existsSync(app.storePath)) fs.mkdirSync(app.storePath);
        // if you change the repository source, for now you have to remove and re-add
        // at some point we should support doing this transparently, in the meantime
        // the right thing to do is to tell the user that it won't work
        if (apps[app.name] && !deepEquals(apps[app.name].repository, app.repository)) {
            return cb("When changing the repository, you must remove and re-add the app.");
        }

        fs.writeFileSync(app.configPath, JSON.stringify(app, null, 4));

        function restartAndOk () {
            // if it was running, restart it (but not otherwise)
            var child = spawns[app.name];
            if (child) restartApp(app, cb);
            else cb(null);
        }

        // if app is local and static, no need to copy over the content
        if (app.static && app.repository.type === "local") {
            restartAndOk();
        }
        else {
            repo.update(app, function (err) {
                if (err) return cb(err);
                restartAndOk();
            });
        }
    }

    // launch the configuration API
    function startAPI (port) {
        var app = express();
        app.enable("trust proxy");
        app.enable("case sensitive routing");

        // middleware
        app.use(express.logger());
        app.use(express.bodyParser());

        // security
        var internalIPs = {}
        ,   ifaces = os.networkInterfaces()
        ;
        for (var k in ifaces) {
            for (var i = 0, n = ifaces[k].length; i < n; i++) {
                var address = ifaces[k][i];
                if (address.internal) internalIPs[address.address] = true;
            }
        }
        app.use(function (req, res, next) {
            if (conf.security === "none") return next();
            if (!internalIPs[req.ip]) {
                return res.send(403, "You are not allowed to connect to this service.");
            }
            next();
        });

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
                if (!desc.dependencies) desc.dependencies = {};
                if (!desc.environment) desc.environment = "dev";
                if (!desc.scripts) desc.scripts = {};
                if (!desc.scripts.start) desc.scripts.start = "app.js";
            }
            desc.running = apps[name] ? apps[name].running : false;
            apps[name] = desc;
            desc.name = name;
            desc.storePath = pth.join(conf.store, name);
            desc.configPath = pth.join(desc.storePath, "config.json");
            desc.runningPath = pth.join(desc.storePath, "RUNNING");
            desc.contentPath = pth.join(desc.storePath, "content");
            if (!desc.static) desc.startPath = pth.join(desc.contentPath, desc.scripts.start);
            updateApp(desc, simpleResponse(res));
        });

        // DELETE /app/app-name
        // stops and deletes the app
        app.del("/app/:name", pickApp, function (req, res) {
            var app = req.bevyApp;
            stopApp(app, function (err) {
                if (err) return res.json(500, { error: "Failed to stop app, cannot remove: " + err });
                utile.rimraf(app.storePath, function (err) {
                    if (err) return res.json(500, { error: "Failed to remove app: " + err });
                    delete apps[app.name];
                    res.json({ ok: true });
                });
            });
        });

        app.listen(port);

        // load existing apps from store
        //  the store is created if it doesn't exist
        //  inside the store, each directory that contains a "config.json" is an app
        //  if the app directory contains a "RUNNING" file, then it's running
        //  the app directory has a content directory that's the app's content and has a name that
        //      depends on the repo type
        if (!fs.existsSync(conf.store)) fs.mkdirSync(conf.store);
        fs.readdir(conf.store, function (err, files) {
            if (err) return error("Failed to read directory " + conf.store, err);
            files.forEach(function (name) {
                var dir = pth.join(conf.store, name);
                fs.stat(dir, function (err, stat) {
                    if (err) return error("Failed to stat directory " + dir, err);
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
                        if (running) spawnApp(appConfig);
                    });
                });
            });
            console.log("Bevy up, management API available on port(s) ", conf.ports);
        });
    }

    // add the local service as an app
    getPort(function (err, port) {
        if (err) return error("Failed to assign port", err);
        addAppRoute(conf.domain, port);
        startAPI(port);
    });
}

exports.run = function (conf) {
    return new Bevy(conf);
};
