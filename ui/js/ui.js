
(function ($) {
    var $services = $("#services")
    ,   tmplService = $("#tmpl-service").text()
    ,   $tmp = $("<div></div>")
    ;

    // get the version at start
    $.getJSON("/version", function (data) {
        $("#brand").text("Bevy / " + data.bevy);
    });

    // append a service to the list
    function appendService (serv) {
        var $tmpl = $tmp.html(tmplService).children().first().clone();
        $tmpl.find("h4")
                .text(serv.name + " (" + serv.domain + ")")
             .end()
             .attr({ "data-name": serv.name })
             .addClass(serv.running ? "panel-info" : "panel-warning")
             .addClass(serv.running ? "running" : "not-running")
             .appendTo($services)
        ;
        // XXX
        // env
        // static
        // repository
        //      local + path
        //      git + url + branch
        //  storePath
        
    }
    
    // (re)load list of services
    function loadServices () {
        $services.html("<p><b class='glyphicon glyphicon-cloud-download'></b> Loading services\u2026</p>");
        $.getJSON("/apps", function (data) {
            // console.log(data);
            $services.empty();
            var keys = [];
            for (var k in data) keys.push(k);
            keys.sort();
            for (var i = 0, n = keys.length; i < n; i++) appendService(data[keys[i]]);
        });
    }
    $("#reload").click(loadServices);
    loadServices();
    
    // add a service
    $("#add").click(function () {
        alert("Add not supported");
    });
    
    function getName ($el) {
        return $el.parents(".service").attr("data-name");
    }
    $services.on("click", "[data-action=delete]", function () {
        var name = getName($(this));
        alert("Delete not supported on " + name);
    });
    $services.on("click", "[data-action=edit]", function () {
        var name = getName($(this));
        alert("Edit not supported on " + name);
    });
    $services.on("click", "[data-action=start]", function () {
        var name = getName($(this));
        alert("Start not supported on " + name);
    });
    $services.on("click", "[data-action=stop]", function () {
        var name = getName($(this));
        alert("Stop not supported on " + name);
    });
    $services.on("click", "[data-action=update]", function () {
        var name = getName($(this));
        alert("Update not supported on " + name);
    });
}(jQuery));

