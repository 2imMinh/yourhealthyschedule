// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <SignUp
        appearance={{
          variables: { colorPrimary: "hsl(155 30% 32%)" },
        }}
      />
    </main>
  );
}
