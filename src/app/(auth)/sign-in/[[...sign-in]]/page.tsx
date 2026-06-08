// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <SignIn
        appearance={{
          variables: { colorPrimary: "hsl(155 30% 32%)" },
        }}
      />
    </main>
  );
}
