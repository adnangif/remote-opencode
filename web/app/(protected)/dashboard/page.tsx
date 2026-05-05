import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svc flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "Avatar"}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full"
          />
        )}
        <h1 className="text-2xl font-bold">
          Welcome, {session.user.name}
        </h1>
        <p className="text-muted-foreground text-sm">{session.user.email}</p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
