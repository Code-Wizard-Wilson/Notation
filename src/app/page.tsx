import { AuthView } from "@/components/auth/auth-view";
import { Workspace } from "@/components/workspace/workspace";
import { LOCAL_USER_ID } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import { createSampleNotes } from "@/lib/sample-notes";
import { createClient } from "@/lib/supabase/server";
import { mapNote } from "@/lib/utils";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return (
      <Workspace
        initialNotes={createSampleNotes()}
        user={{ id: LOCAL_USER_ID, email: "local@notation.app", isLocal: true }}
        localMode
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <AuthView />;

  const [{ data: noteRows }, { data: attachmentRows }] = await Promise.all([
    supabase.from("notes").select("*").order("updated_at", { ascending: false }),
    supabase.from("attachments").select("*").order("created_at", { ascending: true }),
  ]);

  type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];
  const attachmentsByNote = new Map<string, AttachmentRow[]>();
  for (const attachment of attachmentRows ?? []) {
    const current = attachmentsByNote.get(attachment.note_id) ?? [];
    current.push(attachment);
    attachmentsByNote.set(attachment.note_id, current);
  }

  const notes = (noteRows ?? []).map((row) => {
    const note = mapNote(row, attachmentsByNote.get(row.id));
    return {
      ...note,
      attachments: note.attachments.map((attachment) => ({
        ...attachment,
        url: `/api/attachments/${attachment.id}`,
      })),
    };
  });

  return (
    <Workspace
      initialNotes={notes}
      user={{ id: user.id, email: user.email ?? "Account" }}
      localMode={false}
    />
  );
}
