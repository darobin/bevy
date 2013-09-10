

(function ($) {
    $.getJSON("/version", function (data) {
        $("#brand").text("Bevy / " + data.bevy);
    });
}(jQuery));

