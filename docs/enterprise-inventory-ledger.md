# Enterprise Cafe Inventory Ledger

This design treats inventory as ingredients, not menu products. Products are sold; ingredients are stored, received, consumed, audited, and moved.

## Core Rules

- Stock is stored in base units only: `g`, `ml`, or `pcs`.
- Purchases can arrive as `kg`, `g`, `l`, `ml`, or `pcs`, but the database ledger stores the converted base quantity.
- Every stock change creates an immutable `stock_movements` row.
- Stock intakes and ingredient deductions run inside database transactions.
- Menu products consume ingredients through recipes.
- Never assume `1 kg coffee = 1 espresso`.

## Backend Modules

The implementation is split by responsibility so UI screens cannot decide inventory rules:

```txt
backend/src/modules/inventoryLedger/
  inventory-engine.service.js    # core stock mutation engine, movement + stock update
  stock-intake.service.js        # supplier receiving workflow
  recipe.service.js              # product -> ingredient mapping
  stock-movement.service.js      # immutable movement query API
  ingredient.service.js          # ingredient master data
  inventory-ledger.repository.js # Prisma repository layer
  inventory-ledger.validation.js # request validation and unit checks
  inventory-ledger.controller.js # HTTP controllers
  inventory-ledger.routes.js     # Express routes
```

Only `inventory-engine.service.js` is allowed to update `ingredients.current_quantity`. It updates stock and creates the matching `stock_movements` row inside the same transaction.

## Example Flow

1. Ingredient: `Coffee Beans`, base unit `g`.
2. Recipe: `Espresso` consumes `8g Coffee Beans`.
3. Stock intake receives `13kg Coffee Beans`.
4. System stores `13000g`.
5. One Espresso sale creates movement `OUT 8g`.
6. Remaining stock becomes `12992g`.

## PostgreSQL Schema

```sql
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ingredients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sku TEXT UNIQUE,
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'pcs')),
  current_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  average_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_items (
  id BIGSERIAL PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'pcs')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, ingredient_id)
);

CREATE TABLE stock_intakes (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
  invoice_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  created_by_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_intake_items (
  id BIGSERIAL PRIMARY KEY,
  stock_intake_id BIGINT NOT NULL REFERENCES stock_intakes(id) ON DELETE CASCADE,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  purchased_quantity NUMERIC(14,3) NOT NULL CHECK (purchased_quantity > 0),
  purchased_unit TEXT NOT NULL CHECK (purchased_unit IN ('g', 'ml', 'pcs')),
  base_quantity NUMERIC(14,3) NOT NULL CHECK (base_quantity > 0),
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'pcs')),
  unit_cost NUMERIC(12,4) NOT NULL CHECK (unit_cost > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  stock_intake_id BIGINT REFERENCES stock_intakes(id),
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER')),
  source_type TEXT NOT NULL,
  source_id TEXT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'pcs')),
  previous_stock NUMERIC(14,3) NOT NULL,
  new_stock NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(12,4),
  total_cost NUMERIC(12,2),
  reason TEXT,
  created_by_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_ingredient_time ON stock_movements(ingredient_id, created_at DESC);
CREATE INDEX idx_stock_movements_source ON stock_movements(source_type, source_id);
CREATE INDEX idx_stock_intakes_supplier_time ON stock_intakes(supplier_id, created_at DESC);
```

## API Examples

Create ingredient:

```http
POST /api/inventory-ledger/ingredients
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Coffee Beans",
  "sku": "ING-COFFEE-BEANS",
  "baseUnit": "g",
  "minimumQuantity": 2000
}
```

Create recipe:

```http
PUT /api/inventory-ledger/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": 1,
  "notes": "Standard espresso recipe",
  "items": [
    { "ingredientId": 1, "quantity": 8, "unit": "g" }
  ]
}
```

Create and confirm stock intake:

```http
POST /api/inventory-ledger/stock-intakes
Authorization: Bearer <token>
Content-Type: application/json

{
  "supplierId": 2,
  "invoiceNumber": "INV-2026-001",
  "notes": "Morning delivery",
  "confirm": true,
  "items": [
    { "ingredientId": 1, "purchasedQuantity": 13, "purchasedUnit": "kg", "unitCost": 7.5 },
    { "ingredientId": 2, "purchasedQuantity": 10, "purchasedUnit": "l", "unitCost": 1.2 }
  ]
}
```

Response shape:

```json
{
  "success": true,
  "message": "Stock intake created successfully",
  "data": {
    "id": 15,
    "invoiceNumber": "INV-2026-001",
    "status": "confirmed",
    "totalCost": "109.50",
    "items": [
      {
        "ingredientId": 1,
        "purchasedQuantity": "13000",
        "purchasedUnit": "g",
        "baseQuantity": "13000",
        "baseUnit": "g"
      }
    ],
    "movements": [
      {
        "type": "IN",
        "quantity": "13000",
        "previousStock": "0",
        "newStock": "13000",
        "sourceType": "STOCK_INTAKE"
      }
    ]
  }
}
```

List movements:

```http
GET /api/inventory-ledger/stock-movements?page=1&pageSize=25&ingredientId=1
Authorization: Bearer <token>
```

## Production Best Practices

- Keep `stock_movements` immutable.
- Perform intake confirmation and ingredient stock updates in one transaction.
- Store base quantities in a canonical unit.
- For future branches/warehouses, add `location_id` to `stock_intakes`, `stock_intake_items`, and `stock_movements`.
- For barcode scanning, add `barcode` to `ingredients` and optional supplier item mappings.
- For stock transfers, add paired `TRANSFER_OUT` and `TRANSFER_IN` movement records.
- For inventory audits, add an `inventory_counts` table and generate `ADJUSTMENT` movements.
