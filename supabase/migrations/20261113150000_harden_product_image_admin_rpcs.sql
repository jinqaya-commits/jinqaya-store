-- Restrict product image administration RPCs to signed-in users.
revoke all on function public.admin_add_product_image(uuid, text, text) from public, anon;
grant execute on function public.admin_add_product_image(uuid, text, text) to authenticated;

revoke all on function public.admin_delete_product_image(uuid, uuid) from public, anon;
grant execute on function public.admin_delete_product_image(uuid, uuid) to authenticated;

revoke all on function public.admin_enqueue_product_image_cleanup(text) from public, anon;
grant execute on function public.admin_enqueue_product_image_cleanup(text) to authenticated;

revoke all on function public.admin_reorder_product_images(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_product_images(uuid, uuid[]) to authenticated;

-- The storage_path unique constraint already owns an equivalent index.
drop index if exists public.product_image_cleanup_queue_storage_path_uidx;
