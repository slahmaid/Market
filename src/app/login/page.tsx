import LoginForm from "./login-form";

function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const googleEnabled =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <LoginForm
      googleEnabled={googleEnabled}
      oauthError={params.error}
      callbackUrl={safeCallbackUrl(params.callbackUrl)}
    />
  );
}
