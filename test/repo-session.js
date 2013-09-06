/*global before, after, describe*/

var expect = require("expect.js")
,   pth = require("path")
// ,   fs = require("fs")
,   repo = require("../lib/repo")
,   utile = require("utile")
,   repoPath = pth.join(__dirname, "repo")
// ,   spawn = require("child_process").spawn
// ,   exec = require("child_process").exec
// ,   portfinder = require("portfinder")
// ,   request = require("request")
// ,   serverPath = pth.join(__dirname, "../bin/bevy-server.js")
// ,   bevyPath = pth.join(__dirname, "../bin/bevy.js")
// ,   version = require("../package.json").version
// ,   debug = false
// ,   WAIT = 750
// ,   server
// ,   deployPort
// ,   testDomain
// ,   api = "http://localhost:"
;

function cleanup (done) {
    utile.rimraf(repoPath, function (err) {
        if (err) throw err;
        done();
    });
}

before(cleanup);
after(cleanup);

describe("Repository basics", function () {
    it("Errors for non-git content", function (done) {
        repo.update({ repository: { type: "goop" }}, {}, function (err) {
            expect(err).to.equal("Unknown repository type: goop");
            done();
        });
    });
});

// returned session has id, done is false, empty queue
// session gets progress events
// session gets end event
// session messages returns something
// we have the right git content
// we have the npm dependencies
// app.repository.branch is used
