-- Reset the billboards sequence to match the actual max ID
SELECT setval('billboards_id_seq', (SELECT COALESCE(MAX("ID"), 0) FROM billboards), true);