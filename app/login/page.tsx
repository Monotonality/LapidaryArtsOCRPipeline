import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string; details?: string }>;
}) {
  const { status, reason, details } = await searchParams;
  return <LoginForm status={status} reason={reason} details={details} />;
}