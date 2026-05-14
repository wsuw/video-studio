import { redirect } from "next/navigation";

export default function WorkspacePage() {
  // Redirect to a default project
  redirect("/workspace/proj_001/design/script");
}
