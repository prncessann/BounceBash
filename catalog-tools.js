'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const featured = document.getElementById('featured-rentals');
  const page = location.pathname.split('/').pop();
  if (!featured && !['rentals.html', 'packages.html', 'add-ons.html'].includes(page)) return;

  const grid = featured || document.createElement('div');
  if (!featured) {
    grid.className = 'rental-grid card-grid';
    grid.setAttribute('aria-live', 'polite');
    document.querySelectorAll('.zone,.package-card,.addon-card,.swatch-row,table').forEach(node => { node.hidden = true; });
    document.querySelector('.page-header').insertAdjacentElement('afterend', grid);
  }
  grid.textContent = 'Loading the current catalog…';

  function card(name, description, price, image, href) {
    const article = document.createElement('article');
    article.className = 'card rental-card';
    if (image) {
      const photo = document.createElement('img');
      photo.src = image;
      photo.alt = name;
      photo.loading = 'lazy';
      article.append(photo);
    }
    const heading = document.createElement('h3');
    heading.textContent = name;
    const summary = document.createElement('p');
    summary.textContent = description;
    const rate = document.createElement('strong');
    rate.textContent = price;
    const link = document.createElement('a');
    link.href = href;
    link.className = 'btn btn-book';
    link.textContent = 'Choose rental';
    article.append(heading, summary, rate, link);
    return article;
  }

  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Catalog unavailable');
    const catalog = await response.json();
    const format = new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP'});
    const money = cents => format.format(cents / 100);
    grid.replaceChildren();

    if (page === 'add-ons.html') {
      const details = {
        'Ball colors': ['Included with rentals containing balls.', 'kids-in-ball-pit-pastel.jpg'],
        'Balloon arch': ['Choose 1–3 colors and the number of arches.', 'classic-white-castle-balloon-garland.jpg'],
        'Backdrop & signage': ['Same price for every event type, including Other.', 'child-playing-cream-bounce-house.jpg'],
      };
      for (const option of catalog.addOns) {
        if (!details[option.name] || !Number.isInteger(option.unit_price_cents)) continue;
        const [description, photo] = details[option.name];
        const rate = '+' + money(option.unit_price_cents) + (option.name === 'Balloon arch' ? ' per arch' : '');
        grid.append(card(option.name, description, rate, '../assets/photos/' + photo, 'booking.html'));
      }
    } else {
      for (const model of catalog.models) {
        const links = catalog.packageModels.filter(link => link.model_id === model.id);
        const packageId = model.booking_package_id || (links.length === 1 ? links[0].package_id : null);
        const offer = catalog.packages.find(entry => entry.id === packageId);
        if (!offer || !links.some(link => link.package_id === packageId) ||
            !Number.isInteger(offer.base_price_cents) || !Number.isInteger(offer.rental_hours)) continue;
        grid.append(card(model.name, model.description || '', money(offer.base_price_cents) + ' / ' + offer.rental_hours + ' hours', model.image_url, 'booking.html?rentalId=' + model.id));
        if (featured && grid.childElementCount === 3) break;
      }
    }
    if (!grid.children.length) grid.textContent = 'The catalog is being configured. Please contact the team.';
  } catch {
    grid.textContent = 'The current catalog could not be loaded. Please refresh.';
  }
});

