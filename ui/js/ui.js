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
    // XXX if there is "to" it's a proxy, we're not handling that
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
             .data("bevy", serv)
             .appendTo($services)
        ;
        if (serv.repository.type === "local") {
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
        edit();
    });
    
    function progress (title) {
        var $body = $("#info-body")
        ,   $title = $("#info-title")
        ;
        $title.text(title);
        $body.text("Operation in progress\u2026");
        $("#info").modal();
        var $pre;
        return {
            log:    function (msg) {
                if (!$pre) {
                    $body.html("<pre></pre>");
                    $pre = $body.find("pre");
                }
                $pre.append(document.createTextNode(msg));
            }
        ,   title:  function (tit) {
                $title.text(tit);
            }
        };
    }
    function success (title, message) {
        $("#info-title").text(title);
        $("#info-body").text(message);
        $("#info").modal();
    }
    function error (title, message) {
        $("#info-title").text(title);
        $("#info-body").text(message);
        $("#info").modal();
    }
    // function hideInfo () {
    //     $("#info").modal("hide");
    // }
    function edit ($el) {
        var data = $el ? $el.data("bevy") : {};
        $("#edit-title").text(data ? "Edit Service" : "Add Service");
        $("#edit").modal();
        $("#edit-body").load("/ui/app-form.html", function () {
            // XXX
            // populate it (when loaded)
            // on save just PUT (check what's needed to update an existing service)
            // if there's an element, its status changes while updating (maintain running or not status)
            // and after success it gets updated
            // otherwise just grab where it goes in the list, insert there, and scroll to it
        });
        // alert("Edit not supported.");
    }
    
    function getParent ($el) {
        return $el.parents(".service");
    }
    function getName ($el) {
        return getParent($el).attr("data-name");
    }
    // XXX
    $services.on("click", "[data-action=delete]", function () {
        var name = getName($(this));
        alert("Delete not supported on " + name);
    });
    // EDIT
    $services.on("click", "[data-action=edit]", function () {
        edit(getParent($(this)));
    });
    // START
    $services.on("click", "[data-action=start]", function () {
        var $el = $(this)
        ,   name = getName($el)
        ,   $parent = getParent($el)
        ;
        $parent.removeClass("panel-warning");
        $el.attr("disabled", "disabled");
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
            }
        }, "json");
    });
    // STOP
    $services.on("click", "[data-action=stop]", function () {
        var $el = $(this)
        ,   name = getName($el)
        ,   $parent = getParent($el)
        ;
        $parent.removeClass("panel-info");
        $el.attr("disabled", "disabled");
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
            }
        }, "json");
    });
    // UPDATE
    $services.on("click", "[data-action=update]", function () {
        var $el = $(this)
        ,   name = getName($el)
        ;
        $el.attr("disabled", "disabled");
        var prog = progress("Updating service");
        $.post("/app/" + name + "/update", function (data, status, xhr) {
            console.log(data, status, xhr);
            $el.removeAttr("disabled");
            if (data.error) {
                error("Failed to update service", data.error);
            }
            else {
                if (xhr.status === 200) {
                    success("Update successful", "The application has been immediately updated.");
                }
                else if (xhr.status === 202) {
                    var url = "/session/" + data.id
                    ,   poll = $.getJSON(url, function (data) {
                            if (data.error) return error("Session error in update", data.error);
                            if (data.done) {
                                prog.title("Update done");
                                prog.log("\nDONE.");
                                return;
                            }
                            for (var i = 0, n = data.messages.length; i < n; i++) {
                                var msg = data.messages[i];
                                if (msg[0] === "error") prog.log("\n[ERROR] " + msg[1]);
                                if (msg[0] === "end") prog.log("\nSession terminating.");
                                else prog.log(msg[1]);
                            }
                            setTimeout(poll, 1000);
                        });
                    poll();
                }
                else {
                    error("Update issue", "Unknown update response code: "+ xhr.status);
                }
            }
        }, "json");
    });
}(jQuery));

