import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f6efe6" },
      { name: "color-scheme", content: "light" },
      { title: "Let's Scale Your Business" },
      { name: "description", content: "Tell us about your business. We’ll identify how we can help." },
      { name: "author", content: "Optify" },
      { property: "og:title", content: "Let's Scale Your Business" },
      { property: "og:description", content: "Tell us about your business. We’ll identify how we can help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@optify" },
      { name: "twitter:title", content: "Let's Scale Your Business" },
      { name: "twitter:description", content: "Tell us about your business. We’ll identify how we can help." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/e60af5be-f2d9-4279-8595-ccbeca87a576" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/e60af5be-f2d9-4279-8595-ccbeca87a576" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: "#f6efe6" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ backgroundColor: "#f6efe6" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <BrandlessShell />
      <Outlet />
    </>
  );
}


function BrandlessShell() {
  useEffect(() => {
    const removeLovableBranding = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href*="lovable.dev"], a[href*="lovable"], [id*="lovable" i], [class*="lovable" i], [data-lovable], [aria-label*="lovable" i]',
        ),
      );

      candidates.forEach((element) => element.remove());

      const floatingElements = Array.from(document.querySelectorAll<HTMLElement>('a, button, div, span'));

      floatingElements.forEach((element) => {
        const text = element.textContent?.trim().toLowerCase();
        if (!text) return;

        if (text.includes('edit with lovable') || text === 'lovable') {
          element.remove();
        }
      });
    };

    removeLovableBranding();

    const observer = new MutationObserver(removeLovableBranding);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
