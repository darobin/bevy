
var forever = require("forever-monitor")
,   proxy = require("http-proxy")
,   utile = require("utile")
,   pth = require("path")
,   configPath = pth.join(process.cwd(), process.argv[2]) || "/etc/bevy/config.json"
;

// load configuration
var conf = utile.mixin({
    domain: "localhost"
,   ports:  [80]
,   store:  process.env.TMPDIR || "/var/tmp"
}, require(configPath));
if (!utile.isArray(conf.ports)) conf.ports = [conf.ports];



