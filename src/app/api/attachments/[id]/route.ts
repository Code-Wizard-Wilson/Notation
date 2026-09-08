import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("storage_path, filename")
    .eq("id", id)
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data, error: signingError } = await supabase.storage
    .from("note-attachments")
    .createSignedUrl(
      attachment.storage_path,
      60,
      download ? { download: attachment.filename } : undefined,
    );

  if (signingError) {
    return NextResponse.json({ error: "Could not open attachment." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
