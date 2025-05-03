-- Schema based on docs/INITIAL_DB_PLAN.md

-- 1. products Table: Stores each T-shirt style
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printful_product_id INTEGER UNIQUE NOT NULL,  -- The ID from Printful API
    name TEXT NOT NULL,                           -- e.g., "Unisex Garment-Dyed Heavyweight T-Shirt"
    slug TEXT UNIQUE NOT NULL,                    -- URL-friendly identifier, e.g., "unisex-heavyweight-tee"
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
-- Note: UNIQUE constraint on slug implicitly creates an index

-- 2. product_variants Table: Tracks color variants and inventory
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    printful_variant_id INTEGER UNIQUE NOT NULL, -- The variant ID from Printful API
    printful_product_id INTEGER NOT NULL,        -- Denormalized for easier lookups if needed
    color_name TEXT NOT NULL,                    -- e.g., "Black", "Berry"
    color_code TEXT NOT NULL,                    -- e.g., "#000000", "#8e5a7b"
    size TEXT NOT NULL,                          -- e.g., "S", "M", "L", "XL"
    printful_price REAL NOT NULL,                -- Base price from Printful for this variant (USD)
    inventory_count INTEGER NOT NULL DEFAULT 0,  -- Current stock level
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'out_of_stock', 'discontinued')),
    -- New fields for canvas editor
    template_image_url TEXT,                     -- URL for the base t-shirt shape/overlay image
    template_texture_url TEXT,                   -- Optional texture URL for specific variants (like heather)
    template_width INTEGER,                      -- Width of the template canvas (pixels)
    template_height INTEGER,                     -- Height of the template canvas (pixels)
    print_area_width INTEGER,                    -- Width of the printable area (pixels)
    print_area_height INTEGER,                   -- Height of the printable area (pixels)
    print_area_top INTEGER,                      -- Top offset of the print area (pixels)
    print_area_left INTEGER,                     -- Left offset of the print area (pixels)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for product_variants table
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- Trigger to update 'updated_at' timestamp on products table changes
CREATE TRIGGER products_update_timestamp
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Trigger to update 'updated_at' timestamp on product_variants table changes
CREATE TRIGGER product_variants_update_timestamp
AFTER UPDATE ON product_variants
FOR EACH ROW
BEGIN
    UPDATE product_variants SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Designs Table: Stores user-created designs.
CREATE TABLE designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fid INTEGER NOT NULL,                       -- Farcaster ID of the creator
    product_id INTEGER NOT NULL,                -- FK to products table
    variant_id INTEGER NOT NULL,                -- FK to product_variants table
    image_url TEXT NOT NULL,                    -- URL of the user-uploaded, transformed image stored in R2
    mockup_url TEXT,                            -- URL of the generated Printful mockup
    is_public BOOLEAN NOT NULL DEFAULT FALSE,   -- Whether the design is published and visible
    published_at DATETIME,                      -- Timestamp when the design was published
    royalty_percent INTEGER CHECK(royalty_percent >= 15 AND royalty_percent <= 30), -- Artist's royalty (15-30%)
    retail_price REAL,                          -- Calculated retail price at publish time
    artist_earn REAL,                           -- Calculated artist earnings per sale
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'mockup_generating', 'mockup_ready', 'published', 'error')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (variant_id) REFERENCES product_variants (id)
);

-- Index for faster lookups by FID
CREATE INDEX idx_designs_fid ON designs (fid);
-- Index for public feed
CREATE INDEX idx_designs_public_published ON designs (is_public, published_at DESC) WHERE is_public = TRUE;

-- Trigger to update 'updated_at' timestamp on designs table changes
CREATE TRIGGER designs_update_timestamp
AFTER UPDATE ON designs
FOR EACH ROW
BEGIN
    UPDATE designs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END; 