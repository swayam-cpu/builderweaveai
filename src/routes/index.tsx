import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Mail, Rocket, Code2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-40 bg-background/70">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-hero glow-primary" />
            <span className="font-display font-bold text-lg">Weave</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "login" }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 glow-primary">Get started</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-8">
            <Sparkles className="h-3 w-3 text-primary" /> AI website builder + private mail
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            Describe it. <span className="text-gradient">Weave</span> ships it.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Prompt an AI to build a real website, preview it live, and publish it with one click.
            Get your own <span className="text-primary font-mono">you@weave.com</span> address and chat with other builders.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 glow-primary">Start building free</Link>
            <Link to="/auth" search={{ mode: "login" }} className="px-6 py-3 rounded-lg border border-border hover:bg-card">I have an account</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 grid gap-6 md:grid-cols-3">
        {[
          { icon: Code2, title: "AI code generation", desc: "Type what you want. GPT-5 writes complete HTML, CSS, and JS." },
          { icon: Rocket, title: "Instant publish", desc: "One click and your site is live on a public /s/your-slug URL." },
          { icon: Mail, title: "Weave Mail", desc: "Every account gets a username@weave.com inbox for messaging other users." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl bg-gradient-card border border-border p-6">
            <f.icon className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Weave. Built with AI.
      </footer>
    </div>
  );
}
