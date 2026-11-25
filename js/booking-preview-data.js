// Public demo catalog for the static booking preview.
window.BBBookingPreviewCatalog = {
  "packages": [
    {
      "id": 1,
      "name": "Little Bounce",
      "description": "Best for smaller birthday groups and easy setup.",
      "base_price": 0,
      "base_price_cents": null,
      "rental_hours": null,
      "inclusions": "[]"
    },
    {
      "id": 2,
      "name": "Ball Pit Bash",
      "description": "A soft pastel ball pit setup for toddlers and young kids.",
      "base_price": 0,
      "base_price_cents": null,
      "rental_hours": null,
      "inclusions": "[]"
    },
    {
      "id": 3,
      "name": "Bash & Bounce",
      "description": "A versatile bounce zone with extra party energy.",
      "base_price": 0,
      "base_price_cents": null,
      "rental_hours": null,
      "inclusions": "[]"
    },
    {
      "id": 4,
      "name": "The Luxe Bash",
      "description": "Premium décor-forward package with elevated styling.",
      "base_price": 0,
      "base_price_cents": null,
      "rental_hours": null,
      "inclusions": "[]"
    },
    {
      "id": 5,
      "name": "Classic White Castle — Demo rental",
      "description": "Synthetic demonstration offer; not an official company rate.",
      "base_price": 6500,
      "base_price_cents": 650000,
      "rental_hours": 4,
      "inclusions": "[\"4 rental hours\",\"Standard setup and pickup\",\"Ball-color choice included when applicable\"]"
    },
    {
      "id": 6,
      "name": "Boho Pastel Playground — Demo rental",
      "description": "Synthetic demonstration offer; not an official company rate.",
      "base_price": 5500,
      "base_price_cents": 550000,
      "rental_hours": 4,
      "inclusions": "[\"4 rental hours\",\"Standard setup and pickup\",\"Ball-color choice included when applicable\"]"
    },
    {
      "id": 7,
      "name": "Rainbow Racer Slide — Demo rental",
      "description": "Synthetic demonstration offer; not an official company rate.",
      "base_price": 7500,
      "base_price_cents": 750000,
      "rental_hours": 4,
      "inclusions": "[\"4 rental hours\",\"Standard setup and pickup\",\"Ball-color choice included when applicable\"]"
    },
    {
      "id": 8,
      "name": "Carnival Pop Castle — Demo rental",
      "description": "Synthetic demonstration offer; not an official company rate.",
      "base_price": 4500,
      "base_price_cents": 450000,
      "rental_hours": 4,
      "inclusions": "[\"4 rental hours\",\"Standard setup and pickup\",\"Ball-color choice included when applicable\"]"
    },
    {
      "id": 9,
      "name": "Pastel Ball Pit — Demo rental",
      "description": "Synthetic demonstration offer; not an official company rate.",
      "base_price": 3500,
      "base_price_cents": 350000,
      "rental_hours": 4,
      "inclusions": "[\"4 rental hours\",\"Standard setup and pickup\",\"Ball-color choice included when applicable\"]"
    }
  ],
  "addOns": [
    {
      "id": 1,
      "name": "Ball colors",
      "description": null,
      "unit_price_cents": 0,
      "max_quantity": 20
    },
    {
      "id": 3,
      "name": "Balloon arch",
      "description": null,
      "unit_price_cents": 40000,
      "max_quantity": 20
    },
    {
      "id": 4,
      "name": "Backdrop & signage",
      "description": null,
      "unit_price_cents": 80000,
      "max_quantity": 20
    }
  ],
  "zones": [
    {
      "id": 1,
      "slug": "dry",
      "name": "Dry Zone"
    },
    {
      "id": 2,
      "slug": "splash",
      "name": "Splash Zone"
    },
    {
      "id": 3,
      "slug": "ball-pit",
      "name": "Ball Pit Zone"
    }
  ],
  "models": [
    {
      "id": 1,
      "zone_id": 1,
      "name": "Classic White Castle",
      "description": "Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.",
      "capacity": 10,
      "image_url": "/assets/photos/classic-white-castle-balloon-garland.jpg",
      "is_active": 1,
      "booking_package_id": 5,
      "includes_balls": 1,
      "is_demo": 1
    },
    {
      "id": 2,
      "zone_id": 1,
      "name": "Boho Pastel Playground",
      "description": "Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.",
      "capacity": 12,
      "image_url": "/assets/photos/child-playing-cream-bounce-house.jpg",
      "is_active": 1,
      "booking_package_id": 6,
      "includes_balls": 1,
      "is_demo": 1
    },
    {
      "id": 3,
      "zone_id": 2,
      "name": "Rainbow Racer Slide",
      "description": "Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.",
      "capacity": 12,
      "image_url": "/assets/photos/rainbow-racer-slide-colorful.jpg",
      "is_active": 1,
      "booking_package_id": 7,
      "includes_balls": 0,
      "is_demo": 1
    },
    {
      "id": 4,
      "zone_id": 1,
      "name": "Carnival Pop Castle",
      "description": "Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.",
      "capacity": 12,
      "image_url": "/assets/photos/carnival-pop-castle-ball-pit.jpg",
      "is_active": 1,
      "booking_package_id": 8,
      "includes_balls": 0,
      "is_demo": 1
    },
    {
      "id": 5,
      "zone_id": 3,
      "name": "Pastel Ball Pit",
      "description": "Synthetic demo listing. Photo is illustrative; confirm real equipment specifications before live use.",
      "capacity": 8,
      "image_url": "/assets/photos/kids-in-ball-pit-pastel.jpg",
      "is_active": 1,
      "booking_package_id": 9,
      "includes_balls": 1,
      "is_demo": 1
    }
  ],
  "variants": [
    {
      "id": 1,
      "model_id": 1,
      "name": "White",
      "is_active": 1
    },
    {
      "id": 2,
      "model_id": 1,
      "name": "Cream",
      "is_active": 1
    },
    {
      "id": 3,
      "model_id": 2,
      "name": "Pastel",
      "is_active": 1
    },
    {
      "id": 4,
      "model_id": 2,
      "name": "Neutral",
      "is_active": 1
    },
    {
      "id": 5,
      "model_id": 3,
      "name": "Joyful colors",
      "is_active": 1
    },
    {
      "id": 6,
      "model_id": 3,
      "name": "Blue / yellow",
      "is_active": 1
    },
    {
      "id": 7,
      "model_id": 4,
      "name": "Carnival colors",
      "is_active": 1
    },
    {
      "id": 8,
      "model_id": 4,
      "name": "Red / blue",
      "is_active": 1
    },
    {
      "id": 9,
      "model_id": 5,
      "name": "White",
      "is_active": 1
    },
    {
      "id": 10,
      "model_id": 5,
      "name": "Cream",
      "is_active": 1
    }
  ],
  "packageModels": [
    {
      "package_id": 5,
      "model_id": 1
    },
    {
      "package_id": 6,
      "model_id": 2
    },
    {
      "package_id": 7,
      "model_id": 3
    },
    {
      "package_id": 8,
      "model_id": 4
    },
    {
      "package_id": 9,
      "model_id": 5
    }
  ],
  "options": [],
  "cities": [
    {
      "id": "quezon-city",
      "name": "Quezon City",
      "delivery_cents": 20000
    },
    {
      "id": "caloocan",
      "name": "Caloocan",
      "delivery_cents": 30000
    },
    {
      "id": "las-pinas",
      "name": "Las Piñas",
      "delivery_cents": 40000
    },
    {
      "id": "makati",
      "name": "Makati",
      "delivery_cents": 40000
    },
    {
      "id": "malabon",
      "name": "Malabon",
      "delivery_cents": 30000
    },
    {
      "id": "mandaluyong",
      "name": "Mandaluyong",
      "delivery_cents": 30000
    },
    {
      "id": "manila",
      "name": "Manila",
      "delivery_cents": 30000
    },
    {
      "id": "marikina",
      "name": "Marikina",
      "delivery_cents": 30000
    },
    {
      "id": "muntinlupa",
      "name": "Muntinlupa",
      "delivery_cents": 40000
    },
    {
      "id": "navotas",
      "name": "Navotas",
      "delivery_cents": 40000
    },
    {
      "id": "paranaque",
      "name": "Parañaque",
      "delivery_cents": 40000
    },
    {
      "id": "pasay",
      "name": "Pasay",
      "delivery_cents": 40000
    },
    {
      "id": "pasig",
      "name": "Pasig",
      "delivery_cents": 30000
    },
    {
      "id": "pateros",
      "name": "Pateros",
      "delivery_cents": 40000
    },
    {
      "id": "san-juan",
      "name": "San Juan",
      "delivery_cents": 30000
    },
    {
      "id": "taguig",
      "name": "Taguig",
      "delivery_cents": 40000
    },
    {
      "id": "valenzuela",
      "name": "Valenzuela",
      "delivery_cents": 30000
    }
  ],
  "colors": [
    "White",
    "Cream",
    "Champagne",
    "Blush",
    "Sage",
    "Lavender",
    "Sky Blue",
    "Yellow",
    "Red",
    "Royal Blue"
  ],
  "backdropEvents": [
    "Birthday",
    "Christening",
    "Baby Shower",
    "Graduation",
    "School Event",
    "Corporate Event",
    "Other"
  ],
  "extra_hour_cents": 60000
};
