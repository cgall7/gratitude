-- The original likes/comments RLS policies (20260808000001) only checked
-- that the referenced share *exists*, not that the caller can actually see
-- it — `exists (select 1 from shares s where s.id = share_id)` is true for
-- every share in the database, regardless of who owns it. That let any
-- authenticated user read (and even post) likes/comments on a stranger's
-- share, leaking comment text outside the sharer's accepted connections.
-- This tightens select/insert on both tables to the same visibility rule
-- entries/shares already use: owner, or an accepted connection of the owner.
drop policy "likes_select_if_share_visible" on public.likes;
create policy "likes_select_if_share_visible" on public.likes for select
  using (
    exists (
      select 1 from public.shares s
      where s.id = likes.share_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.honeycomb_connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = auth.uid() and c.addressee_id = s.user_id)
                or (c.addressee_id = auth.uid() and c.requester_id = s.user_id)
              )
          )
        )
    )
  );

drop policy "likes_insert_if_share_visible" on public.likes;
create policy "likes_insert_if_share_visible" on public.likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.shares s
      where s.id = likes.share_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.honeycomb_connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = auth.uid() and c.addressee_id = s.user_id)
                or (c.addressee_id = auth.uid() and c.requester_id = s.user_id)
              )
          )
        )
    )
  );

drop policy "comments_select_if_share_visible" on public.comments;
create policy "comments_select_if_share_visible" on public.comments for select
  using (
    exists (
      select 1 from public.shares s
      where s.id = comments.share_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.honeycomb_connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = auth.uid() and c.addressee_id = s.user_id)
                or (c.addressee_id = auth.uid() and c.requester_id = s.user_id)
              )
          )
        )
    )
  );

drop policy "comments_insert_if_share_visible" on public.comments;
create policy "comments_insert_if_share_visible" on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.shares s
      where s.id = comments.share_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.honeycomb_connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = auth.uid() and c.addressee_id = s.user_id)
                or (c.addressee_id = auth.uid() and c.requester_id = s.user_id)
              )
          )
        )
    )
  );
