# Initial D1 Database Plan

This document outlines the core D1 schema for the T-shirt designer MVP, covering products, variants (colors), user designs, and (optionally) orders.

## 1. products
Stores each T-shirt style that can be offered.
- **id** INTEGER PRIMARY KEY AUTOINCREMENT
- **name** TEXT NOT NULL
- **slug** TEXT NOT NULL UNIQUE  
- **printful_product_id** TEXT NOT NULL  
- **status** TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived'))  
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

Indexes:
- UNIQUE(slug)
- INDEX idx_products_status(status)

## 2. product_variants
Tracks color variants and inventory for each product.
- **id** INTEGER PRIMARY KEY AUTOINCREMENT
- **product_id** INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
- **variant_sku** TEXT NOT NULL  
- **color_name** TEXT NOT NULL
- **color_code** TEXT    
- **inventory_count** INTEGER NOT NULL DEFAULT 0  
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP  

Indexes:
- UNIQUE(product_id, variant_sku)
- INDEX idx_variants_product(product_id)

## 3. designs
Records user-submitted designs linked to a product + variant.
- **id** INTEGER PRIMARY KEY AUTOINCREMENT
- **fid** INTEGER NOT NULL  
- **product_id** INTEGER NOT NULL REFERENCES products(id)
- **variant_id** INTEGER NOT NULL REFERENCES product_variants(id)
- **image_url** TEXT NOT NULL  
- **metadata** JSON             # transformation data, DPI, etc.
- **royalty_percent** INTEGER NOT NULL DEFAULT 15  # creator-chosen royalty % (between 15 and 30)
- **retail_price** NUMERIC NOT NULL                # computed retail price in USD
- **platform_fee** NUMERIC NOT NULL DEFAULT 4      # fixed platform fee in USD
- **artist_earn** NUMERIC NOT NULL                 # computed artist earnings in USD
- **platform_profit** NUMERIC NOT NULL             # computed platform profit in USD
- **shipping_cost** NUMERIC NOT NULL DEFAULT 0     # shipping cost in USD
- **mockup_url** TEXT          # set after mockup generation
- **is_public** BOOLEAN NOT NULL DEFAULT 0
- **published_at** TIMESTAMP
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Indexes:
- INDEX idx_designs_fid(fid)
- INDEX idx_designs_product(product_id)
- INDEX idx_designs_public(is_public)

## 4. orders (optional/future)
Tracks order details and on-chain USDC payment transactions after a user buys a design.
- **id** INTEGER PRIMARY KEY AUTOINCREMENT
- **design_id** INTEGER NOT NULL REFERENCES designs(id)
 - **printful_order_id** TEXT NOT NULL
 - **total_amount** NUMERIC NOT NULL        # total USDC payment due (retail + shipping)
 - **artist_amount** NUMERIC NOT NULL       # USDC amount payable to artist
 - **shipping_cost** NUMERIC NOT NULL DEFAULT 0  # USDC shipping cost
- **payment_tx_hash** TEXT          # on-chain USDC transaction hash
- **status** TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','fulfilled','cancelled'))  
- **created_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **updated_at** TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Indexes:
- INDEX idx_orders_design(design_id)
- INDEX idx_orders_payment(payment_tx_hash)

## Notes
- All **created_at**/**updated_at** use `CURRENT_TIMESTAMP`. Consider triggers to auto-update `updated_at`.
- Use foreign-key constraints to enforce referential integrity.
- Leverage indexes on **status**, **is_public**, and **fid** for fast queries.
- Inventory management happens by updating `product_variants.inventory_count` when orders are placed or restocked.