import RegisterForm from "./register-form";

export default function RegisterPage() {
  const googleEnabled =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return <RegisterForm googleEnabled={googleEnabled} />;
}
