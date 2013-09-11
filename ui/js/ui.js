/*jshint es5: true*/

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
        $tmpl.find("h4").text(serv.name + " (" + serv.domain + ")").end()
             .find(".env").text(serv.env).end()
             .find(".mode").text(serv.static ? "static" : "dynamic").end()
             .find(".path").text(serv.repository.path).end()
             .find(".url").text(serv.repository.url).end()
             .find(".branch").text(serv.repository.branch || "master").end()
             .find(serv.repository.type === "git" ? ".local" : ".git").remove().end()
             .find(".store").text(serv.storePath).end()
             .attr({ "data-name": serv.name })
             .addClass(serv.running ? "panel-info" : "panel-warning")
             .addClass(serv.running ? "running" : "not-running")
             .appendTo($services)
        ;
        if (serv.static && serv.repository.type === "local") {
            $tmpl.find("[data-action=update]").attr("disabled", "disabled");
        }
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
    
    function progress (title) {
        $("#info-title").text(title);
        $("#info-body").text("Operation in progress\u2026");
        $("#info").modal();
    }
    function error (title, message) {
        $("#info-title").text(title);
        $("#info-body").text(message);
        $("#info").modal();
    }
    function hideInfo () {
        $("#info").modal("hide");
    }
    
    function getParent ($el) {
        return $el.parents(".service");
    }
    function getName ($el) {
        return getParent($el).attr("data-name");
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
        var $el = $(this)
        ,   name = getName($el)
        ,   $parent = getParent($el)
        ;
        $parent.removeClass("panel-warning");
        $el.attr("disabled", "disabled");
        progress("Starting service");
        $.post("/app/" + name + "/start", function (data) {
            $el.removeAttr("disabled");
            if (data.error) {
                error("Failed to start service", data.error);
                $parent.addClass("panel-warning");
            }
            else {
                $parent.addClass("panel-info");
                $parent.removeClass("not-running");
                $parent.addClass("running");
                hideInfo();
            }
        }, "json");
    });
    $services.on("click", "[data-action=stop]", function () {
        var $el = $(this)
        ,   name = getName($el)
        ,   $parent = getParent($el)
        ;
        $parent.removeClass("panel-info");
        $el.attr("disabled", "disabled");
        progress("Stopping service");
        $.post("/app/" + name + "/stop", function (data) {
            $el.removeAttr("disabled");
            if (data.error) {
                error("Failed to stop service", data.error);
                $parent.addClass("panel-info");
            }
            else {
                $parent.addClass("panel-warning");
                $parent.removeClass("running");
                $parent.addClass("not-running");
                hideInfo();
            }
        }, "json");
    });
    $services.on("click", "[data-action=update]", function () {
        var name = getName($(this));
        alert("Update not supported on " + name);
    });
}(jQuery));

