browser.browserAction.onClicked.addListener(function() {
	browser.tabs.create({
	  "url": "https://s3.amazonaws.com/aws-s3-tool.xinjian.io/index.html"
	});
});