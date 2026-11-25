'use strict';
(function () {
  var PAGE = 9, filter = 'all', shown = PAGE;
  var items = [].slice.call(document.querySelectorAll('#gallery-grid a'));
  var btn = document.getElementById('load-more'), empty = document.getElementById('gallery-empty');
  function render() {
    var n = 0;
    items.forEach(function (a) {
      var ok = filter === 'all' || a.getAttribute('data-cat').split(' ').indexOf(filter) > -1;
      var vis = ok && n < shown;
      if (ok) n++;
      a.hidden = !vis;
    });
    btn.parentNode.hidden = n <= shown;
    empty.hidden = n > 0;
  }
  document.querySelectorAll('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-filter'); shown = PAGE;
      document.querySelectorAll('[data-filter]').forEach(function (o) {
        o.className = 'btn ' + (o === b ? 'btn-dark' : 'btn-outline');
      });
      render();
    });
  });
  btn.addEventListener('click', function () { shown += PAGE; render(); });
  render();
})();
