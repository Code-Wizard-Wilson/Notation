import { Workspace } from "@/components/workspace/workspace";
import { LOCAL_USER_ID } from "@/lib/constants";
import { createSampleNotes } from "@/lib/sample-notes";

export default function AppPage() {
  return (
    <Workspace
      initialNotes={createSampleNotes()}
      user={{ id: LOCAL_USER_ID, email: "On this device", isLocal: true }}
    />
  );
}
