
var send = require("send")
,   http = require("http")
,   url = require("url")
,   fs = require("fs")
,   port = process.env.PORT
,   root = process.env.BEVY_ROOT
,   conf = process.env.BEVY_CONFIG ? JSON.parse(fs.readFileSync(process.env.BEVY_CONFIG, "utf8")) : {}
,   version = require("../package.json").version
;

if (!port || !root) {
    console.log("Missing port and root (environment PORT and BEVY_ROOT).");
    process.exit(1);
}

var app = http.createServer(function (req, res) {
    // identify self
    res.setHeader("Server", "Bevy/" + version);
    
    // simple error handler
    function error(err) {
        res.statusCode = err.status || 500;
        res.end(err.message);
    }

    // properly redirect to directories
    function redirectDir () {
        res.statusCode = 301;
        res.setHeader("Location", req.url + "/");
        res.end("Redirecting to " + req.url + "/");
    }

    // run!
    send(req, url.parse(req.url).pathname)
        .root(root)
        .on("error", error)
        .on("directory", redirectDir)
        .index(conf.directoryIndex || "index.html")
        .pipe(res);
});
app.on("error", function (err) {
    console.log("[ERROR]", err);
});
app.listen(port);
console.log("Static server listening on port", port, "at root", root);
