/*jshint es5: true*/
/*global before, after, describe*/

var expect = require("expect.js")
,   pth = require("path")
,   fs = require("fs")
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

before(function (done) {
    cleanup(function (err) {
        if (err) throw err;
        fs.mkdir(repoPath, function (err) {
            if (err) throw err;
            done();
        });
    });
});
after(cleanup);

describe("Repository basics", function () {
    it("Errors for non-git content", function (done) {
        repo.update({ repository: { type: "goop" }}, {}, function (err) {
            expect(err).to.equal("Unknown repository type: goop");
            done();
        });
    });
    it("Clones a repository with the right session behaviour", function (done) {
        this.timeout(10000);
        var app = {
            repository: {
                type:   "git"
            ,   url:    "https://github.com/darobin/bevy-test-repo.git"
            ,   branch: "repo-test"
            }
        ,   contentPath:    pth.join(repoPath, "content")
        ,   storePath:      repoPath
        };
        var seenProgress = false
        ,   seenEnd = false
        ;
        var session = repo.update(app, {}, function (err) {
            expect(err).to.not.be.ok();
            expect(seenProgress).to.be.ok();
            expect(seenEnd).to.be.ok();
            expect(session.messages()).to.be.ok();
            expect(session.messages().length).to.equal(0);
            // we have the right git content
            // we have the npm dependencies
            // app.repository.branch is used
            done();
        });
        session.on("progress", function () {
            seenProgress = true;
        });
        session.on("end", function () {
            seenEnd = true;
        });
        expect(session.id).to.match(/^\w+$/);
        expect(session.done).to.not.be.ok();
        expect(session.queue.length).to.equal(0);
    });
});
