create or replace function public.create_starter_notes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notes (user_id, title, content_json, plain_text_content, is_pinned, updated_at)
  values
    (
      new.id,
      'Product direction',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The editor should feel almost invisible while writing."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Priorities"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Instant search"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Better mobile navigation"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Faster attachments"}]}]}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Build editor prototype"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Add file uploads"}]}]}]}]}'::jsonb,
      'The editor should feel almost invisible while writing. Priorities Instant search Better mobile navigation Faster attachments Build editor prototype Add file uploads',
      true,
      now() - interval '4 minutes'
    ),
    (
      new.id,
      'Visual references',
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ideas for a quieter, more editorial interface."}]},{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"The interface should disappear when writing and become expressive while navigating."}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Reading list"}]},{"type":"paragraph","content":[{"type":"text","text":"Review TipTap documentation before refining custom extensions."}]}]}'::jsonb,
      'Ideas for a quieter, more editorial interface. The interface should disappear when writing and become expressive while navigating. Reading list Review TipTap documentation before refining custom extensions.',
      false,
      now() - interval '48 minutes'
    );
  return new;
end;
$$;

create trigger on_auth_user_created_create_starter_notes
after insert on auth.users
for each row execute procedure public.create_starter_notes();
