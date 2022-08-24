console.log(`StarShell.ics-link: Launched on <${location.href}>`);

(function() {
	const {qs, dd, uuid_v4} = inline_require('#/util/dom.ts');

	function init() {
		document.body.innerHTML = '';
		document.body.style = 'margin:0;';

		const dm_iframe = dd('iframe', {
			src: `${chrome.runtime.getURL('src/entry/flow.html')}?${new URLSearchParams(Object.entries({
				comm: 'query',
				key: uuid_v4(),
				data: JSON.stringify({
					type: 'deepLink',
					value: {
						url: location.href,
					},
				}),
			})).toString()}`,
			style: `
				margin: 0;
				padding: 0;
				width: 100%;
				height: 100%;
				border: none;
			`,
		});

		document.body.appendChild(dm_iframe);
	}

	window.addEventListener('DOMContentLoaded', () => {
		init();
	});
})();
