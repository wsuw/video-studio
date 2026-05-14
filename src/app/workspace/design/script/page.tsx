import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 py-4 sm:px-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Script Design</h1>
        <p className="text-muted-foreground mt-2">Editor has been removed. Waiting for new implementation.</p>
      </div>
      <Button className="mt-4 gap-2">
        <BookOpen className="h-4 w-4" />
        Coming Soon
      </Button>
    </div>
  );
}
