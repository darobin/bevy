
var pth = require("path")
,   fs = require("fs")
;

// die on error
exports.die = function (msg) {
    console.log("[ERROR]", msg);
    process.exit(1);
};

// show usage
exports.usage = function (usage, marker) {
    console.log("Usage: " + usage + "\n");
    var README = fs.readFileSync(pth.join(__dirname, "../README.md"), "utf8");
    README = README.replace(new RegExp("[\\S\\s]*<!--\\s*" + marker + "\\s*usage\\s*-->"), "")
                   .replace(new RegExp("<!--\\s*\\/" + marker + "\\s*usage\\s*-->[\\S\\s]*"), "")
                   .replace(/```/g, "");
    var options = README.split(/^\* /m);
    options.shift();
    var rex = /^([^:]+):\s*([\S\s]+)/;
    options.forEach(function (opt) {
        var matches = rex.exec(opt)
        ,   prms = matches[1].split(", ")
        ,   out = []
        ;
        prms.forEach(function (prm) {
            if (prm.indexOf("-") > -1) out.push(prm);
        });
        console.log("\t* " + out.join(", ") + ": " + matches[2]);
    });
    process.exit(0);
};
