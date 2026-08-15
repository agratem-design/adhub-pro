-- Fix the sync_friend_rental_data trigger - it has 8 columns but only 7 values
CREATE OR REPLACE FUNCTION public.sync_friend_rental_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  rental_item JSONB;
  billboard_price NUMERIC;
BEGIN
  -- Delete existing rentals for this contract
  DELETE FROM friend_billboard_rentals 
  WHERE contract_number = NEW."Contract_Number";
  
  -- If friend_rental_data is not null and not empty, insert new records
  IF NEW.friend_rental_data IS NOT NULL AND jsonb_array_length(NEW.friend_rental_data) > 0 THEN
    FOR rental_item IN SELECT * FROM jsonb_array_elements(NEW.friend_rental_data)
    LOOP
      -- Get the customer rental price from billboard_prices
      SELECT COALESCE(
        (
          SELECT CAST(bp->>'contractPrice' AS NUMERIC)
          FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp
          WHERE bp->>'billboardId' = rental_item->>'billboardId'
        ),
        (
          SELECT CAST(bp->>'priceAfterDiscount' AS NUMERIC)
          FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp
          WHERE bp->>'billboardId' = rental_item->>'billboardId'
        ),
        0
      ) INTO billboard_price;
      
      -- Insert into friend_billboard_rentals - FIXED: Added NULL for notes column
      INSERT INTO friend_billboard_rentals (
        billboard_id,
        contract_number,
        friend_company_id,
        friend_rental_cost,
        customer_rental_price,
        start_date,
        end_date,
        notes
      )
      VALUES (
        CAST(rental_item->>'billboardId' AS BIGINT),
        NEW."Contract_Number",
        CAST(rental_item->>'friendCompanyId' AS UUID),
        CAST(rental_item->>'friendRentalCost' AS NUMERIC),
        billboard_price,
        COALESCE(NEW."Contract Date", CURRENT_DATE),
        COALESCE(NEW."End Date", CURRENT_DATE + INTERVAL '30 days'),
        NULL  -- FIXED: Added missing notes value
      )
      ON CONFLICT (billboard_id, contract_number) 
      DO UPDATE SET
        friend_company_id = EXCLUDED.friend_company_id,
        friend_rental_cost = EXCLUDED.friend_rental_cost,
        customer_rental_price = EXCLUDED.customer_rental_price,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;