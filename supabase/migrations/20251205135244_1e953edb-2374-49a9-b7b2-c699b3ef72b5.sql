-- Fix the merged task that was incorrectly saved as 'installation' instead of 'reinstallation'
UPDATE installation_tasks 
SET task_type = 'reinstallation' 
WHERE id = '39ca74c9-fc2f-4e31-9735-734da6396991';