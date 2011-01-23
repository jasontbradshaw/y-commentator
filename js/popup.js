// runs after load so we ensure that we've got all the appropriate DOM elements
window.onload = function() {
    // get the background page so we can get the item id for the current page
    var bgPage = chrome.extension.getBackgroundPage();

    // get the item id for the currently selected tab
    var itemId = bgPage.ITEM_CACHE[bgPage.CURRENT_TAB_ID];
    console.log("Got item id " + itemId + " for tab id " +
            bgPage.CURRENT_TAB_ID);

    // if the page had comments, update the popup
    if (itemId >= 0) {
        // base URL for HN comment threads
        var hnItemURL = "http://news.ycombinator.com/item?id=";

        // download HN comments page for the item
        var req = new XMLHttpRequest();
        req.open("GET", hnItemURL + itemId, false);
        req.send(null);

        if (req.status != 200) {
            console.error("Failed to download '" + hnItemURL + itemId + "'");
            return;
        }

        // insert the downloaded HTML content into the local content div
        var contentDiv = document.getElementById("content");
        contentDiv.innerHTML = req.responseText;

        // replace old relative links with explicit ones. the only relative
        // links appear to be those linking to 'news.ycombinator.com/', so we
        // should be able to replace them without much trouble.
        var links = contentDiv.getElementsByTagName("a");
        for (var i = 0; i < links.length; i++) {
            link = links[i];

            // replace all chrome's relative re-linking with our own
            var ycBaseURL = "http://news.ycombinator.com/";
            var extensionPattern = "chrome-extension://[A-Za-z0-9_]+/";
            var extensionRegex = new RegExp(extensionPattern);
            
            link.href = link.href.replace(extensionRegex, ycBaseURL);
        }

        // eval the first script into the global context so we can vote, etc.
        var hnScript = contentDiv.getElementsByTagName("script")[0];
        var hnScriptSource = hnScript.innerText;
        window.eval.call(window, hnScriptSource);

        // make the main table take up (nearly) the entire width of the div
        contentDiv.getElementsByTagName("table")[0].width = "99%";
    }
    else {
        console.error("Can't load comment thread, invalid item id " + itemId);
    }
}
