-- Limit display_name length to prevent abuse
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_display_name_length 
  CHECK (display_name IS NULL OR char_length(display_name) <= 100);

-- Validate avatar_color format (HSL format: hsl(360, 70%, 60%))
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_avatar_color_format 
  CHECK (
    avatar_color IS NULL OR 
    avatar_color ~ '^hsl\([0-9]+,\s*[0-9]+%,\s*[0-9]+%\)$'
  );

-- Index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- Index on streaks user_id for faster lookups
CREATE INDEX IF NOT EXISTS streaks_user_id_idx ON public.streaks(user_id);

-- Index on last_visit for streak queries
CREATE INDEX IF NOT EXISTS streaks_last_visit_idx ON public.streaks(last_visit);

