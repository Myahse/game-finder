-- The push test used to add a "Notifications are on" row to the player's list.
-- It now sends directly to the device; clear the old rows.
delete from public.notifications
where type = 'system' and title = 'Notifications are on 🎉';
