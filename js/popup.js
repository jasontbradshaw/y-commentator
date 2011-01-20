var req = new XMLHttpRequest();
req.open( "GET",
    "http://json.searchyc.com/domains/find?url=" +
            escape("http://explainextended.com/2010/12/31/happy-new-year-2/"),
    true);
req.onload = searchYC;
req.send(null);

function searchYC() {
    var results = JSON.parse(req.responseText);

    // only load a new page if there were any results
    if (results.length > 0) {
        // load the page in an iframe in the extension popup
        var iframe = document.createElement("iframe");
        iframe.src = "http://news.ycombinator.com/item?id=" + results[0].id;
        iframe.width = "120%";
        iframe.height = "103%";

        document.body.appendChild(iframe);
    }
}
