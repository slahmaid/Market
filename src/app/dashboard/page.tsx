import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import MySquaresClient from "./my-squares-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return <MySquaresClient />;
}
