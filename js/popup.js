// run this function once the popup has loaded
window.onload = function() {
    // get the background page so we can get the comment id for the current page
    var bgPage = chrome.extension.getBackgroundPage();
    console.log("Got comment id: " + bgPage.COMMENT_ID);

    // if the page has comments, update the popup
    if (bgPage.COMMENT_ID >= 0) {
        // load the page in an iframe in the extension popup using the comment id
        var iframe = document.createElement("iframe");
        console.log("Created iframe in document");

        iframe.src = "http://news.ycombinator.com/item?id=" + bgPage.COMMENT_ID;
        iframe.width = "120%";
        iframe.height = "103%";

        // append the iframe to the popup body
        console.log("Adding iframe with address '" + iframe.src + "'");
        document.body.appendChild(iframe);
    }
}
