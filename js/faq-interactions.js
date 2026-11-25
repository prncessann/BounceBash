'use strict';
(function () {
    var input = document.getElementById('faq-search');
    var items = [].slice.call(document.querySelectorAll('#faq-list .faq-item'));
    var empty = document.getElementById('faq-empty');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var match = item.textContent.toLowerCase().indexOf(q) > -1;
        item.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown > 0;
    });
  })();
