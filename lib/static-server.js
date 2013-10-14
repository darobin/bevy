
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
    var pathname = url.parse(req.url).pathname;
    
    // identify self
    res.setHeader("Server", "Bevy/" + version);
    
    // simple error handler
    function error (err) {
        res.statusCode = err.status || 500;
        res.end(err.message);
    }

    function esc (str) {
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/'/g, "&#39;")
                  ;
    }

    // render directory
    function renderDir (path) {
        console.log("Dir is ", path);
        var html = "<!DOCTYPE html><html><head><title>{{title}}</title></head><body>" +
                   "<h1>{{title}}</h1><nav><ul>{{content}}</ul></nav></body></html>"
                   .replace(/\{\{title\}\}/g, "Directory: " + pathname);
        fs.readdir(path, function (err, files) {
            if (err) return error(err);
            var content = "";
            for (var i = 0, n = files.length; i < n; i++) {
                var file = files[i];
                content += "<li><a href='" + esc(file) + "'>" + esc(file) + "</a></li>";
            }
            html = html.replace(/\{\{content\}\}/g, content);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(html);
        });
    }

    // run!
    send(req, pathname)
        .on("error", error)
        .root(root)
        .on("directory", renderDir)
        .index(conf.directoryIndex || "index.html")
        .pipe(res);
});
app.on("error", function (err) {
    console.log("[ERROR]", err);
});
app.listen(port);
console.log("Static server listening on port", port, "at root", root);
