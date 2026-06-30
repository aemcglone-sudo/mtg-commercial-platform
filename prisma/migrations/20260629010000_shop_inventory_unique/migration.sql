CREATE UNIQUE INDEX IF NOT EXISTS shop_inventory_shop_card_condition_foil_key
  ON shop_inventory ("shopId", "scryfallId", condition, foil);
