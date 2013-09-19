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
        $("#edit-save").prop("disabled", false);
        $("#edit").modal();
        $("#edit-body").load("/app-form.html", function () {
            // here we add support for functionality that eventually Web Schema Forms will add
            $(".web-schema-type-switch > fieldset > legend > input[type=radio]").change(function () {
                $(this).parents(".web-schema-type-switch")
                       .first()
                       .find("> fieldset > legend > input[type=radio]")
                            .each(function () {
                                var $el = $(this);
                                $el.parents("fieldset")
                                   .first()
                                   .prop("disabled", !$el.prop("checked"))
                                   ;
                            });
            });
            // not sure why Bootstrap does this, killing it
            // $("#edit-save").prop("disabled", false);
            // XXX
            // populate it (when loaded)
        });
    }
    
    function save (data) {
        $("#edit-save").prop("disabled", true);
        $("#edit").modal("hide");
        // XXX
        //  if there is an element, switch its status (remove running/not-running + panel-info/panel-warning)
        $.ajax("/app/" + data.name, {
            data:   data
        ,   type:   "PUT"
        ,   success: function (data) {
                if (data.error) return error(data.error);
                // XXX
                // (re)generate the markup
                // if there's an element, replace it
                // otherwise insert at the proper location
                // scroll to the element
            }
        ,   error:  function () {
                // XXX
                //  re-show the dialog
                //  get better information out of the error
                error("Unknown error while saving");
            }
        });
    }
    
    function isArray (obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
    }

    function makeContainer (data, nextKey) {
        if (data) return data;
        if (typeof nextKey === "number") return [];
        return {};
    }

    function setPath (data, key, value) {
        var path = isArray(key) ? key : key.split(".")
        ,   nextKey = path.shift()
        ;
        if (/^\d+$/.test(nextKey)) nextKey = 1 * nextKey;
        var data = makeContainer(data, nextKey);
        if (path.length) {
            data[nextKey] = setPath(data[nextKey], path, value);
        }
        else {
            data[nextKey] = value;
        }
        return data;
    }
    
    function form2json ($form) {
        var data;
        $form.find("input, select, textarea")
             .each(function () {
                 var $control = $(this);
                 if ($control.prop("disabled") ||
                     $control.parents(":disabled").length ||
                     $control.attr("data-ignore") === "true") return;
                 var key = $control.attr("name") || $control.attr("id");
                 if (!key) return;
                 var value;
                 if ($control.is("[type=checkbox]")) {
                     if ($control.prop("checked") && $control.attr("value")) value = $control.attr("value");
                     else value = $control.prop("checked");
                 }
                 else if ($control.is("[type=radio]")) {
                     value = $control.prop("checked");
                 }
                 else {
                     value = $control.val();
                 }
                 data = setPath(data, key, value);
             });
        return data;
    }
    function editDone () {
        var $form = $("#edit form")
        ,   json = form2json($form);
        // XXX need to check validity
        console.log(json);
        save(json);
    }
    $("#edit-save").click(editDone);
    $("#edit form").submit(editDone);
    
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

