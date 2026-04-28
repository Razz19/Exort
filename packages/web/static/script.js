(function () {
  const currentScript = document.currentScript;
  if (!currentScript) return;

  const remoteSrc = 'https://cloud.umami.is/script.js';
  const existing = document.querySelector(`script[src="${remoteSrc}"]`);
  if (existing) return;

  const remoteScript = document.createElement('script');
  remoteScript.defer = true;
  remoteScript.src = remoteSrc;

  for (const attribute of currentScript.attributes) {
    if (!attribute.name.startsWith('data-')) continue;
    remoteScript.setAttribute(attribute.name, attribute.value);
  }

  document.head.appendChild(remoteScript);
})();
