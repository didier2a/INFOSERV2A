(function () {
  var params = new URLSearchParams(window.location.search);
  var enabled = params.get('ref') === '1' || params.get('debugRef') === '1';
  var file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var map = {
    '': 'idweb-ref-index',
    'index.html': 'idweb-ref-index',
    'cyber.html': 'idweb-ref-cyber',
    'reseau.html': 'idweb-ref-reseau',
    'secteurs-sensibles.html': 'idweb-ref-secteurs',
    'methode.html': 'idweb-ref-methode',
    'a-propos.html': 'idweb-ref-apropos',
    'contact.html': 'idweb-ref-contact'
  };
  var cls = map[file];
  if (enabled && cls) {
    document.body.classList.add('idweb-debug-reference', cls);
  }
  document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r' && cls) {
      document.body.classList.toggle('idweb-debug-reference');
      document.body.classList.add(cls);
    }
  });
})();
