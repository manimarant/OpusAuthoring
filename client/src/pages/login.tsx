import { type FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ username, password });
      const redirectPath = sessionStorage.getItem("opuslearn-post-login-path") || "/";
      sessionStorage.removeItem("opuslearn-post-login-path");
      setLocation(redirectPath === "/login" ? "/" : redirectPath);
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Check your username and password.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-auto bg-white">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="text-left text-2xl font-semibold tracking-[-0.03em] text-black">oPuslearn</div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid w-full gap-12 border-t border-black pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,420px)] lg:gap-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">Next Generation Authoring</p>
            <h1
              className="mt-6 text-5xl leading-[0.98] tracking-[-0.05em] text-black sm:text-6xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Knowledge transfer,
              <br />
              reimagined.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">
              oPuslearn transforms static curriculums into adaptive, neural learning environments. Deploy
              enterprise-grade training with the precision of engineering and the intuition of AI.
            </p>
          </div>

          <form className="space-y-5 border-t border-slate-300 pt-8 lg:border-t-0 lg:border-l lg:pl-12" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                autoComplete="username"
                className="h-12 rounded-none border-0 border-b border-slate-300 px-0 text-base shadow-none focus-visible:ring-0 focus-visible:border-black"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="h-12 rounded-none border-0 border-b border-slate-300 px-0 text-base shadow-none focus-visible:ring-0 focus-visible:border-black"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-6 h-12 w-full rounded-none bg-black text-base text-white hover:bg-slate-900"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Enter oPuslearn"}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
