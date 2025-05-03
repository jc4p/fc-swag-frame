-- Schema based on docs/INITIAL_DB_PLAN.md

-- 1. products Table: Stores each T-shirt style
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    printful_product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
-- Note: UNIQUE constraint on slug implicitly creates an index

-- 2. product_variants Table: Tracks color variants and inventory
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_sku TEXT NOT NULL,
    size TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_code TEXT,
    printful_price REAL,
    inventory_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variant_sku) -- Unique constraint as per plan
);

-- Indexes for product_variants table
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id); 