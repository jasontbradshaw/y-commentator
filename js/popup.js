// run this function once the popup has loaded
window.onload = function() {
    // get the background page so we can get the comment id for the current page
    var bgPage = chrome.extension.getBackgroundPage();

    // if the page has comments, update the popup
    if (bgPage.commentId >= 0) {
        // load the page in an iframe in the extension popup using the bg page's URL
        var iframe = document.createElement("iframe");
        iframe.src = "http://news.ycombinator.com/item?id=" + bgPage.commentId;
        iframe.width = "120%";
        iframe.height = "103%";

        // append the iframe to the popup body
        document.body.appendChild(iframe);
    }
}
