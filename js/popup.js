/*jslint white: true, undef: true, newcap: true, nomen: true, regexp: true, plusplus: true, bitwise: true, browser: true, devel: true, maxerr: 50, maxlen: 0, indent: 4 */
/*global chrome: false */

// fill the popup with the comment page for the currently selected tab
var updatePopup = function () {
    // get the background page so we can get the item id for the current page
    var bgPage = chrome.extension.getBackgroundPage();

    // get the item id for the currently selected tab
    var itemId = bgPage.ITEM_CACHE[bgPage.CURRENT_TAB_ID];
    console.log("Got item id " + itemId + " for tab id " +
            bgPage.CURRENT_TAB_ID);

    // error on invalid item id
    if (itemId < 0) {
        console.error("Can't load comment thread, invalid item id " + itemId);
        return;
    }

    // base URL for HN comment threads
    var hnItemURL = "http://news.ycombinator.com/item?id=";

    // download HN comments page for the item
    var req = new XMLHttpRequest();
    req.open("GET", hnItemURL + itemId, false);
    req.send(null);

    if (req.status !== 200) {
        console.error("Failed to download '" + hnItemURL + itemId + "'");
        return;
    }

    // insert the downloaded HTML content into the local content div
    var contentDiv = document.getElementById("content");
    contentDiv.innerHTML = req.responseText;

    // used to re-link all relative links in the document
    var ycBaseURL = "http://news.ycombinator.com/";

    // expression to replace all chrome's relative re-linking with our own
    var extensionPattern = "chrome-extension://[a-z]+/";
    var extensionRegex = new RegExp(extensionPattern);

    // replace old relative links with explicit ones. the only relative
    // links appear to be those linking to 'news.ycombinator.com/', so we
    // should be able to replace them without much trouble.
    var links = contentDiv.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
        var link = links[i];

        link.href = link.href.replace(extensionRegex, ycBaseURL);
    }

    // replace the 'add comment' form's action with a non-relative one
    var forms = contentDiv.getElementsByTagName("form");
    for (var i = 0; i < forms.length; i++) {
        var form = forms[i];

        form.action = form.action.replace(extensionRegex, ycBaseURL);
    }

    // replace all links within comments to have a target="_blank" line so
    // they'll open in tabs rather than in the popup itself.
    var spans = contentDiv.getElementsByTagName("span");
    for (var i = 0; i < spans.length; i++) {
        var span = spans[i];

        var c = span.attributes.getNamedItem("class");
        if (c != null && c.value == "comment") {
            var commentLinks = span.getElementsByTagName("a");

            // re-target all the links in each comment to new tabs
            for (var j = 0; j < commentLinks.length; j++) {
                var a = commentLinks[j];

                a.target = "_blank";
            }
        }
    }

    // eval the first script into the global context so we can vote, etc.
    var hnScript = contentDiv.getElementsByTagName("script")[0];
    var hnScriptSource = hnScript.innerText;
    window.eval.call(window, hnScriptSource);

    // make the main table take up (nearly) the entire width of the div
    contentDiv.getElementsByTagName("table")[0].width = "99%";
}

// run after load so we ensure that we've got all the appropriate DOM elements
window.onload = updatePopup;
