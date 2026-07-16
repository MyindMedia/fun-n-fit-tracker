-- Fix for gameKey Column Issue
-- Run this in Supabase SQL Editor if you're still getting the gameKey error

-- Step 1: Check if column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game_sessions' AND column_name = 'gameKey';

-- Step 2: If the above query returns NO ROWS, run this to add the column:
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "gameKey" TEXT;

-- Step 3: Set existing rows to a default value
UPDATE game_sessions SET "gameKey" = 'UNKNOWN' WHERE "gameKey" IS NULL OR "gameKey" = '';

-- Step 4: Make it NOT NULL (optional, matches schema)
-- Comment this out if you want to allow NULL values
-- ALTER TABLE game_sessions ALTER COLUMN "gameKey" SET NOT NULL;

-- Step 5: Refresh Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- Step 6: Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'game_sessions'
ORDER BY ordinal_position;
