/*jshint es5: true*/
/*global before, after, describe*/

var expect = require("expect.js")
,   pth = require("path")
,   fs = require("fs")
,   spawn = require("child_process").spawn
,   exec = require("child_process").exec
,   portfinder = require("portfinder")
,   request = require("request")
// ,   prompt = require("prompt")
,   utile = require("utile")
,   serverPath = pth.join(__dirname, "../bin/bevy-server.js")
,   bevyPath = pth.join(__dirname, "../bin/bevy.js")
,   storePath = pth.join(__dirname, "store")
,   version = require("../package.json").version
,   debug = false
,   WAIT = 750
,   server
,   deployPort
,   testDomain
,   api = "http://localhost:"
;

before(function (done) {
    this.timeout(0);
    utile.rimraf(storePath, function (err) {
        if (err) throw err;
        portfinder.getPort(function (err, port) {
            if (err) throw err;
            api += port + "/";
            deployPort = port;
            var serverOpt = ["-d", "localhost"
                        ,    "-p", port
                        ,    "-s", storePath
                        ];
            if (process.getuid) {
                serverOpt.push("-u");
                serverOpt.push(process.getuid());
            }
            if (process.getgid) {
                serverOpt.push("-g");
                serverOpt.push(process.getgid());
            }
            if (debug) console.log("SERVER OPTIONS:", serverOpt.join(" "));
            server = spawn(serverPath, serverOpt);
            if (debug) {
                server.stdout.on("data", function (data) { console.log("[SERVER OUT]", data.toString()); });
                server.stderr.on("data", function (data) { console.log("[SERVER OUT]", data.toString()); });
                server.on("exit", function (code, sig) { console.log("[SERVER EXIT]", code, sig); });
                server.on("error", function (err) { console.log("[SERVER ERROR]", err); });
            }
            var seen = false;
            server.stdout.on("data", function () {
                if (seen) return;
                seen = true;
                testDomain = process.env.BEVY_DOMAIN || "127.0.0.1";
                done();
                // if (process.env.BEVY_DOMAIN) {
                //     testDomain = process.env.BEVY_DOMAIN;
                //     done();
                // }
                // else {
                //     console.log("In order to test this, we need a domain pointing to this machine other than 'localhost'.");
                //     console.log("You can also set the BEVY_DOMAIN environment variable to avoid this prompt.");
                //     prompt.start();
                //     prompt.get(["domain"], function (err, res) {
                //         if (err) throw(err);
                //         testDomain = res.domain;
                //         done();
                //     });
                // }
            });
        });
    });
});

after(function (done) {
    if (server) server.kill("SIGTERM");
    done();
});


describe("Server basics", function () {
    it("creates a store", function () {
        expect(fs.existsSync(storePath)).to.be.ok();
    });
    
    it("starts a basic server", function (done) {
        request.get(api,function (err, res, body) {
            body = JSON.parse(body);
            expect(body.bevy).to.equal(version);
            done();
        });
    });
    
    it("has no apps", function (done) {
        request.get(api + "apps", function (err, res, body) {
            expect(err).to.be(null);
            body = JSON.parse(body);
            var count = 0;
            for (var k in body) if (body.hasOwnProperty(k)) count++;
            expect(count).to.equal(0);
            done();
        });
    });
});

describe("Static server", function () {
    var oldDir = process.cwd();
    before(function (done) {
        var staticDir = pth.join(__dirname, "static");
        process.chdir(staticDir);
        exec(bevyPath + " deploy --deploy " + api + " --path " + staticDir + " --domain " + testDomain, function (err, stdout, stderr) {
            if (stdout && debug) console.log("[STDOUT]", stdout);
            if (stderr && debug) console.log("[STDERR]", stderr);
            setTimeout(done, WAIT); // wait a bit because it can take a little while to spawn
        });
    });
    after(function (done) {
        exec(bevyPath + " remove --deploy " + api, function (err, stdout, stderr) {
            if (stdout && debug) console.log("[STDOUT]", stdout);
            if (stderr && debug) console.log("[STDERR]", stderr);
            process.chdir(oldDir);
            done();
        });
    });
    it("serves basic content", function (done) {
        request.get("http://" + testDomain + ":" + deployPort, function (err, res, body) {
            expect(err).to.be(null);
            expect(body).to.equal("<h1>ohai!</h1>");
            done();
        });
    });
    it("shows up in list of apps", function (done) {
        request.get(api + "apps", function (err, res, body) {
            expect(err).to.be(null);
            body = JSON.parse(body);
            expect(body.static).to.be.ok();
            expect(body.static.running).to.be.ok();
            done();
        });
    });
    it("stops", function (done) {
        request.get(api + "app/static/stop", function (err) {
            expect(err).to.be(null);
            request.get(api + "apps", function (err, res, body) {
                expect(err).to.be(null);
                body = JSON.parse(body);
                expect(body.static).to.be.ok();
                expect(body.static.running).to.be(false);
                done();
            });
        });
    });
    it("restarts", function (done) {
        request.get(api + "app/static/start", function (err) {
            expect(err).to.be(null);
            request.get(api + "apps", function (err, res, body) {
                expect(err).to.be(null);
                body = JSON.parse(body);
                expect(body.static).to.be.ok();
                expect(body.static.running).to.ok();
                done();
            });
        });
    });
});

describe("Dynamic server", function () {
    this.timeout(20000);
    var oldDir = process.cwd();
    before(function (done) {
        var appDir = pth.join(__dirname, "gitapp");
        process.chdir(appDir);
        console.log("    This can take a little while...");
        exec(bevyPath + " deploy --deploy " + api + " --url " + appDir + " --domain " + testDomain, function (err, stdout, stderr) {
            if (stdout && debug) console.log("[STDOUT]", stdout);
            if (stderr && debug) console.log("[STDERR]", stderr);
            setTimeout(done, WAIT); // wait a bit because it can take a little while to spawn
        });
    });
    after(function (done) {
        var runRemove = function () {
            exec(bevyPath + " remove --deploy " + api, function (err, stdout, stderr) {
                if (stdout && debug) console.log("[STDOUT]", stdout);
                if (stderr && debug) console.log("[STDERR]", stderr);
                process.chdir(oldDir);
                done();
            });
        };
        if (debug) {
            request.get(api + "apps", { json: true }, function (err, res, body) {
                console.log(JSON.stringify(body, null, 4));
                runRemove();
            });
        }
        else {
            runRemove();
        }
    });
    it("serves basic content", function (done) {
        request.get("http://" + testDomain + ":" + deployPort, function (err, res, body) {
            expect(err).to.be(null);
            expect(body).to.equal("<h1>dynamic ohai!</h1>");
            done();
        });
    });
    it("shows up in list of apps", function (done) {
        request.get(api + "apps", function (err, res, body) {
            expect(err).to.be(null);
            body = JSON.parse(body);
            expect(body.gitapp).to.be.ok();
            expect(body.gitapp.running).to.be.ok();
            done();
        });
    });
    it("stops", function (done) {
        request.get(api + "app/gitapp/stop", function (err) {
            expect(err).to.be(null);
            request.get(api + "apps", function (err, res, body) {
                expect(err).to.be(null);
                body = JSON.parse(body);
                expect(body.gitapp).to.be.ok();
                expect(body.gitapp.running).to.be(false);
                done();
            });
        });
    });
    it("restarts", function (done) {
        request.get(api + "app/gitapp/start", function (err) {
            expect(err).to.be(null);
            request.get(api + "apps", function (err, res, body) {
                expect(err).to.be(null);
                body = JSON.parse(body);
                expect(body.gitapp).to.be.ok();
                expect(body.gitapp.running).to.ok();
                done();
            });
        });
    });
});
